import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface PublicRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export const PUBLIC_EARTH_RATE_LIMITS = {
  overview: { limit: 60, windowMs: 60_000 },
  search: { limit: 30, windowMs: 60_000 },
  intent: { limit: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 2_048;

function requestIdentity(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const agent = request.headers.get("user-agent")?.slice(0, 160) ?? "unknown-agent";
  const address = (forwarded || direct || "unknown-address").slice(0, 128);
  return createHash("sha256").update(`${address}|${agent}`).digest("hex").slice(0, 24);
}

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

export function takePublicRateLimit(
  request: Request,
  scope: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): PublicRateLimitResult {
  prune(now);
  const key = `${scope}:${requestIdentity(request)}`;
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + policy.windowMs }
    : existing;
  bucket.count += 1;
  buckets.set(key, bucket);
  return {
    allowed: bucket.count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function rateLimitedResponse(result: PublicRateLimitResult) {
  return NextResponse.json({
    error: {
      code: "RATE_LIMITED",
      message: "Too many public Earth requests. Please wait and try again.",
    },
  }, {
    status: 429,
    headers: {
      "Retry-After": String(result.retryAfterSeconds),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
    },
  });
}

export function resetPublicRateLimitsForTests() {
  buckets.clear();
}
