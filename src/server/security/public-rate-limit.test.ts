import { beforeEach, describe, expect, it } from "vitest";
import {
  rateLimitedResponse,
  resetPublicRateLimitsForTests,
  takePublicRateLimit,
} from "./public-rate-limit";

beforeEach(() => resetPublicRateLimitsForTests());

function request(address = "203.0.113.10") {
  return new Request("http://localhost/api/earth/public/search", {
    headers: { "x-forwarded-for": address, "user-agent": "vitest-browser" },
  });
}

describe("public Earth rate limiting", () => {
  it("bounds requests by scope and a hashed client identity", async () => {
    const policy = { limit: 2, windowMs: 1_000 };
    expect(takePublicRateLimit(request(), "search", policy, 10_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(takePublicRateLimit(request(), "search", policy, 10_100)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    const blocked = takePublicRateLimit(request(), "search", policy, 10_200);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    const response = rateLimitedResponse(blocked);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.json()).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many public Earth requests. Please wait and try again.",
      },
    });
  });

  it("isolates clients and safely resets an expired fixed window", () => {
    const policy = { limit: 1, windowMs: 500 };
    expect(takePublicRateLimit(request("203.0.113.10"), "intent", policy, 1_000).allowed).toBe(true);
    expect(takePublicRateLimit(request("203.0.113.11"), "intent", policy, 1_100).allowed).toBe(true);
    expect(takePublicRateLimit(request("203.0.113.10"), "intent", policy, 1_200).allowed).toBe(false);
    expect(takePublicRateLimit(request("203.0.113.10"), "intent", policy, 1_500).allowed).toBe(true);
  });
});
