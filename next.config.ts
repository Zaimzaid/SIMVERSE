import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
