import type { NextConfig } from "next";

// Report-only while validating MapLibre workers, Three.js and creator-provided media.
// WebRTC calls in Community require camera and microphone access for this origin.
export function buildSecurityHeaders(nodeEnv = process.env.NODE_ENV) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https:",
    "connect-src 'self' https: wss:",
    "worker-src 'self' blob:",
    "frame-src 'self' https:",
  ].join("; ");
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
    { key: "Content-Security-Policy-Report-Only", value: csp },
    ...(nodeEnv === "production"
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders() }];
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Native modules must stay external to the server bundle (not tracable/bundlable):
  // the SQLite driver, and the SVG→PNG rasterizer used by Creator/Media image export.
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "better-sqlite3", "@resvg/resvg-js"],
  experimental: {
    // Keep the authenticated app shell lightweight; heavy simulation/rendering
    // libraries must be loaded only where needed in future phases.
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
