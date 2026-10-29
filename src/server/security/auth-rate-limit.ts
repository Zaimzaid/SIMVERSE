import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

// One process only. For multiple instances, use atomic shared storage (Redis).
const WINDOW_MS = 15 * 60_000;
const MAX_BUCKETS = 8_192;
const LOGIN_EMAIL_FAILURES = 5;
const LOGIN_IP_FAILURES = 20;
const REGISTER_IP_ATTEMPTS = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

type Decision = { allowed: boolean; retryAfterSeconds: number };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function key(scope: string, value: string) {
  return `${scope}:${hash(value)}`;
}

function prune(now: number) {
  for (const [name, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(name);
  }
  // Bounded memory. Distributed deployments must replace this store.
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

function peek(name: string, limit: number, now: number): Decision {
  const bucket = buckets.get(name);
  if (!bucket || bucket.resetAt <= now || bucket.count < limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

function increment(name: string, now: number) {
  prune(now);
  const prev = buckets.get(name);
  const current = !prev || prev.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : prev;
  current.count++;
  buckets.set(name, current);
}

// Next.js 16 does not expose a reliable raw socket IP in route handlers.
// Only trust forwarding metadata when an operator controls the edge proxy and
// it overwrites, rather than appends to, any user-supplied x-forwarded-for.
export function authClientIp(req: Request, trustProxy = process.env.AUTH_TRUST_PROXY === "true") {
  if (trustProxy) {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded && isIP(forwarded)) return forwarded;
  }
  // Conservatively group unknown clients; never treat spoofable headers as IPs.
  return "unidentified";
}

export function checkLoginLimit(ip: string, email: string, now = Date.now()): Decision {
  prune(now);
  const ipDecision = peek(key("auth:login:ip", ip), LOGIN_IP_FAILURES, now);
  const emailDecision = email
    ? peek(key("auth:login:email", email.trim().toLowerCase()), LOGIN_EMAIL_FAILURES, now)
    : { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: ipDecision.allowed && emailDecision.allowed,
    retryAfterSeconds: Math.max(ipDecision.retryAfterSeconds, emailDecision.retryAfterSeconds),
  };
}

export function recordLoginFailure(ip: string, email: string, now = Date.now()) {
  increment(key("auth:login:ip", ip), now);
  if (email) increment(key("auth:login:email", email.trim().toLowerCase()), now);
}

export function clearLoginEmailFailures(email: string) {
  if (email) buckets.delete(key("auth:login:email", email.trim().toLowerCase()));
}

export function takeRegistrationLimit(ip: string, now = Date.now()): Decision {
  const name = key("auth:register:ip", ip);
  prune(now);
  const decision = peek(name, REGISTER_IP_ATTEMPTS, now);
  if (decision.allowed) increment(name, now);
  return decision;
}

export function authRateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json({
    error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." },
  }, { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) } });
}

export function resetAuthLimitsForTests() {
  buckets.clear();
}
