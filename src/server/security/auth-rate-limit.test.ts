import { beforeEach, describe, expect, it } from "vitest";
import {
  authClientIp, authRateLimitedResponse, checkLoginLimit,
  clearLoginEmailFailures, recordLoginFailure, resetAuthLimitsForTests,
  takeRegistrationLimit,
} from "./auth-rate-limit";

beforeEach(resetAuthLimitsForTests);

describe("authentication attempt throttling", () => {
  it("does not trust spoofed forwarding headers without an explicitly trusted proxy", () => {
    const req = new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": "203.0.113.10", "x-real-ip": "1.2.3.4" } });
    expect(authClientIp(req, false)).toBe("unidentified");
    expect(authClientIp(req, true)).toBe("203.0.113.10");
  });

  it("blocks five failed logins per email and allows a new window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLoginLimit("1.1.1.1", "USER@EXAMPLE.COM", 1000).allowed).toBe(true);
      recordLoginFailure("1.1.1.1", "user@example.com", 1000);
    }
    const blocked = checkLoginLimit("9.9.9.9", "user@example.com", 1000);
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 900 });
    expect(checkLoginLimit("9.9.9.9", "user@example.com", 901001).allowed).toBe(true);
  });

  it("blocks twenty failures per IP even when emails change", () => {
    for (let i = 0; i < 20; i++) {
      expect(checkLoginLimit("203.0.113.3", `person${i}@example.com`, 1000).allowed).toBe(true);
      recordLoginFailure("203.0.113.3", `person${i}@example.com`, 1000);
    }
    expect(checkLoginLimit("203.0.113.3", "fresh@example.com", 1000).allowed).toBe(false);
    expect(checkLoginLimit("203.0.113.4", "fresh@example.com", 1000).allowed).toBe(true);
  });

  it("allows successful login to reset an email failure count", () => {
    recordLoginFailure("203.0.113.1", "player@example.com", 1000);
    clearLoginEmailFailures("player@example.com");
    expect(checkLoginLimit("203.0.113.2", "player@example.com", 1000).allowed).toBe(true);
  });

  it("limits registration attempts independently, resets, and sets Retry-After", async () => {
    for (let i = 0; i < 20; i++) expect(takeRegistrationLimit("1.2.3.4", 1000).allowed).toBe(true);
    const blocked = takeRegistrationLimit("1.2.3.4", 1000);
    expect(blocked.allowed).toBe(false);
    const response = authRateLimitedResponse(blocked.retryAfterSeconds);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(takeRegistrationLimit("1.2.3.4", 901001).allowed).toBe(true);
  });
});
