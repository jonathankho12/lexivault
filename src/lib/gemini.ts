import { GoogleGenAI, type Schema } from "@google/genai";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type GeminiErrorCode =
  | "missing_key"
  | "overload"
  | "rate_limit"
  | "auth"
  | "model"
  | "network"
  | "empty_response"
  | "api_error";

export interface ClassifiedGeminiError {
  status: number;
  upstreamStatus?: number;
  code: GeminiErrorCode;
  detail: string;
  rawMessage: string;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

// Retry primary model once after ~600ms short jittered backoff on 503/429/network before failing over
const PRIMARY_RETRY_BASE_MS = 600;
const MAX_FALLBACK_MODELS = 3;
const MODEL_DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes per Worker isolate
const MODEL_DISCOVERY_TIMEOUT_MS = 4000;

interface DiscoveredModelsCache {
  fetchedAt: number;
  keyHash: number;
  models: string[];
}

let discoveredModelsCache: DiscoveredModelsCache | null = null;

function cleanEnvValue(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * 150);
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

function hashKeyFingerprint(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

function scoreDiscoveredModel(modelId: string): number {
  const lower = modelId.toLowerCase();
  let score = 0;

  // Strongly prioritize fast/lightweight flash and flash-lite models
  if (lower.includes("flash-lite")) {
    score += 1060;
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

  // Prefer stable aliases over experimental, thinking-only, or dated snapshot versions
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
      `[LexiVault][gemini-discovery] Cached ${eligible.length} active generateContent models (top: ${eligible
        .slice(0, 5)
        .join(", ")})`
    );

    return eligible.filter((m) => !excluded.has(m.toLowerCase()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    console.warn("[LexiVault][gemini-discovery] Discovery skipped:", msg.slice(0, 160));
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function missingGeminiKeyError(): ClassifiedGeminiError {
  return {
    status: 503,
    code: "missing_key",
    detail:
      "GEMINI_API_KEY is not configured in Cloudflare Workers runtime bindings or environment variables.",
    rawMessage: "GEMINI_API_KEY missing in both Cloudflare env and process.env",
  };
}

export function emptyGeminiResponseError(model?: string): ClassifiedGeminiError {
  return {
    status: 502,
    code: "empty_response",
    detail: "Gemini AI returned an empty response. Please try again.",
    rawMessage: `Empty response body from model ${model || "unknown"}`,
  };
}

function extractUpstreamStatus(err: unknown, rawMessage: string): number | undefined {
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

  // Extract status code embedded in JSON/string error bodies like `"code":503` or `got status: 503`
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
  const errObj =
    err && typeof err === "object"
      ? (err as { message?: unknown })
      : null;

  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof errObj?.message === "string"
        ? errObj.message
        : String(err ?? "Unknown Gemini API error");

  const upstreamStatus = extractUpstreamStatus(err, rawMessage);
  const conciseRaw = rawMessage.slice(0, 320);
  const lower = rawMessage.toLowerCase();

  // 1. Temporary overload / high demand (503 UNAVAILABLE) — MUST be checked before "model"
  // because Google's 503 messages often contain phrases like "The model is overloaded."
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
      detail: "Gemini AI rate limit reached right now. Please try again in a moment.",
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
      detail: "Gemini API key is invalid, restricted, or unauthorized.",
      rawMessage: conciseRaw,
    };
  }

  // 4. Transient network / timeout errors
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("aborted")
  ) {
    return {
      status: 503,
      upstreamStatus,
      code: "network",
      detail: "Unable to reach Gemini AI right now (network timeout). Please try again.",
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
      detail: "Configured Gemini model is unavailable or rejected the request.",
      rawMessage: conciseRaw,
    };
  }

  return {
    status: 502,
    upstreamStatus,
    code: "api_error",
    detail: `Gemini AI request failed (${upstreamStatus ?? "upstream error"}). Please try again.`,
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
  return (
    err.code === "overload" ||
    err.code === "rate_limit" ||
    err.code === "network" ||
    err.code === "model"
  );
}

export function logGeminiRouteError(
  route: string,
  classified: ClassifiedGeminiError,
  extra?: Record<string, unknown>
): void {
  console.error(`[LexiVault][${route}] Gemini failure:`, {
    httpStatus: classified.status,
    upstreamStatus: classified.upstreamStatus ?? null,
    code: classified.code,
    detail: classified.detail,
    rawMessage: classified.rawMessage,
    ...(extra ?? {}),
  });
}

export type HybridModelResult<T> =
  | { ok: true; data: T; modelUsed: string; attempts: number }
  | { ok: false; error: ClassifiedGeminiError; attempts: number };

async function invokeModelStructuredOnce<T>(
  ai: GoogleGenAI,
  model: string,
  contents: string,
  responseSchema: Schema
): Promise<{ ok: true; data: T } | { ok: false; error: ClassifiedGeminiError }> {
  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });
    const text = response.text?.trim() ?? "";
    if (!text) {
      return { ok: false, error: emptyGeminiResponseError(model) };
    }
    const parsed = JSON.parse(text) as T;
    return { ok: true, data: parsed };
  } catch (err) {
    return { ok: false, error: classifyGeminiError(err) };
  }
}

/**
 * Executes a structured JSON Gemini generation with:
 * 1. Primary model (`GEMINI_MODEL`, default `gemini-3.8-flash`) + 1 fast retry (~600ms backoff)
 *    on transient 503 UNAVAILABLE / 429 / network errors.
 * 2. Automatic failover on persistent 503 / 429 / 404 to:
 *    - Optional manual `GEMINI_FALLBACK_MODELS` runtime env/binding, AND
 *    - Dynamically discovered active `flash` / `flash-lite` models via `/v1beta/models`
 *      (cached 10 min per Worker isolate), trying up to 3 fallback models.
 */
export async function generateStructuredWithHybridModel<T>({
  tier = "flash",
  contents,
  responseSchema,
  routeName = "gemini-structured",
}: {
  tier?: "flash" | "pro";
  contents: string;
  responseSchema: Schema;
  routeName?: string;
}): Promise<HybridModelResult<T>> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) {
    const missingErr = missingGeminiKeyError();
    logGeminiRouteError(routeName, missingErr);
    return { ok: false, error: missingErr, attempts: 0 };
  }

  const ai = new GoogleGenAI({ apiKey });
  const flashModel = await getGeminiModel();
  const proModel = await getGeminiProModel();
  const primaryModel = tier === "pro" ? proModel : flashModel;

  let attempts = 0;
  let primaryError: ClassifiedGeminiError | null = null;

  // Attempt 1 on primary model + 1 fast retry (~600ms) on 503/429/network
  for (let attemptIdx = 0; attemptIdx <= 1; attemptIdx += 1) {
    attempts += 1;
    const res = await invokeModelStructuredOnce<T>(
      ai,
      primaryModel,
      contents,
      responseSchema
    );

    if (res.ok) {
      return { ok: true, data: res.data, modelUsed: primaryModel, attempts };
    }

    primaryError = res.error;
    if (attemptIdx === 0 && isTransientGeminiError(res.error)) {
      console.warn(
        `[LexiVault][${routeName}] Primary model "${primaryModel}" returned ${res.error.code} (HTTP ${res.error.upstreamStatus ?? res.error.status}); retrying once after ~${PRIMARY_RETRY_BASE_MS}ms`
      );
      await sleepWithJitter(PRIMARY_RETRY_BASE_MS);
      continue;
    }

    logGeminiRouteError(routeName, res.error, {
      model: primaryModel,
      attempts,
    });
    break;
  }

  // Fail over to manual GEMINI_FALLBACK_MODELS + dynamically discovered available Flash models
  if (primaryError && isFallbackEligibleError(primaryError)) {
    const excludeSoFar = [primaryModel];
    const manualFallbacks = await getGeminiFallbackModels(excludeSoFar);
    const proFlashFallback =
      tier === "pro" && primaryModel !== flashModel ? [flashModel] : [];

    const discoveredFallbacks = await discoverAvailableFallbackModels(apiKey, [
      ...excludeSoFar,
      ...proFlashFallback,
      ...manualFallbacks,
    ]);

    const seen = new Set<string>([primaryModel.toLowerCase()]);
    const orderedFallbacks: string[] = [];
    for (const candidate of [
      ...proFlashFallback,
      ...manualFallbacks,
      ...discoveredFallbacks,
    ]) {
      const k = candidate.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      orderedFallbacks.push(candidate);
      if (orderedFallbacks.length >= MAX_FALLBACK_MODELS) break;
    }

    for (const fallbackModel of orderedFallbacks) {
      attempts += 1;
      const res = await invokeModelStructuredOnce<T>(
        ai,
        fallbackModel,
        contents,
        responseSchema
      );

      if (res.ok) {
        console.info(
          `[LexiVault][${routeName}] Fallback succeeded with model "${fallbackModel}" (after primary "${primaryModel}" failed with ${primaryError.code}, HTTP ${primaryError.upstreamStatus ?? primaryError.status})`
        );
        return { ok: true, data: res.data, modelUsed: fallbackModel, attempts };
      }

      console.warn(
        `[LexiVault][${routeName}] Fallback model "${fallbackModel}" failed (${res.error.code}, HTTP ${res.error.upstreamStatus ?? res.error.status}); trying next`
      );
    }
  }

  // Always preserve primary model's accurate error (never mask a 503 overload behind a fallback 404)
  return {
    ok: false,
    error: primaryError ?? emptyGeminiResponseError(primaryModel),
    attempts,
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
