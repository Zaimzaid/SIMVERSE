import { describe, expect, it } from "vitest";
import nextConfig, { buildSecurityHeaders } from "../../../next.config";

function asRecord(headers: ReturnType<typeof buildSecurityHeaders>) {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]));
}

describe("security response headers", () => {
  it("applies security headers to all paths, including login and Earth", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toEqual([{ source: "/:path*", headers: buildSecurityHeaders() }]);
    const result = asRecord(buildSecurityHeaders("test"));
    expect(result["X-Content-Type-Options"]).toBe("nosniff");
    expect(result["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(result["X-Frame-Options"]).toBe("DENY");
    expect(result["Permissions-Policy"]).toContain("camera=(self)");
    expect(result["Permissions-Policy"]).toContain("microphone=(self)");
    expect(result["Permissions-Policy"]).toContain("geolocation=()");
    expect(result["Content-Security-Policy-Report-Only"]).toContain("frame-ancestors 'none'");
    expect(result["Content-Security-Policy-Report-Only"]).toContain("worker-src 'self' blob:");
    expect(result).not.toHaveProperty("Content-Security-Policy");
  });

  it("sets HSTS only in production", () => {
    expect(asRecord(buildSecurityHeaders("test"))).not.toHaveProperty("Strict-Transport-Security");
    expect(asRecord(buildSecurityHeaders("development"))).not.toHaveProperty("Strict-Transport-Security");
    expect(asRecord(buildSecurityHeaders("production"))["Strict-Transport-Security"]).toContain("max-age=");
  });
});
