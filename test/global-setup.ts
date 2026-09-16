import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vitest global setup: build a fresh SQLite schema for the test database once,
 * before any test file runs. Uses the same project-root-relative path as
 * vitest.config.mts so the CLI and the runtime client agree on the location.
 */
export default function setup() {
  const here = path.dirname(fileURLToPath(import.meta.url)); // /test
  const projectRoot = path.join(here, "..");
  const dbPath = path.join(projectRoot, "test.db");

  // Delete any prior test DB so `db push` applies the schema to a fresh, empty
  // file. Because the file is removed first, no data is ever destroyed and we
  // avoid the (correct) Prisma guard against `--force-reset` under automation.
  for (const file of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  execSync("npx prisma db push", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}
