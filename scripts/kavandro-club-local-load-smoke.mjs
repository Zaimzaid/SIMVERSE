/**
 * K4.12: authenticated, read-only local load smoke.
 *
 * Requires a disposable test server with an approved district test user:
 * CLUB_TEST_BASE_URL=http://localhost:3000
 * CLUB_TEST_COOKIE='session=...'
 *
 * No account creation, no messages, no moderation, no writes. Will refuse
 * any non-local destination and won't print cookie values.
 */
const base = process.env.CLUB_TEST_BASE_URL ?? "";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\/?$/.test(base)) {
  throw new Error("Refusing non-local target; pass http://localhost:<port> only.");
}
const cookie = process.env.CLUB_TEST_COOKIE;
if (!cookie) throw new Error("A disposable local-test authenticated cookie is required.");
const targets = [
  "/api/civilization/club/activity",
  "/api/civilization/club?room=GENERAL",
  "/api/civilization/club/events",
  "/api/civilization/club/groups",
];
const iterations = 12; // intentionally bounded: 48 total reads
const started = performance.now();
const timings = [];
let errors = 0;
for (let round = 0; round < iterations; round++) {
  for (const path of targets) {
    const now = performance.now();
    const response = await fetch(base.replace(/\/$/, "") + path, {
      headers: { cookie, "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(5000),
    });
    const duration = performance.now() - now;
    timings.push(duration);
    if (!response.ok) errors++;
    await response.arrayBuffer();
  }
}
const sorted = [...timings].sort((a, b) => a - b);
const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
console.log(JSON.stringify({
  requests: timings.length, non2xx: errors,
  p50Ms: Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0),
  p95Ms: Math.round(p95 ?? 0),
  totalMs: Math.round(performance.now() - started),
}, null, 2));
if (errors > 0) process.exitCode = 1;
