import { GoogleGenAI, type Schema } from "@google/genai";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type GeminiErrorCode =
  | "missing_key"
  | "quota"
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

function cleanEnvValue(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
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

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

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
    detail: "Gemini API returned an empty or unreadable response.",
    rawMessage: `Empty response body from model ${model || "unknown"}`,
  };
}

export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  const errObj =
    err && typeof err === "object"
      ? (err as {
          status?: unknown;
          statusCode?: unknown;
          code?: unknown;
          message?: unknown;
        })
      : null;

  const upstreamStatus =
    typeof errObj?.status === "number"
      ? errObj.status
      : typeof errObj?.statusCode === "number"
        ? errObj.statusCode
        : undefined;

  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof errObj?.message === "string"
        ? errObj.message
        : String(err ?? "Unknown Gemini API error");

  const conciseRaw = rawMessage.slice(0, 320);
  const lower = rawMessage.toLowerCase();

  if (
    upstreamStatus === 429 ||
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return {
      status: 429,
      upstreamStatus: upstreamStatus ?? 429,
      code: "quota",
      detail: "Gemini API quota or rate limit exceeded.",
      rawMessage: conciseRaw,
    };
  }

  if (
    upstreamStatus === 401 ||
    upstreamStatus === 403 ||
    lower.includes("401") ||
    lower.includes("403") ||
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

  if (
    upstreamStatus === 404 ||
    lower.includes("not found") ||
    lower.includes("is not found for api version") ||
    lower.includes("model")
  ) {
    return {
      status: 502,
      upstreamStatus: upstreamStatus ?? 404,
      code: "model",
      detail: "Configured Gemini model is unavailable or rejected the request.",
      rawMessage: conciseRaw,
    };
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnrefused") ||
    lower.includes("aborted")
  ) {
    return {
      status: 503,
      upstreamStatus,
      code: "network",
      detail: "Network timeout while contacting Gemini API.",
      rawMessage: conciseRaw,
    };
  }

  return {
    status: 502,
    upstreamStatus,
    code: "api_error",
    detail: `Gemini API request failed (${upstreamStatus ?? "upstream error"}).`,
    rawMessage: conciseRaw,
  };
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
  | { ok: true; data: T; modelUsed: string }
  | { ok: false; error: ClassifiedGeminiError };

export async function generateStructuredWithHybridModel<T>({
  tier,
  contents,
  responseSchema,
  routeName = "gemini-hybrid",
}: {
  tier: "flash" | "pro";
  contents: string;
  responseSchema: Schema;
  routeName?: string;
}): Promise<HybridModelResult<T>> {
  const ai = await getGeminiClient();
  if (!ai) {
    const missingErr = missingGeminiKeyError();
    logGeminiRouteError(routeName, missingErr);
    return { ok: false, error: missingErr };
  }

  const flashModel = await getGeminiFlashModel();
  const proModel = await getGeminiProModel();
  const candidates =
    tier === "pro" && proModel !== flashModel
      ? [proModel, flashModel]
      : [flashModel];

  let lastError: ClassifiedGeminiError | null = null;

  for (const model of candidates) {
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
        lastError = emptyGeminiResponseError(model);
        logGeminiRouteError(routeName, lastError, { model });
        continue;
      }
      const parsed = JSON.parse(text) as T;
      return { ok: true, data: parsed, modelUsed: model };
    } catch (err) {
      lastError = classifyGeminiError(err);
      logGeminiRouteError(routeName, lastError, { model });
      // Automatically try Flash if Pro hit quota/availability error
      continue;
    }
  }

  return {
    ok: false,
    error: lastError ?? emptyGeminiResponseError(candidates[0]),
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
