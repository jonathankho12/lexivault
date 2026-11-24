import { NextResponse } from "next/server";

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000; // 60 seconds
const MAX_TRACKED_KEYS = 500;

interface RateLimitEntry {
  timestamps: number[];
  expiresAt: number;
}

// In-memory sliding-window store per Cloudflare Worker isolate / server process.
// Never uses global setInterval (incompatible with Cloudflare Workers startup).
const rateLimitStore = new Map<string, RateLimitEntry>();

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

  return "anonymous";
}

function pruneExpiredEntriesIfNeeded(now: number): void {
  if (rateLimitStore.size <= MAX_TRACKED_KEYS) return;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  // If still above threshold under high cardinality, evict oldest entries
  while (rateLimitStore.size > MAX_TRACKED_KEYS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (!oldestKey) break;
    rateLimitStore.delete(oldestKey);
  }
}

export interface RateLimitOptions {
  bucket: string;
  limit?: number;
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  limit: number;
}

/**
 * Cloudflare-Workers-compatible per-IP sliding-window rate limiter.
 */
export function checkRateLimit(
  request: Request,
  options: RateLimitOptions
): RateLimitResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  const ip = getClientIp(request);
  const storeKey = `${options.bucket}:${ip}`;

  pruneExpiredEntriesIfNeeded(now);

  const existing = rateLimitStore.get(storeKey);
  const activeTimestamps = existing
    ? existing.timestamps.filter((ts) => now - ts < windowMs)
    : [];

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0] ?? now;
    const retryAfterMs = Math.max(1000, windowMs - (now - oldest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    const resetAt = Math.ceil((oldest + windowMs) / 1000);

    rateLimitStore.set(storeKey, {
      timestamps: activeTimestamps,
      expiresAt: oldest + windowMs,
    });

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
      limit,
    };
  }

  activeTimestamps.push(now);
  const oldest = activeTimestamps[0] ?? now;
  const newest = activeTimestamps[activeTimestamps.length - 1] ?? now;

  rateLimitStore.set(storeKey, {
    timestamps: activeTimestamps,
    expiresAt: newest + windowMs,
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - activeTimestamps.length),
    resetAt: Math.ceil((oldest + windowMs) / 1000),
    retryAfterSeconds: 0,
    limit,
  };
}

/**
 * Builds a standardized 429 Too Many Requests response with rate-limit headers.
 */
export function buildRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait a moment and try again.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetAt),
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * Convenience helper for API route handlers: returns a 429 NextResponse if limited, or null if allowed.
 */
export function enforceRateLimit(
  request: Request,
  options: RateLimitOptions
): NextResponse | null {
  const result = checkRateLimit(request, options);
  if (!result.allowed) {
    return buildRateLimitResponse(result);
  }
  return null;
}

export type RateLimitCheckResult =
  | {
      allowed: true;
      remaining: number;
      resetAt: number;
      retryAfterSeconds: 0;
    }
  | {
      allowed: false;
      remaining: 0;
      resetAt: number;
      retryAfterSeconds: number;
      response: NextResponse;
    };

/**
 * Backwards-compatible wrapper used by AI routes.
 */
export function checkAiRateLimit(
  request: Request,
  _lang?: "en" | "id",
  options?: {
    limit?: number;
    windowMs?: number;
    bucket?: string;
  }
): RateLimitCheckResult {
  void _lang;
  const result = checkRateLimit(request, {
    bucket: options?.bucket ?? "ai",
    limit: options?.limit ?? DEFAULT_LIMIT,
    windowMs: options?.windowMs ?? DEFAULT_WINDOW_MS,
  });

  if (!result.allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: result.resetAt,
      retryAfterSeconds: result.retryAfterSeconds,
      response: buildRateLimitResponse(result),
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetAt: result.resetAt,
    retryAfterSeconds: 0,
  };
}
