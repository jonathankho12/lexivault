import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentConfig,
  type Schema,
  type ThinkingConfig,
} from "@google/genai";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type GeminiErrorCode =
  | "missing_key"
  | "overload"
  | "rate_limit"
  | "auth"
  | "model"
  | "network"
  | "empty_response"
  | "parse_error"
  | "incomplete_response"
  | "api_error";

export interface ClassifiedGeminiError {
  status: number;
  upstreamStatus?: number;
  code: GeminiErrorCode;
  shortReason: string;
  detail: string;
  rawMessage: string;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

// Balanced circuit-breaker + Cloudflare Workers timeout budgets
const MODEL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown for 503/429/404 models
const MODEL_DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes per Worker isolate
const MODEL_DISCOVERY_TIMEOUT_MS = 3000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 10500;
const MAX_FALLBACK_MODELS = 1;

// Backup providers (Tier 2: Groq, Tier 3: Cloudflare Workers AI)
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant";
const GROQ_TIMEOUT_MS = 10500;
const CF_AI_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-8b-instruct",
] as const;
const CF_AI_TIMEOUT_MS = 10500;

interface DiscoveredModelsCache {
  fetchedAt: number;
  keyHash: number;
  models: string[];
}

let discoveredModelsCache: DiscoveredModelsCache | null = null;

// In-memory Worker isolate circuit-breaker: modelName(lower) -> cooldownUntilTimestamp
const modelCooldownUntil = new Map<string, number>();

// In-memory capability cache: models that return HTTP 400 when `thinkingConfig` is passed
const modelsRejectingThinkingConfig = new Set<string>();

function cleanEnvValue(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function hashKeyFingerprint(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(err ?? "Unknown Gemini API error");
}

function isModelInCooldown(model: string, now = Date.now()): boolean {
  const until = modelCooldownUntil.get(model.toLowerCase());
  if (!until) return false;
  if (until <= now) {
    modelCooldownUntil.delete(model.toLowerCase());
    return false;
  }
  return true;
}

function markModelCooldown(model: string, reason: string): void {
  const key = model.toLowerCase();
  const until = Date.now() + MODEL_COOLDOWN_MS;
  modelCooldownUntil.set(key, until);
  console.warn(
    `[LexiVault][gemini-circuit] Marked "${model}" unhealthy (${reason}) for 5m cooldown`
  );
}

/**
 * Selects the model-generation-compatible minimal thinking config:
 * - Gemini 3.x models use `thinkingLevel` (`MINIMAL` for Flash, `LOW` for Pro) — `thinkingBudget: 0` triggers HTTP 400.
 * - Gemini 2.5 Flash / Flash-Lite use `thinkingBudget: 0` — `thinkingLevel` triggers HTTP 400.
 * - Older Gemini 2.0 / 1.5 and Gemini 2.5 Pro omit `thinkingConfig` altogether.
 * - Any model that ever rejects `thinkingConfig` with HTTP 400 is cached in `modelsRejectingThinkingConfig`.
 */
function resolveThinkingConfigForModel(
  model: string
): ThinkingConfig | undefined {
  const lower = model.toLowerCase();
  if (modelsRejectingThinkingConfig.has(lower)) {
    return undefined;
  }

  // Gemini 3.x family (e.g. gemini-3.8-flash, gemini-3.0-flash, gemini-3-flash-preview)
  if (/^gemini-3(\.\d+)?[-_]/i.test(lower) || /^gemini-3(\.\d+)?$/i.test(lower)) {
    if (lower.includes("flash")) {
      return { thinkingLevel: ThinkingLevel.MINIMAL };
    }
    return { thinkingLevel: ThinkingLevel.LOW };
  }

  // Gemini 2.5 Flash / Flash-Lite / gemini-flash aliases support thinkingBudget: 0
  if (lower.includes("gemini-2.5-flash") || lower.includes("gemini-flash")) {
    return { thinkingBudget: 0 };
  }

  // Gemini 2.0, 1.5, and 2.5-pro do not accept thinkingBudget: 0
  return undefined;
}

function isThinkingConfigRejection(err: unknown): boolean {
  const msg = extractErrorMessage(err);
  const lower = msg.toLowerCase();
  const status = extractUpstreamStatus(err, msg);
  const is400 =
    status === 400 ||
    lower.includes("invalid_argument") ||
    lower.includes("bad request");
  if (!is400) return false;

  return (
    lower.includes("thinking") ||
    lower.includes("budget") ||
    lower.includes("thinkinglevel") ||
    lower.includes("thinking_level") ||
    lower.includes("thinkingbudget") ||
    lower.includes("thinking_budget") ||
    lower.includes("thinkingconfig") ||
    lower.includes("thinking_config") ||
    lower.includes("level")
  );
}

/**
 * Formats existing Vault terms into a compact, deduplicated CSV string
 * to minimize prompt tokens and maximize Gemini generation speed.
 */
export function formatCompactExistingTerms(
  terms: string[] | undefined,
  maxItems = 140
): string {
  if (!Array.isArray(terms) || terms.length === 0) return "none";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const clean = String(raw || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out.length > 0 ? out.join(", ") : "none";
}

/**
 * Resolves a runtime environment variable safely from BOTH Cloudflare Workers
 * bindings (`getCloudflareContext({ async: true }).env`) and `process.env`.
 */
export async function resolveRuntimeEnvVar(name: string): Promise<string> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const envRecord = ctx?.env as Record<string, unknown> | undefined;
    const fromCf = cleanEnvValue(envRecord?.[name]);
    if (fromCf) {
      return fromCf;
    }
  } catch {
    // Outside Cloudflare Workers runtime or dev proxy not initialized; fall through to process.env
  }

  return cleanEnvValue(process.env[name]);
}

/**
 * Resolves GEMINI_API_KEY across Cloudflare Workers runtime bindings and process.env.
 */
export async function resolveGeminiApiKey(): Promise<string> {
  const primary = await resolveRuntimeEnvVar("GEMINI_API_KEY");
  if (primary) return primary;

  const altGoogle = await resolveRuntimeEnvVar("GOOGLE_GENERATIVE_AI_API_KEY");
  if (altGoogle) return altGoogle;

  return resolveRuntimeEnvVar("GOOGLE_API_KEY");
}

export async function isGeminiConfigured(): Promise<boolean> {
  const key = await resolveGeminiApiKey();
  return key.length > 0;
}

export async function getGeminiClient(): Promise<GoogleGenAI | null> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Centralized Gemini model resolver.
 * Priority: GEMINI_MODEL -> GEMINI_FLASH_MODEL -> "gemini-3.8-flash".
 * Reads from both Cloudflare Workers runtime bindings and process.env.
 */
export async function getGeminiModel(): Promise<string> {
  return (
    (await resolveRuntimeEnvVar("GEMINI_MODEL")) ||
    (await resolveRuntimeEnvVar("GEMINI_FLASH_MODEL")) ||
    DEFAULT_GEMINI_MODEL
  );
}

export async function getGeminiFlashModel(): Promise<string> {
  return getGeminiModel();
}

export async function getGeminiFastModel(): Promise<string> {
  const explicitFast =
    (await resolveRuntimeEnvVar("GEMINI_FAST_MODEL")) ||
    (await resolveRuntimeEnvVar("GEMINI_FLASH_LITE_MODEL")) ||
    (await resolveRuntimeEnvVar("GEMINI_FLASH_MODEL"));
  if (explicitFast) return explicitFast;

  const configuredDefault = await resolveRuntimeEnvVar("GEMINI_MODEL");
  if (
    configuredDefault &&
    !configuredDefault.toLowerCase().includes("pro") &&
    !configuredDefault.toLowerCase().includes("thinking")
  ) {
    return configuredDefault;
  }

  if (discoveredModelsCache && discoveredModelsCache.models.length > 0) {
    const fastDiscovered = [...discoveredModelsCache.models].sort(
      (a, b) => scoreDiscoveredModel(b, true) - scoreDiscoveredModel(a, true)
    )[0];
    if (
      fastDiscovered &&
      fastDiscovered.toLowerCase().includes("flash") &&
      !isModelInCooldown(fastDiscovered)
    ) {
      return fastDiscovered;
    }
  }

  return DEFAULT_GEMINI_MODEL;
}

export async function getGeminiProModel(): Promise<string> {
  return (
    (await resolveRuntimeEnvVar("GEMINI_PRO_MODEL")) ||
    (await resolveRuntimeEnvVar("GEMINI_MODEL")) ||
    DEFAULT_GEMINI_MODEL
  );
}

/**
 * Optional comma-separated fallback model list from Cloudflare runtime binding or env var.
 */
export async function getGeminiFallbackModels(
  excludeModels: string[] = []
): Promise<string[]> {
  const raw = await resolveRuntimeEnvVar("GEMINI_FALLBACK_MODELS");
  if (!raw) return [];
  const excluded = new Set(excludeModels.map((m) => m.toLowerCase()));
  const seen = new Set<string>();
  const list: string[] = [];

  for (const part of raw.split(",")) {
    const cleaned = cleanEnvValue(part).replace(/^models\//i, "");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    list.push(cleaned);
  }
  return list;
}

export async function getGeminiTtsModel(): Promise<string> {
  return (
    (await resolveRuntimeEnvVar("GEMINI_TTS_MODEL")) ||
    DEFAULT_GEMINI_TTS_MODEL
  );
}

const EXCLUDED_MODEL_PATTERNS = [
  "embed",
  "tts",
  "image",
  "imagen",
  "veo",
  "lyria",
  "audio",
  "vision",
  "robotics",
  "computer-use",
  "deep-research",
  "aqa",
  "bison",
  "gecko",
  "learnlm",
  "gemma",
  "nano",
] as const;

function isEligibleTextFallbackModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  if (!lower.includes("gemini")) return false;
  return !EXCLUDED_MODEL_PATTERNS.some((pat) => lower.includes(pat));
}

function scoreDiscoveredModel(modelId: string, preferLite = false): number {
  const lower = modelId.toLowerCase();
  let score = 0;

  // Strongly prioritize fast/lightweight flash and flash-lite models
  if (lower.includes("flash-lite")) {
    score += preferLite ? 1140 : 1070;
  } else if (lower.includes("flash")) {
    score += 1080;
  } else if (lower.includes("pro")) {
    score += 400;
  } else {
    score += 200;
  }

  // Prefer newer Gemini generations (e.g. 3.8 > 3.5 > 3.0 > 2.5 > 2.0 > 1.5)
  const verMatch = /gemini-(\d+)(?:\.(\d+))?/i.exec(lower);
  if (verMatch) {
    const major = Number(verMatch[1]) || 0;
    const minor = Number(verMatch[2]) || 0;
    score += major * 100 + minor * 10;
  }

  // Prefer stable GA aliases over experimental, thinking-only, or dated snapshots
  if (lower.includes("-latest")) score += 25;
  if (!lower.includes("preview") && !lower.includes("exp")) score += 20;
  if (lower.includes("-exp")) score -= 45;
  if (lower.includes("thinking")) score -= 40;
  if (/-\d{3}$/.test(lower) || /-\d{2}-\d{2,4}/.test(lower)) score -= 15;

  return score;
}

/**
 * Dynamically discovers active Gemini text models available to the configured API key
 * via `GET /v1beta/models` and caches the ranked list in memory for 10 minutes per Worker isolate.
 */
async function discoverAvailableFallbackModels(
  apiKey: string,
  excludeModels: string[]
): Promise<string[]> {
  const excluded = new Set(excludeModels.map((m) => m.toLowerCase()));
  const keyHash = hashKeyFingerprint(apiKey);
  const now = Date.now();

  if (
    discoveredModelsCache &&
    discoveredModelsCache.keyHash === keyHash &&
    now - discoveredModelsCache.fetchedAt < MODEL_DISCOVERY_CACHE_TTL_MS
  ) {
    return discoveredModelsCache.models.filter(
      (m) => !excluded.has(m.toLowerCase())
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_DISCOVERY_TIMEOUT_MS);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
      apiKey
    )}&pageSize=100`;
    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(
        `[LexiVault][gemini-discovery] Model list fetch failed (HTTP ${res.status})`
      );
      return [];
    }

    const json = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const rawModels = Array.isArray(json.models) ? json.models : [];
    const seen = new Set<string>();
    const eligible: string[] = [];

    for (const entry of rawModels) {
      if (!entry?.name) continue;
      const methods = Array.isArray(entry.supportedGenerationMethods)
        ? entry.supportedGenerationMethods
        : [];
      if (!methods.includes("generateContent")) continue;

      const cleanId = entry.name.replace(/^models\//i, "").trim();
      if (!cleanId) continue;
      if (!isEligibleTextFallbackModel(cleanId)) continue;

      const lowerKey = cleanId.toLowerCase();
      if (seen.has(lowerKey)) continue;
      seen.add(lowerKey);
      eligible.push(cleanId);
    }

    eligible.sort((a, b) => scoreDiscoveredModel(b) - scoreDiscoveredModel(a));

    discoveredModelsCache = {
      fetchedAt: now,
      keyHash,
      models: eligible,
    };

    console.info(
      `[LexiVault][gemini-discovery] Cached ${eligible.length} active models (top: ${eligible
        .slice(0, 5)
        .join(", ")})`
    );

    return eligible.filter((m) => !excluded.has(m.toLowerCase()));
  } catch (err) {
    const msg = extractErrorMessage(err);
    console.warn(
      "[LexiVault][gemini-discovery] Discovery skipped:",
      msg.slice(0, 160)
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function missingGeminiKeyError(): ClassifiedGeminiError {
  return {
    status: 503,
    code: "missing_key",
    shortReason: "missing_api_key",
    detail:
      "GEMINI_API_KEY is not configured in Cloudflare Workers runtime bindings or environment variables.",
    rawMessage: "GEMINI_API_KEY missing in both Cloudflare env and process.env",
  };
}

export function emptyGeminiResponseError(
  model?: string,
  finishReason?: string
): ClassifiedGeminiError {
  return {
    status: 502,
    code: "empty_response",
    shortReason: finishReason
      ? `empty_response_${finishReason.toLowerCase()}`
      : "empty_response",
    detail: "Gemini AI returned an empty response. Please try again.",
    rawMessage: `Empty response body from model "${model || "unknown"}" (finishReason=${finishReason || "unknown"})`,
  };
}

export function incompleteGeminiResponseError(
  model: string,
  reason: string,
  finishReason?: string
): ClassifiedGeminiError {
  return {
    status: 502,
    code: "incomplete_response",
    shortReason: `incomplete_output (${reason})`,
    detail: "Gemini AI returned incomplete word details. Please try again.",
    rawMessage: `Incomplete structured output from "${model}": ${reason} (finishReason=${finishReason || "unknown"})`,
  };
}

function parseGeminiJsonError(
  model: string,
  parseErr: unknown,
  finishReason: string | undefined,
  textLength: number,
  maxOutputTokens?: number
): ClassifiedGeminiError {
  const errMsg = extractErrorMessage(parseErr).slice(0, 160);
  const isTruncated = finishReason === "MAX_TOKENS";
  return {
    status: 502,
    code: "parse_error",
    shortReason: isTruncated
      ? `json_truncated_max_tokens (max=${maxOutputTokens ?? "default"}, len=${textLength})`
      : `json_parse_error (finishReason=${finishReason || "unknown"})`,
    detail: isTruncated
      ? "Gemini AI response was truncated before completing JSON output. Please try again."
      : "Gemini AI returned malformed JSON. Please try again.",
    rawMessage: `JSON.parse failed on "${model}" (finishReason=${finishReason || "unknown"}, len=${textLength}, maxOutputTokens=${maxOutputTokens ?? "default"}): ${errMsg}`,
  };
}

function timeoutGeminiError(
  model: string,
  timeoutMs: number
): ClassifiedGeminiError {
  return {
    status: 503,
    code: "network",
    shortReason: `timeout_${timeoutMs}ms`,
    detail:
      "Unable to reach Gemini AI right now (network timeout). Please try again.",
    rawMessage: `Request timed out after ${timeoutMs}ms on model "${model}"`,
  };
}

function extractUpstreamStatus(
  err: unknown,
  rawMessage: string
): number | undefined {
  if (err && typeof err === "object") {
    const obj = err as {
      status?: unknown;
      statusCode?: unknown;
      error?: { code?: unknown };
    };
    if (typeof obj.status === "number" && obj.status >= 100 && obj.status < 600) {
      return obj.status;
    }
    if (
      typeof obj.statusCode === "number" &&
      obj.statusCode >= 100 &&
      obj.statusCode < 600
    ) {
      return obj.statusCode;
    }
    if (
      typeof obj.error?.code === "number" &&
      obj.error.code >= 100 &&
      obj.error.code < 600
    ) {
      return obj.error.code;
    }
  }

  const codeMatch =
    /"code"\s*:\s*(\d{3})/.exec(rawMessage) ||
    /\bstatus[:\s]+(\d{3})\b/i.exec(rawMessage) ||
    /\b(400|401|403|404|429|500|502|503|504)\b/.exec(rawMessage);
  if (codeMatch?.[1]) {
    const parsed = Number(codeMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  const rawMessage = extractErrorMessage(err);
  const upstreamStatus = extractUpstreamStatus(err, rawMessage);
  const conciseRaw = rawMessage.slice(0, 320);
  const lower = rawMessage.toLowerCase();

  // 0. JSON syntax / parse errors
  if (err instanceof SyntaxError || lower.includes("json")) {
    if (
      lower.includes("unexpected end") ||
      lower.includes("unterminated") ||
      lower.includes("unexpected token") ||
      err instanceof SyntaxError
    ) {
      return {
        status: 502,
        upstreamStatus,
        code: "parse_error",
        shortReason: "json_parse_error",
        detail: "Gemini AI returned truncated or malformed JSON. Please try again.",
        rawMessage: conciseRaw,
      };
    }
  }

  // 1. Temporary overload / high demand (503 UNAVAILABLE) — checked before "model"
  if (
    upstreamStatus === 503 ||
    upstreamStatus === 504 ||
    lower.includes("unavailable") ||
    lower.includes("overloaded") ||
    lower.includes("high demand") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("capacity")
  ) {
    return {
      status: 503,
      upstreamStatus: upstreamStatus ?? 503,
      code: "overload",
      shortReason: `http_${upstreamStatus ?? 503}_overload`,
      detail:
        "Gemini AI is experiencing high demand right now. Please try again in a moment.",
      rawMessage: conciseRaw,
    };
  }

  // 2. Rate limit / quota spike (429 RESOURCE_EXHAUSTED)
  if (
    upstreamStatus === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return {
      status: 429,
      upstreamStatus: upstreamStatus ?? 429,
      code: "rate_limit",
      shortReason: `http_${upstreamStatus ?? 429}_rate_limit`,
      detail:
        "Gemini AI rate limit reached right now. Please try again in a moment.",
      rawMessage: conciseRaw,
    };
  }

  // 3. Authentication / key errors (401 / 403)
  if (
    upstreamStatus === 401 ||
    upstreamStatus === 403 ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthorized")
  ) {
    return {
      status: 401,
      upstreamStatus: upstreamStatus ?? 401,
      code: "auth",
      shortReason: `http_${upstreamStatus ?? 401}_auth`,
      detail: "Gemini API key is invalid, restricted, or unauthorized.",
      rawMessage: conciseRaw,
    };
  }

  // 4. Transient network / timeout / abort errors
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("aborted") ||
    lower.includes("abort")
  ) {
    return {
      status: 503,
      upstreamStatus,
      code: "network",
      shortReason:
        lower.includes("timeout") ||
        lower.includes("timed out") ||
        lower.includes("abort")
          ? "timeout"
          : "network_error",
      detail:
        "Unable to reach Gemini AI right now (network timeout). Please try again.",
      rawMessage: conciseRaw,
    };
  }

  // 5. True model / invalid request errors (404 NOT_FOUND or 400 INVALID_ARGUMENT)
  if (
    upstreamStatus === 404 ||
    upstreamStatus === 400 ||
    lower.includes("not_found") ||
    lower.includes("is not found for api version") ||
    lower.includes("not supported for generatecontent") ||
    lower.includes("invalid_argument")
  ) {
    return {
      status: 502,
      upstreamStatus: upstreamStatus ?? 404,
      code: "model",
      shortReason: `http_${upstreamStatus ?? 404}_model_or_invalid_arg`,
      detail: "Configured Gemini model is unavailable or rejected the request.",
      rawMessage: conciseRaw,
    };
  }

  const shortSnippet = conciseRaw.split("\n")[0]?.slice(0, 80) || "unknown";
  return {
    status: 502,
    upstreamStatus,
    code: "api_error",
    shortReason: upstreamStatus
      ? `http_${upstreamStatus}`
      : `api_error: ${shortSnippet}`,
    detail: `Gemini AI request failed (${
      upstreamStatus ? `HTTP ${upstreamStatus}` : shortSnippet
    }). Please try again.`,
    rawMessage: conciseRaw,
  };
}

export function isTransientGeminiError(err: ClassifiedGeminiError): boolean {
  return (
    err.code === "overload" ||
    err.code === "rate_limit" ||
    err.code === "network"
  );
}

function isFallbackEligibleError(err: ClassifiedGeminiError): boolean {
  // Transient errors (503/429/timeout/network) skip slow Gemini model hopping and go straight to Groq / Workers AI
  return (
    err.code === "model" ||
    err.code === "empty_response" ||
    err.code === "parse_error" ||
    err.code === "incomplete_response"
  );
}

function shouldCooldownModelForError(err: ClassifiedGeminiError): boolean {
  return (
    err.code === "overload" ||
    err.code === "rate_limit" ||
    err.code === "model"
  );
}

export function logGeminiRouteError(
  route: string,
  classified: ClassifiedGeminiError,
  extra?: Record<string, unknown>
): void {
  console.error(
    `[LexiVault][${route}] Gemini failure (${classified.shortReason}):`,
    {
      httpStatus: classified.status,
      upstreamStatus: classified.upstreamStatus ?? null,
      code: classified.code,
      shortReason: classified.shortReason,
      detail: classified.detail,
      rawMessage: classified.rawMessage,
      ...(extra ?? {}),
    }
  );
}

export type AiProviderName = "gemini" | "groq" | "cf-workers-ai";

export interface ProviderAttemptFailure {
  provider: AiProviderName;
  model: string;
  status: number | null;
  message: string;
  timeout: boolean;
  code: GeminiErrorCode;
  reason: string;
  elapsedMs: number;
}

function isTimeoutFailure(err: ClassifiedGeminiError): boolean {
  const lowerRaw = err.rawMessage.toLowerCase();
  return (
    err.code === "network" &&
    (err.shortReason.includes("timeout") ||
      lowerRaw.includes("timed out") ||
      lowerRaw.includes("timeout"))
  );
}

function buildProviderFailure(
  provider: AiProviderName,
  model: string,
  err: ClassifiedGeminiError,
  elapsedMs: number,
  explicitTimeout = false
): ProviderAttemptFailure {
  return {
    provider,
    model,
    status: err.upstreamStatus ?? err.status ?? null,
    message: err.rawMessage || err.detail,
    timeout: explicitTimeout || isTimeoutFailure(err),
    code: err.code,
    reason: err.shortReason,
    elapsedMs,
  };
}

export interface StructuredGenerationOptions<T> {
  tier?: "flash" | "pro";
  preferFastModel?: boolean;
  contents: string;
  responseSchema: Schema;
  routeName?: string;
  maxOutputTokens?: number;
  fallbackMaxTokens?: number;
  systemInstruction?: string;
  temperature?: number;
  timeoutMs?: number;
  fallbackTimeoutMs?: number;
  disableThinking?: boolean;
  validate?: (data: T) => string | null;
}

export type HybridModelResult<T> =
  | {
      ok: true;
      data: T;
      modelUsed: string;
      providerUsed: AiProviderName;
      attempts: number;
    }
  | {
      ok: false;
      error: ClassifiedGeminiError;
      attempts: number;
      providerFailures?: ProviderAttemptFailure[];
    };

function extractOutermostJsonSlice(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = firstBrace !== -1 ? firstBrace : firstBracket;
  }
  if (start === -1) return cleaned;

  const openChar = cleaned[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }
  return cleaned.slice(start);
}

function parseStructuredJson<T>(
  rawText: string,
  model: string,
  finishReason: string | undefined,
  maxOutputTokens: number | undefined,
  validate?: (data: T) => string | null
): { ok: true; data: T } | { ok: false; error: ClassifiedGeminiError } {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: T;
  try {
    parsed = JSON.parse(stripped) as T;
  } catch (firstErr) {
    const extracted = extractOutermostJsonSlice(stripped);
    try {
      parsed = JSON.parse(extracted) as T;
    } catch {
      return {
        ok: false,
        error: parseGeminiJsonError(
          model,
          firstErr,
          finishReason,
          stripped.length,
          maxOutputTokens
        ),
      };
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      error: parseGeminiJsonError(
        model,
        new Error("Parsed JSON root is not an object"),
        finishReason,
        stripped.length,
        maxOutputTokens
      ),
    };
  }

  if (validate) {
    const validationReason = validate(parsed);
    if (validationReason) {
      return {
        ok: false,
        error: incompleteGeminiResponseError(model, validationReason, finishReason),
      };
    }
  }

  return { ok: true, data: parsed };
}

function formatSchemaSkeleton(schema: Schema, depth = 0): string {
  if (!schema || depth > 5) return "any";
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((v) => JSON.stringify(v)).join("|");
  }
  const t = String(schema.type ?? "").toUpperCase();
  if (t === "OBJECT" && schema.properties) {
    const entries = Object.entries(schema.properties).map(
      ([k, v]) => `${JSON.stringify(k)}:${formatSchemaSkeleton(v, depth + 1)}`
    );
    return `{${entries.join(",")}}`;
  }
  if (t === "ARRAY" && schema.items) {
    return `[${formatSchemaSkeleton(schema.items, depth + 1)}]`;
  }
  if (t === "BOOLEAN") return "boolean";
  if (t === "NUMBER" || t === "INTEGER") return "number";
  return "string";
}

export const AUTOFILL_SYSTEM_INSTRUCTION =
  "Strict English-only lexicographer for an English-Indonesian vocabulary vault. First verify whether the input is a real, established English word, phrasal verb, idiom, collocation, or genuine English slang/loanword used in English dictionaries. Strictly reject non-English words (including Indonesian/Malay words or slang such as 'goblok', 'anjay', 'baper', 'makan', 'gabut', or other foreign words not used in English) and gibberish by setting is_valid_english=false. Return complete, valid JSON matching the exact schema. Strictly separate Register (Casual, Formal, Academic, Slang) from CEFR level (A1-C2) using Cambridge English Dictionary / English Vocabulary Profile (EVP) and Oxford 3000/5000 standards. Never downgrade opaque/figurative idioms to B1/B2 just because their register is Casual. For idioms (type='idiom'), always return word_families=[]. Never invent fake derivatives, non-English examples, or placeholder text.";

export const REGISTER_CLASSIFICATION_RULE =
  'Strict register rule (INDEPENDENT of CEFR): "Formal" is STRICTLY reserved for elevated formal, official, diplomatic, legal, or polished business/written vocabulary (e.g. "furthermore", "commence", "notwithstanding"); "Academic" is strictly for scholarly, scientific, research, or analytical discourse (e.g. "hypothesis", "empirical", "corroborate"); "Slang" is for very informal street/youth/internet colloquialisms (e.g. "spill the tea", "ghosting", "rizz"); tag all everyday greetings, basic/neutral concrete nouns/verbs/adjectives, and conversational expressions (e.g. "hi", "hello", "apple", "good", "play it by ear", "break the ice") as "Casual" — NEVER classify basic or everyday words as "Formal".';

export const CEFR_CALIBRATION_RULE =
  'Strict CEFR calibration rule (Cambridge English Dictionary / English Vocabulary Profile [EVP] & Oxford 3000/5000): NEVER conflate Register (Casual/Formal/Academic/Slang) with CEFR level (A1-C2). Register measures social tone; CEFR measures lexical proficiency. Calibration anchors: A1 = core starter words ("hi", "hello", "apple", "good"); A2 = basic everyday words ("holiday", "weather", "borrow"); B1 = intermediate everyday words ("achieve", "opinion", "environment"); B2 = upper-intermediate / Oxford 5000 words ("sustainable", "negotiate", "crucial"); C1-C2 = advanced/proficient vocabulary ("ubiquitous"=C1, "pragmatic"=C1, "mitigate"=C1, "ephemeral"=C2, "obfuscate"=C2) AND opaque/figurative idioms even when their register is Casual — e.g. "play it by ear" (C1, Casual), "bite the bullet" (C1/C2, Casual), "call it a day" (C1, Casual), "cut corners" (C1, Casual), "burn the midnight oil" (C1/C2, Casual). NEVER downgrade an opaque figurative idiom to B1/B2 merely because it is conversational, and NEVER inflate basic A1-B1 words to B2/C1.';

export const IDIOM_WORD_FAMILY_RULE =
  'Idiom word_families rule: When type is "idiom", ALWAYS return an empty array [] for word_families (or word_families_json). NEVER output literal root-word derivatives (e.g., do NOT return play (verb) or player (noun) for "play it by ear") and do NOT repeat the idiom itself.';

export const CHUNKS_GENERATION_RULE =
  'Lexical chunks rule: Always return "chunks" with 2-3 natural, high-frequency native English phrases/collocations containing the target expression that learners can drop directly into speaking or writing (e.g. for "pivotal" -> ["play a pivotal role in", "at a pivotal moment", "a pivotal turning point"]). For idioms (type="idiom"), return 2-3 natural sentence frames or starters using the idiom naturally (e.g. for "burn the midnight oil" -> ["have been burning the midnight oil to...", "had to burn the midnight oil before...", "often burn the midnight oil when..."]). Keep each chunk concise (3-7 words, no markdown).';

export const SENTENCE_GRADING_SYSTEM_INSTRUCTION =
  'Fair, constructive, and encouraging native English writing coach grading practice sentences. Follow these core rules strictly: (1) Accept natural grammatical adaptations: NEVER penalize the user for conjugating verbs, changing tenses (e.g. past tense "I burnt the midnight oil..." or "I burned the midnight oil..." for "burn the midnight oil"), changing pronouns or possessives, adjusting articles/plurals, or using valid UK/US spelling variants (burnt/burned, colour/color, realise/realize, etc.). As long as the word or idiom is used accurately in meaning and natural context, score it fairly (pass / high score). (2) Focus on real errors: only deduct significant points for wrong meaning, unnatural collocation, missing target expression, or clear grammar errors—NOT for adapting the base dictionary form. (3) Second-person tone (MANDATORY): ALWAYS address the user directly as "You" / "Your" in English (or "Kamu" in Indonesian) in feedback and tips. NEVER write "The learner", "The user", "The student", "Pelajar", "Pengguna", or "Siswa". Return strictly valid JSON matching the requested schema.';

export function buildSentenceGradingPrompt(params: {
  term: string;
  meaning: string;
  register: string;
  wordFamiliesText: string;
  sentence: string;
  lang: "en" | "id";
}): string {
  const { term, meaning, register, wordFamiliesText, sentence, lang } = params;
  const isEn = lang === "en";

  if (isEn) {
    return `You are a fair, constructive native English writing coach giving direct one-on-one feedback.
Target expression: "${term}"
Definition: "${meaning}"
Expected register: "${register}"
Allowed word-family / inflected forms: ${wordFamiliesText || term}
Sentence to evaluate: "${sentence}"

Evaluate whether "${term}" (or any natural grammatical adaptation, tense/verb conjugation, pronoun change, UK/US spelling variant, or valid word-family form) is used accurately in meaning, grammar, and natural context.

CORE GRADING RULES (MUST FOLLOW):
1. ACCEPT NATURAL GRAMMATICAL ADAPTATIONS: Do NOT penalize conjugating verbs, changing tenses (e.g. past tense "I burnt the midnight oil..." or "I burned the midnight oil..." for "burn the midnight oil"), changing pronouns/possessives ("my", "their", "his"), adjusting articles/plurals, or using valid UK/US spelling variants (burnt/burned, colour/color, realise/realize, etc.). If the meaning and context are accurate and natural, award a passing / high score (70–100).
2. FOCUS ON REAL ERRORS: Only deduct significant points for wrong meaning, unnatural collocation, missing the target expression, or clear grammar mistakes—NEVER deduct points simply because the sentence adapted the base dictionary form to fit grammar or tense.
3. SECOND-PERSON TONE ONLY: Always address the writer directly as "You" / "Your" in both "feedback_id" and "tip". NEVER use third-person labels like "The learner", "The user", or "The student".

SCORING RUBRIC (MUST FOLLOW):
- 0 to 10 ("No Valid Attempt", is_correct=false): Empty, < 3 words, random gibberish/keyboard mash, non-English refusal, or non-attempts like "idunno", "idk", "skip", "test". NEVER give 35 for non-attempts!
- 20 to 45 ("Needs Work", is_correct=false): A real, complete English sentence, BUT either did not use the target expression (or any valid adaptation/inflection of it) OR used it with the wrong meaning/context.
- 46 to 69 ("Needs Work", is_correct=false): Uses the target expression with partial understanding, but has clear grammar errors, unnatural collocation, or unclear context.
- 70 to 84 ("Good", is_correct=true): Clear, understandable, mostly natural English sentence using the target expression (including natural tense/pronoun/UK-US adaptations) accurately, with only minor phrasing or grammar tweaks.
- 85 to 100 ("Natural", is_correct=true): Idiomatic, accurate meaning, natural grammar (including conjugated/adapted forms and valid UK/US spellings), and fitting register.

Return strictly valid JSON (ALL feedback and tips MUST be in natural English — ZERO Indonesian):
- "is_correct": boolean (true ONLY if "Natural" or "Good", false otherwise)
- "verdict": exactly one of "Natural", "Good", "Needs Work", or "No Valid Attempt"
- "score": integer 0-100 following the rubric above
- "feedback_id": specific, warm, constructive feedback in ENGLISH (2 sentences max) addressing the writer directly as "You" (NEVER "The learner", "The user", or "The student").
- "native_rewrite": a polished, natural native-speaker English sentence using "${term}" (preserving the sentence's natural tense/meaning if it was already valid).
- "tip": 1 short actionable tip in ENGLISH addressed directly to "You" on register, collocation, or phrasing.`;
  }

  return `You are a fair, constructive native English writing coach giving direct one-on-one feedback in Indonesian.
Target expression: "${term}"
Indonesian meaning: "${meaning}"
Expected register: "${register}"
Allowed word-family / inflected forms: ${wordFamiliesText || term}
Sentence to evaluate: "${sentence}"

Evaluate whether "${term}" (or any natural grammatical adaptation, tense/verb conjugation, pronoun change, UK/US spelling variant, or valid word-family form) is used accurately in meaning, grammar, and natural context.

CORE GRADING RULES (MUST FOLLOW):
1. ACCEPT NATURAL GRAMMATICAL ADAPTATIONS: Do NOT penalize conjugating verbs, changing tenses (e.g. past tense "I burnt the midnight oil..." or "I burned the midnight oil..." for "burn the midnight oil"), changing pronouns/possessives ("my", "their", "his"), adjusting articles/plurals, or using valid UK/US spelling variants (burnt/burned, colour/color, realise/realize, etc.). If the meaning and context are accurate and natural, award a passing / high score (70–100).
2. FOCUS ON REAL ERRORS: Only deduct significant points for wrong meaning, unnatural collocation, missing the target expression, or clear grammar mistakes—NEVER deduct points simply because the sentence adapted the base dictionary form to fit grammar or tense.
3. SECOND-PERSON TONE ONLY: Always address the writer directly as "Kamu" (second-person) in both "feedback_id" and "tip". NEVER use third-person labels like "Pelajar", "Pengguna", "Siswa", "The learner", "The user", or "The student".

SCORING RUBRIC (MUST FOLLOW):
- 0 to 10 ("Belum Menjawab / Tidak Valid", is_correct=false): Empty, < 3 words, random gibberish/keyboard mash, non-English/Indonesian-only refusal, or non-attempts like "idunno", "idk", "skip", "ga tau", "test". NEVER give 35 for non-attempts!
- 20 to 45 ("Kurang Tepat", is_correct=false): A real, complete English sentence, BUT either did not use the target expression (or any valid adaptation/inflection of it) OR used it with the wrong meaning/context.
- 46 to 69 ("Kurang Tepat", is_correct=false): Uses the target expression with partial understanding, but has clear grammar errors, unnatural collocation, or unclear context.
- 70 to 84 ("Cukup Baik", is_correct=true): Clear, understandable, mostly natural English sentence using the target expression (including natural tense/pronoun/UK-US adaptations) accurately, with only minor phrasing or grammar tweaks.
- 85 to 100 ("Natural", is_correct=true): Idiomatic, accurate meaning, natural grammar (including conjugated/adapted forms and valid UK/US spellings), and fitting register.

Return strictly valid JSON:
- "is_correct": boolean (true ONLY if Natural or Cukup Baik, false otherwise)
- "verdict": exactly one of "Natural", "Cukup Baik", "Kurang Tepat", or "Belum Menjawab / Tidak Valid"
- "score": integer 0-100 following the rubric above
- "feedback_id": specific, warm, constructive feedback in Indonesian (2 sentences max) addressing the writer directly as "Kamu" (NEVER "Pelajar", "Pengguna", "Siswa", or "The learner").
- "native_rewrite": a polished, natural native-speaker English sentence using "${term}" (preserving the sentence's natural tense/meaning if it was already valid; if there wasn't a real idea, provide a clean everyday example sentence using "${term}").
- "tip": 1 short actionable tip in Indonesian addressed directly to "Kamu" on register, collocation, or phrasing.`;
}

export function buildAutofillPrompt(params: {
  term: string;
  sourceTag?: string;
  lang: "en" | "id";
  existingCsv: string;
}): string {
  const { term, sourceTag, lang, existingCsv } = params;
  const hasExisting = existingCsv !== "none";
  const duplicateBlock = hasExisting
    ? `STEP 2 — DUPLICATE CHECK (only when is_valid_english=true):
Existing Vault terms: ${existingCsv}
Check if "${term}" is an exact, inflectional, morphological, or phrase variant of ANY existing Vault term (e.g. "spilling the tea" matches "spill the tea", "gentrify" matches "gentrified").
- If YES: set duplicate=true and existing_term="<exact matched term from list>".
- If NO: set duplicate=false, existing_term="", and populate ALL dictionary fields below completely and accurately.`
    : `STEP 2 — DICTIONARY ENTRY (only when is_valid_english=true):
Populate ALL dictionary fields below completely and accurately.`;

  return `Evaluate and (if valid English) create a complete bilingual English-Indonesian dictionary card for "${term}" (source: ${sourceTag || "general"}, ui: ${lang}).

STEP 1 — STRICT ENGLISH-ONLY VALIDATION (MANDATORY):
Determine whether "${term}" is a valid, established English word, phrasal verb, idiom, collocation, or genuine English slang (accepted English loanwords like "café", "cliché", "déjà vu" are valid).
- If "${term}" is NOT English (e.g. Indonesian/Malay words or slang like "goblok", "anjing", "mantap", "makan", "baper", "gabut", foreign words from other languages not established in English, gibberish, keyboard mash like "asdfgh", or nonsense):
  Set is_valid_english=false${hasExisting ? ', duplicate=false, existing_term=""' : ""}, set all string fields to "" (and cefr="A1", type="vocab", register="Casual"), and set all array fields to []. Do NOT translate non-English words or write non-English example sentences.
- If "${term}" IS valid English: set is_valid_english=true and continue to Step 2.

${duplicateBlock}

Required fields (when is_valid_english=true and not a duplicate):
- is_valid_english: true
- term: canonical English spelling/casing
- pronunciation: Google "Sounds like" phonetic spelling with "·" syllable dots & ALL CAPS primary stress (e.g. "am·BIV·uh·luhnt")
- ipa: standard IPA inside slashes (e.g. "/æmˈbɪv.ə.lənt/")
- cefr: true, objective CEFR level ("A1", "A2", "B1", "B2", "C1", or "C2") — ${CEFR_CALIBRATION_RULE}
- type: vocab, idiom, or collocation
- register: "Casual", "Formal", "Academic", or "Slang" — ${REGISTER_CLASSIFICATION_RULE}
- meaning_en: 1 clear, natural English definition (figurative meaning for idioms)
- meaning_id: 1 clear, natural Indonesian definition (figurative meaning for idioms, never literal word-by-word)
- examples: 2 natural ENGLISH example sentences (1 Daily, 1 Academic) wrapping the target term in **bold**, each with natural Indonesian translation_id and context
- synonyms: 2–4 register-matched English synonyms
- antonyms: 1–3 contrasting English antonyms (or contextual opposites)
- word_families: 1–4 real English {word, pos} morphological forms for vocab/collocation ONLY; ${IDIOM_WORD_FAMILY_RULE}
- chunks: 2–3 natural, practical native English lexical chunks / collocations (or natural sentence frames/starters for idioms); ${CHUNKS_GENERATION_RULE}`;
}

function buildBackupSystemPrompt(
  systemInstruction: string | undefined,
  schema: Schema
): string {
  const skeleton = formatSchemaSkeleton(schema);
  const base =
    systemInstruction?.trim() ||
    "Precise bilingual English-Indonesian lexicographer.";
  const registerHint = skeleton.includes('"register":')
    ? `\n${REGISTER_CLASSIFICATION_RULE}`
    : "";
  const cefrHint = skeleton.includes('"cefr":')
    ? `\n${CEFR_CALIBRATION_RULE}`
    : "";
  const idiomHint =
    skeleton.includes('"word_families":') ||
    skeleton.includes('"word_families_json":')
      ? `\n${IDIOM_WORD_FAMILY_RULE}`
      : "";
  const chunksHint = skeleton.includes('"chunks":')
    ? `\n${CHUNKS_GENERATION_RULE}`
    : "";
  return `${base}${registerHint}${cefrHint}${idiomHint}${chunksHint}
CRITICAL: Return ONLY a single valid raw JSON object matching this exact schema (no markdown fences, no commentary, no placeholders):
${skeleton}`;
}

async function invokeModelStructuredOnce<T>(
  ai: GoogleGenAI,
  model: string,
  contents: string,
  responseSchema: Schema,
  options: {
    routeName: string;
    maxOutputTokens?: number;
    systemInstruction?: string;
    temperature?: number;
    timeoutMs: number;
    disableThinking: boolean;
    validate?: (data: T) => string | null;
  }
): Promise<{ ok: true; data: T } | { ok: false; error: ClassifiedGeminiError }> {
  const modelKey = model.toLowerCase();
  const initialThinkingConfig = options.disableThinking
    ? resolveThinkingConfigForModel(model)
    : undefined;
  const callDeadline = Date.now() + options.timeoutMs;

  const runCall = async (thinkingConfig?: ThinkingConfig) => {
    const remainingMs = Math.max(1000, callDeadline - Date.now());
    const controller = new AbortController();
    let didTimeout = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new Error(`Gemini timeout after ${remainingMs}ms`));
      }, remainingMs);
    });

    try {
      const config: GenerateContentConfig = {
        responseMimeType: "application/json",
        responseSchema,
        abortSignal: controller.signal,
      };
      if (typeof options.maxOutputTokens === "number") {
        config.maxOutputTokens = options.maxOutputTokens;
      }
      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (typeof options.temperature === "number") {
        config.temperature = options.temperature;
      }
      if (thinkingConfig) {
        config.thinkingConfig = thinkingConfig;
      }

      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents,
          config,
        }),
        timeoutPromise,
      ]);

      const finishReason = response.candidates?.[0]?.finishReason;
      const rawText = response.text?.trim() ?? "";
      if (!rawText) {
        return {
          ok: false as const,
          error: emptyGeminiResponseError(model, finishReason),
        };
      }

      const cleanedText = rawText;
      return parseStructuredJson<T>(
        cleanedText,
        model,
        finishReason,
        options.maxOutputTokens,
        options.validate
      );
    } catch (err) {
      if (didTimeout) {
        return {
          ok: false as const,
          error: timeoutGeminiError(model, options.timeoutMs),
        };
      }

      // If this model returned HTTP 400 rejecting our thinkingConfig, cache it and retry this SAME model immediately without thinkingConfig
      if (thinkingConfig && isThinkingConfigRejection(err)) {
        modelsRejectingThinkingConfig.add(modelKey);
        console.info(
          `[LexiVault][${options.routeName}] Model "${model}" rejected thinkingConfig (${extractErrorMessage(
            err
          ).slice(0, 140)}); cached & retrying SAME model without thinkingConfig`
        );
        return null;
      }

      return { ok: false as const, error: classifyGeminiError(err) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const first = await runCall(initialThinkingConfig);
  if (first !== null) return first;

  // Immediate retry on the SAME model without thinkingConfig (bounded by the same strict deadline)
  if (callDeadline - Date.now() < 1500) {
    return {
      ok: false,
      error: timeoutGeminiError(model, options.timeoutMs),
    };
  }
  const second = await runCall(undefined);
  return second ?? { ok: false, error: emptyGeminiResponseError(model) };
}

/**
 * Fast, resilient structured JSON Gemini execution:
 * 1. Uses generation-correct minimal thinking config (Gemini 3.x -> `thinkingLevel: MINIMAL`; Gemini 2.5 Flash -> `thinkingBudget: 0`), auto-retrying the SAME model without `thinkingConfig` if rejected with HTTP 400.
 * 2. Smart 5-minute circuit-breaker: skips models currently in 503/429/404 cooldown immediately (0ms delay).
 * 3. Balanced 6.5s/9.5s per-attempt AbortController timeout and capped 1-model Gemini fallback before failing over to Groq / Cloudflare Workers AI.
 * 4. Explicitly classifies & logs timeout, MAX_TOKENS JSON truncation, JSON parse errors, incomplete output, HTTP 400, and HTTP 503.
 */
async function runGeminiTier<T>({
  tier = "flash",
  preferFastModel = false,
  contents,
  responseSchema,
  routeName = "gemini-structured",
  maxOutputTokens,
  systemInstruction,
  temperature,
  timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  disableThinking = true,
  validate,
}: StructuredGenerationOptions<T>): Promise<HybridModelResult<T>> {
  const apiKey = await resolveGeminiApiKey();
  const providerFailures: ProviderAttemptFailure[] = [];
  if (!apiKey) {
    const missingErr = missingGeminiKeyError();
    logGeminiRouteError(routeName, missingErr);
    providerFailures.push(
      buildProviderFailure("gemini", "unconfigured", missingErr, 0)
    );
    return { ok: false, error: missingErr, attempts: 0, providerFailures };
  }

  const ai = new GoogleGenAI({ apiKey });
  const flashModel = preferFastModel
    ? await getGeminiFastModel()
    : await getGeminiModel();
  const proModel = await getGeminiProModel();
  const primaryModel = tier === "pro" ? proModel : flashModel;
  const invokeOptions = {
    routeName,
    maxOutputTokens,
    systemInstruction,
    temperature,
    timeoutMs,
    disableThinking,
    validate,
  };

  let attempts = 0;
  let primaryError: ClassifiedGeminiError | null = null;
  const providerDeadline = Date.now() + timeoutMs;
  const primaryInCooldown = isModelInCooldown(primaryModel);

  // Fast path: if primary model is healthy (not in 5m cooldown), try it first
  if (!primaryInCooldown) {
    attempts += 1;
    const attemptStartedAt = Date.now();
    const res = await invokeModelStructuredOnce<T>(
      ai,
      primaryModel,
      contents,
      responseSchema,
      invokeOptions
    );
    if (res.ok) {
      return {
        ok: true,
        data: res.data,
        modelUsed: primaryModel,
        providerUsed: "gemini",
        attempts,
      };
    }

    primaryError = res.error;
    providerFailures.push(
      buildProviderFailure(
        "gemini",
        primaryModel,
        res.error,
        Date.now() - attemptStartedAt
      )
    );
    console.warn(
      `[LexiVault][${routeName}] Primary "${primaryModel}" failed (${res.error.shortReason})`
    );
    if (
      shouldCooldownModelForError(res.error) ||
      res.error.code === "network"
    ) {
      markModelCooldown(primaryModel, res.error.shortReason);
    }

    if (res.error.code === "auth") {
      return { ok: false, error: res.error, attempts, providerFailures };
    }
  } else {
    console.info(
      `[LexiVault][${routeName}] Circuit-breaker skipped "${primaryModel}" (in 5m cooldown)`
    );
  }

  // Only try at most 1 healthy Gemini fallback if primary was already in cooldown or rejected schema/model
  // AND there is still meaningful time left inside the strict Gemini provider deadline.
  const remainingBeforeFallback = providerDeadline - Date.now();
  const shouldUseFallbacks =
    remainingBeforeFallback >= 2500 &&
    (primaryInCooldown ||
      (primaryError !== null && isFallbackEligibleError(primaryError)));

  if (shouldUseFallbacks) {
    const excludeSoFar = [primaryModel];
    const manualFallbacks = await getGeminiFallbackModels(excludeSoFar);
    const proFlashFallback =
      tier === "pro" && primaryModel !== flashModel ? [flashModel] : [];
    const discoveredFallbacks = await discoverAvailableFallbackModels(apiKey, [
      ...excludeSoFar,
      ...proFlashFallback,
      ...manualFallbacks,
    ]);
    if (preferFastModel && discoveredFallbacks.length > 1) {
      discoveredFallbacks.sort(
        (a, b) => scoreDiscoveredModel(b, true) - scoreDiscoveredModel(a, true)
      );
    }

    const seen = new Set<string>([primaryModel.toLowerCase()]);
    const healthyFallbacks: string[] = [];

    for (const candidate of [
      ...proFlashFallback,
      ...manualFallbacks,
      ...discoveredFallbacks,
    ]) {
      const k = candidate.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      if (!isModelInCooldown(candidate)) {
        healthyFallbacks.push(candidate);
      }
    }

    const candidatesToTry = healthyFallbacks.slice(0, MAX_FALLBACK_MODELS);

    for (const fallbackModel of candidatesToTry) {
      const remainingMs = providerDeadline - Date.now();
      if (remainingMs < 1500) break;

      attempts += 1;
      const attemptStartedAt = Date.now();
      const res = await invokeModelStructuredOnce<T>(
        ai,
        fallbackModel,
        contents,
        responseSchema,
        { ...invokeOptions, timeoutMs: remainingMs }
      );

      if (res.ok) {
        return {
          ok: true,
          data: res.data,
          modelUsed: fallbackModel,
          providerUsed: "gemini",
          attempts,
        };
      }

      providerFailures.push(
        buildProviderFailure(
          "gemini",
          fallbackModel,
          res.error,
          Date.now() - attemptStartedAt
        )
      );
      if (
        shouldCooldownModelForError(res.error) ||
        res.error.code === "network"
      ) {
        markModelCooldown(fallbackModel, res.error.shortReason);
      }
      if (!primaryError) {
        primaryError = res.error;
      }
      console.warn(
        `[LexiVault][${routeName}] Gemini fallback "${fallbackModel}" failed (${res.error.shortReason})`
      );
    }
  }

  const finalError = primaryError ?? emptyGeminiResponseError(primaryModel);
  return {
    ok: false,
    error: finalError,
    attempts,
    providerFailures,
  };
}

/**
 * Tier 2 — Groq optional ultra-fast backup (`llama-3.1-8b-instant` / `llama-3.3-70b-versatile`).
 * Skipped in 0ms whenever `GROQ_API_KEY` is not set.
 */
async function runGroqTier<T>(
  options: StructuredGenerationOptions<T>
): Promise<HybridModelResult<T> | null> {
  const groqKey = await resolveRuntimeEnvVar("GROQ_API_KEY");
  if (!groqKey) return null;

  const routeName = options.routeName ?? "gemini-structured";
  const configuredModel =
    (await resolveRuntimeEnvVar("GROQ_MODEL")) || GROQ_DEFAULT_MODEL;
  const modelsToTry =
    configuredModel === "llama-3.3-70b-versatile"
      ? [configuredModel]
      : [configuredModel, "llama-3.3-70b-versatile"];
  const maxTokens =
    options.fallbackMaxTokens ??
    Math.min(options.maxOutputTokens ?? 1600, 2400);
  const sysPrompt = buildBackupSystemPrompt(
    options.systemInstruction,
    options.responseSchema
  );

  let attempts = 0;
  let lastError: ClassifiedGeminiError | null = null;
  const providerFailures: ProviderAttemptFailure[] = [];
  const providerTimeoutMs = options.fallbackTimeoutMs ?? GROQ_TIMEOUT_MS;
  const providerDeadline = Date.now() + providerTimeoutMs;

  for (const model of modelsToTry) {
    const remainingMs = providerDeadline - Date.now();
    if (remainingMs < 1500) break;

    attempts += 1;
    const attemptStartedAt = Date.now();
    const controller = new AbortController();
    let didTimeout = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new Error(`Groq timeout after ${remainingMs}ms`));
      }, remainingMs);
    });

    try {
      const fetchAndRead = async () => {
        const res = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: options.contents },
            ],
            response_format: { type: "json_object" },
            max_tokens: maxTokens,
            temperature: 0.2,
          }),
        });

        if (!res.ok) {
          const bodySnippet = (await res.text().catch(() => "")).slice(0, 200);
          return { ok: false as const, status: res.status, bodySnippet };
        }

        const json = (await res.json()) as {
          choices?: Array<{
            finish_reason?: string;
            message?: { content?: string };
          }>;
        };
        return { ok: true as const, json };
      };

      const outcome = await Promise.race([fetchAndRead(), timeoutPromise]);

      if (!outcome.ok) {
        lastError = classifyGeminiError(
          new Error(`Groq HTTP ${outcome.status}: ${outcome.bodySnippet}`)
        );
        providerFailures.push(
          buildProviderFailure(
            "groq",
            model,
            lastError,
            Date.now() - attemptStartedAt
          )
        );
        console.warn(
          `[LexiVault][${routeName}] Tier 2 groq (${model}) failed (${lastError.shortReason})`
        );
        if (
          outcome.status === 401 ||
          outcome.status === 403 ||
          outcome.status === 429 ||
          outcome.status === 503
        ) {
          break;
        }
        continue;
      }

      const content = outcome.json.choices?.[0]?.message?.content?.trim() ?? "";
      const finishReason =
        outcome.json.choices?.[0]?.finish_reason?.toUpperCase();
      if (!content) {
        lastError = emptyGeminiResponseError(model, finishReason);
        providerFailures.push(
          buildProviderFailure(
            "groq",
            model,
            lastError,
            Date.now() - attemptStartedAt
          )
        );
        continue;
      }

      const parsed = parseStructuredJson<T>(
        content,
        model,
        finishReason === "LENGTH" ? "MAX_TOKENS" : finishReason,
        maxTokens,
        options.validate
      );
      if (parsed.ok) {
        return {
          ok: true,
          data: parsed.data,
          modelUsed: model,
          providerUsed: "groq",
          attempts,
        };
      }
      lastError = parsed.error;
      providerFailures.push(
        buildProviderFailure(
          "groq",
          model,
          lastError,
          Date.now() - attemptStartedAt
        )
      );
      console.warn(
        `[LexiVault][${routeName}] Tier 2 groq (${model}) invalid JSON (${parsed.error.shortReason})`
      );
    } catch (err) {
      lastError = didTimeout
        ? timeoutGeminiError(model, remainingMs)
        : classifyGeminiError(err);
      providerFailures.push(
        buildProviderFailure(
          "groq",
          model,
          lastError,
          Date.now() - attemptStartedAt,
          didTimeout
        )
      );
      console.warn(
        `[LexiVault][${routeName}] Tier 2 groq (${model}) error (${lastError.shortReason})`
      );
      if (didTimeout || lastError.code === "network") {
        break;
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return lastError
    ? { ok: false, error: lastError, attempts, providerFailures }
    : null;
}

async function resolveWorkersAiBinding(): Promise<
  CloudflareEnv["AI"] | undefined
> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    return ctx?.env?.AI;
  } catch {
    return undefined;
  }
}

function extractWorkersAiOutput(result: unknown): {
  text?: string;
  object?: unknown;
} {
  if (typeof result === "string") return { text: result };
  if (result && typeof result === "object") {
    const record = result as {
      response?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    if (typeof record.response === "string") {
      return { text: record.response };
    }
    if (record.response && typeof record.response === "object") {
      return { object: record.response };
    }
    const choiceText = record.choices?.[0]?.message?.content;
    if (typeof choiceText === "string") {
      return { text: choiceText };
    }
  }
  return {};
}

/**
 * Tier 3 — Cloudflare Workers AI zero-account native binding backup
 * (`@cf/meta/llama-3.1-8b-instruct-fast` -> `@cf/meta/llama-3.1-8b-instruct`).
 */
async function runWorkersAiTier<T>(
  options: StructuredGenerationOptions<T>
): Promise<HybridModelResult<T> | null> {
  const aiBinding = await resolveWorkersAiBinding();
  if (!aiBinding || typeof aiBinding.run !== "function") {
    return null;
  }

  const routeName = options.routeName ?? "gemini-structured";
  const maxTokens =
    options.fallbackMaxTokens ??
    Math.min(options.maxOutputTokens ?? 1500, 2048);
  const sysPrompt = buildBackupSystemPrompt(
    options.systemInstruction,
    options.responseSchema
  );

  let attempts = 0;
  let lastError: ClassifiedGeminiError | null = null;
  const providerFailures: ProviderAttemptFailure[] = [];
  const providerTimeoutMs = options.fallbackTimeoutMs ?? CF_AI_TIMEOUT_MS;
  const providerDeadline = Date.now() + providerTimeoutMs;

  for (const cfModel of CF_AI_MODELS) {
    const remainingMs = providerDeadline - Date.now();
    if (remainingMs < 1500) break;

    attempts += 1;
    const attemptStartedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let didTimeout = false;

    try {
      const runPromise = aiBinding.run(cfModel, {
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: options.contents },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          didTimeout = true;
          reject(new Error(`Workers AI timeout after ${remainingMs}ms`));
        }, remainingMs);
      });

      const rawResult = await Promise.race([runPromise, timeoutPromise]);
      const extracted = extractWorkersAiOutput(rawResult);

      const rawText =
        extracted.text ??
        (extracted.object ? JSON.stringify(extracted.object) : "");
      if (!rawText.trim()) {
        lastError = emptyGeminiResponseError(cfModel);
        providerFailures.push(
          buildProviderFailure(
            "cf-workers-ai",
            cfModel,
            lastError,
            Date.now() - attemptStartedAt
          )
        );
        continue;
      }

      const parsed = parseStructuredJson<T>(
        rawText,
        cfModel,
        undefined,
        maxTokens,
        options.validate
      );
      if (parsed.ok) {
        return {
          ok: true,
          data: parsed.data,
          modelUsed: cfModel,
          providerUsed: "cf-workers-ai",
          attempts,
        };
      }

      lastError = parsed.error;
      providerFailures.push(
        buildProviderFailure(
          "cf-workers-ai",
          cfModel,
          lastError,
          Date.now() - attemptStartedAt
        )
      );
      console.warn(
        `[LexiVault][${routeName}] Tier 3 cf-workers-ai (${cfModel}) invalid JSON (${parsed.error.shortReason})`
      );
    } catch (err) {
      lastError = didTimeout
        ? timeoutGeminiError(cfModel, remainingMs)
        : classifyGeminiError(err);
      providerFailures.push(
        buildProviderFailure(
          "cf-workers-ai",
          cfModel,
          lastError,
          Date.now() - attemptStartedAt,
          didTimeout
        )
      );
      console.warn(
        `[LexiVault][${routeName}] Tier 3 cf-workers-ai (${cfModel}) failed (${lastError.shortReason})`
      );
      if (didTimeout || lastError.code === "network") {
        break;
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return lastError
    ? { ok: false, error: lastError, attempts, providerFailures }
    : null;
}

/**
 * 3-Tier Multi-Provider Structured JSON Orchestrator:
 * Tier 1: Gemini (Primary, fast circuit-breaker + generation-aware thinkingConfig)
 * Tier 2: Groq (`llama-3.1-8b-instant`, optional if `GROQ_API_KEY` is configured)
 * Tier 3: Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast` via native `env.AI` binding)
 */
export async function generateStructuredWithHybridModel<T>(
  options: StructuredGenerationOptions<T>
): Promise<HybridModelResult<T>> {
  const routeName = options.routeName ?? "gemini-structured";
  const startedAt = Date.now();
  let totalAttempts = 0;
  const providerFailures: ProviderAttemptFailure[] = [];

  // Tier 1: Gemini (Primary)
  const geminiRes = await runGeminiTier<T>(options);
  totalAttempts += geminiRes.attempts;
  if (geminiRes.ok) {
    console.info(
      `[LexiVault][${routeName}] Served by gemini (${geminiRes.modelUsed}) in ${
        Date.now() - startedAt
      }ms`
    );
    return { ...geminiRes, attempts: totalAttempts };
  }
  if (geminiRes.providerFailures?.length) {
    providerFailures.push(...geminiRes.providerFailures);
  }
  console.warn(
    `[LexiVault][${routeName}] Provider "gemini" failed (${geminiRes.error.shortReason}: ${geminiRes.error.rawMessage.slice(
      0,
      160
    )}) -> failing over to groq`
  );

  // Tier 2: Groq (Optional fast backup — skipped in 0ms if GROQ_API_KEY unset)
  const groqRes = await runGroqTier<T>(options);
  if (groqRes) {
    totalAttempts += groqRes.attempts;
    if (groqRes.ok) {
      console.info(
        `[LexiVault][${routeName}] Served by groq (${groqRes.modelUsed}) in ${
          Date.now() - startedAt
        }ms (after gemini ${geminiRes.error.shortReason})`
      );
      return { ...groqRes, attempts: totalAttempts };
    }
    if (groqRes.providerFailures?.length) {
      providerFailures.push(...groqRes.providerFailures);
    }
    console.warn(
      `[LexiVault][${routeName}] Provider "groq" failed (${groqRes.error.shortReason}: ${groqRes.error.rawMessage.slice(
        0,
        160
      )}) -> failing over to cf-workers-ai`
    );
  }

  // Tier 3: Cloudflare Workers AI (Zero-account native `env.AI` backup)
  const cfRes = await runWorkersAiTier<T>(options);
  if (cfRes) {
    totalAttempts += cfRes.attempts;
    if (cfRes.ok) {
      console.info(
        `[LexiVault][${routeName}] Served by cf-workers-ai (${cfRes.modelUsed}) in ${
          Date.now() - startedAt
        }ms (after gemini ${geminiRes.error.shortReason})`
      );
      return { ...cfRes, attempts: totalAttempts };
    }
    if (cfRes.providerFailures?.length) {
      providerFailures.push(...cfRes.providerFailures);
    }
  }

  const elapsedMs = Date.now() - startedAt;

  // All available tiers failed — log exact per-provider failure reasons (provider, status, timeout)
  logGeminiRouteError(routeName, geminiRes.error, {
    totalAttempts,
    groqAttempted: Boolean(groqRes),
    cfWorkersAiAttempted: Boolean(cfRes),
    elapsedMs,
    providerFailures,
  });
  console.error(
    `[LexiVault][${routeName}] All AI providers failed (${totalAttempts} attempts, ${elapsedMs}ms):`,
    providerFailures.map((f) => ({
      provider: f.provider,
      status: f.status,
      message: f.message,
      model: f.model,
      timeout: f.timeout,
      code: f.code,
      reason: f.reason,
      elapsedMs: f.elapsedMs,
    }))
  );

  return {
    ok: false,
    error: geminiRes.error,
    attempts: totalAttempts,
    providerFailures,
  };
}

/**
 * Ensures raw linear 16-bit PCM audio bytes are wrapped in a valid 44-byte RIFF/WAV header.
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  if (
    pcmBuffer.length >= 12 &&
    pcmBuffer.toString("ascii", 0, 4) === "RIFF" &&
    pcmBuffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return pcmBuffer;
  }

  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}
