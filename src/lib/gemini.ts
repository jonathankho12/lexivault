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

// Up to 2 automatic retries on primary model for transient 503/429/network spikes (~700ms, then ~1500ms + small jitter)
const RETRY_BASE_DELAYS_MS = [700, 1500] as const;

function cleanEnvValue(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * Math.min(250, Math.round(baseMs * 0.2)));
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
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
 * Only attempted after retries on the primary model still return 503/429.
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
    const cleaned = cleanEnvValue(part);
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
 * 1. Primary model + up to 2 automatic retries with short jittered backoff (~700ms, ~1500ms)
 *    for transient 503 UNAVAILABLE, 429 rate-limit, and network spikes.
 * 2. Optional comma-separated `GEMINI_FALLBACK_MODELS` runtime env/binding tried only after
 *    primary retries still fail with 503/429/network, gracefully skipping 404 fallback entries.
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
  const ai = await getGeminiClient();
  if (!ai) {
    const missingErr = missingGeminiKeyError();
    logGeminiRouteError(routeName, missingErr);
    return { ok: false, error: missingErr, attempts: 0 };
  }

  const flashModel = await getGeminiModel();
  const proModel = await getGeminiProModel();
  const primaryModel = tier === "pro" ? proModel : flashModel;

  let attempts = 0;
  let primaryError: ClassifiedGeminiError | null = null;

  // Attempt 1 + up to 2 retries on primary model for transient 503/429/network errors
  for (let attemptIdx = 0; attemptIdx <= RETRY_BASE_DELAYS_MS.length; attemptIdx += 1) {
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
    const canRetry =
      attemptIdx < RETRY_BASE_DELAYS_MS.length &&
      isTransientGeminiError(res.error);

    if (canRetry) {
      const baseDelay = RETRY_BASE_DELAYS_MS[attemptIdx];
      console.warn(
        `[LexiVault][${routeName}] Transient Gemini ${res.error.code} (${res.error.upstreamStatus ?? res.error.status}) on ${primaryModel}; retrying (${attemptIdx + 1}/${RETRY_BASE_DELAYS_MS.length}) after ~${baseDelay}ms`
      );
      await sleepWithJitter(baseDelay);
      continue;
    }

    logGeminiRouteError(routeName, res.error, {
      model: primaryModel,
      attempts,
    });
    break;
  }

  // Only try fallback models if primary exhausted retries due to 503/429/network (or Pro -> Flash)
  const shouldTryFallbacks =
    primaryError !== null &&
    (isTransientGeminiError(primaryError) ||
      (tier === "pro" && primaryModel !== flashModel));

  if (shouldTryFallbacks) {
    const envFallbacks = await getGeminiFallbackModels([primaryModel]);
    const fallbackCandidates =
      tier === "pro" && primaryModel !== flashModel
        ? [flashModel, ...envFallbacks.filter((m) => m !== flashModel)]
        : envFallbacks;

    for (const fallbackModel of fallbackCandidates) {
      attempts += 1;
      const res = await invokeModelStructuredOnce<T>(
        ai,
        fallbackModel,
        contents,
        responseSchema
      );

      if (res.ok) {
        console.info(
          `[LexiVault][${routeName}] Recovered via fallback model ${fallbackModel} after ${primaryModel} ${primaryError?.code}`
        );
        return { ok: true, data: res.data, modelUsed: fallbackModel, attempts };
      }

      // Gracefully ignore 404/model errors (and transient errors) on optional fallback models
      console.warn(
        `[LexiVault][${routeName}] Fallback model ${fallbackModel} skipped (${res.error.code}, HTTP ${res.error.upstreamStatus ?? res.error.status})`
      );
    }
  }

  // Always preserve and return the primary model's error (never mask a 503 overload with a fallback 404)
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
