import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

// Use a project-root-relative SQLite path (resolved the same way by the Prisma
// CLI in global setup and by better-sqlite3 in the test workers, both run from
// the project root). An absolute file: URL would percent-encode the space in
// the directory path and break the SQLite engine on Windows.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    globalSetup: ["./test/global-setup.ts"],
    // SQLite is single-writer; run test files serially to avoid write contention.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      SESSION_SECRET: "test-secret-test-secret-test-secret-0123456789",
      NEXT_PUBLIC_APP_NAME: "SIMVERSE",
      APP_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
