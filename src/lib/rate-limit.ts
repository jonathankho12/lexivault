import { NextResponse } from "next/server";

const DEFAULT_AI_LIMIT = 25;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TRACKED_KEYS = 2000;

// In-memory sliding-window store per Worker isolate / server process
const ipRequestTimestamps = new Map<string, number[]>();

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

function pruneStoreIfNeeded(now: number, windowMs: number): void {
  if (ipRequestTimestamps.size < MAX_TRACKED_KEYS) return;

  for (const [key, timestamps] of ipRequestTimestamps.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < windowMs);
    if (fresh.length === 0) {
      ipRequestTimestamps.delete(key);
    } else {
      ipRequestTimestamps.set(key, fresh);
    }
  }

  // Hard cap oldest keys if still above threshold
  while (ipRequestTimestamps.size >= MAX_TRACKED_KEYS) {
    const oldestKey = ipRequestTimestamps.keys().next().value;
    if (!oldestKey) break;
    ipRequestTimestamps.delete(oldestKey);
  }
}

export type RateLimitCheckResult =
  | {
      allowed: true;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      retryAfterSec: number;
      response: NextResponse;
    };

/**
 * Zero-dependency per-IP sliding-window rate limiter for AI endpoints.
 * Default: 25 AI requests per 5 minutes per IP (generous for normal study, blocks abuse).
 */
export function checkAiRateLimit(
  request: Request,
  lang: "en" | "id" = "en",
  options?: {
    limit?: number;
    windowMs?: number;
    bucket?: string;
  }
): RateLimitCheckResult {
  const limit = options?.limit ?? DEFAULT_AI_LIMIT;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const bucket = options?.bucket ?? "ai";
  const now = Date.now();
  const ip = getClientIp(request);
  const storeKey = `${bucket}:${ip}`;

  pruneStoreIfNeeded(now, windowMs);

  const existing = ipRequestTimestamps.get(storeKey) ?? [];
  const activeTimestamps = existing.filter((ts) => now - ts < windowMs);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0] ?? now;
    const retryAfterMs = Math.max(1000, windowMs - (now - oldest));
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    const resetAt = Math.ceil((oldest + windowMs) / 1000);

    ipRequestTimestamps.set(storeKey, activeTimestamps);

    const waitMinutes = Math.ceil(retryAfterSec / 60);
    const message =
      lang === "en"
        ? `Too many AI requests right now. Please wait about ${
            retryAfterSec < 60
              ? `${retryAfterSec} seconds`
              : `${waitMinutes} minute${waitMinutes > 1 ? "s" : ""}`
          } and try again.`
        : `Terlalu banyak permintaan AI dalam waktu singkat. Silakan tunggu sekitar ${
            retryAfterSec < 60 ? `${retryAfterSec} detik` : `${waitMinutes} menit`
          } lalu coba lagi.`;

    return {
      allowed: false,
      retryAfterSec,
      response: NextResponse.json(
        {
          error: message,
          code: "rate_limit",
          retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(resetAt),
            "Cache-Control": "no-store",
          },
        }
      ),
    };
  }

  activeTimestamps.push(now);
  ipRequestTimestamps.set(storeKey, activeTimestamps);

  const oldest = activeTimestamps[0] ?? now;
  return {
    allowed: true,
    remaining: Math.max(0, limit - activeTimestamps.length),
    resetAt: Math.ceil((oldest + windowMs) / 1000),
  };
}
