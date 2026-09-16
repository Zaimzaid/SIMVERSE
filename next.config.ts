import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native SQLite driver must stay external to the server bundle (not tracable/bundlable).
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "better-sqlite3"],
  experimental: {
    // Keep the authenticated app shell lightweight; heavy simulation/rendering
    // libraries must be loaded only where needed in future phases.
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
