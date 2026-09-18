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

  // Discard the previous isolated test DB so every run starts with a clean schema.
  // This never touches the development database.
  for (const file of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  // Prisma 7 checks that the SQLite file exists before `db push` creates its
  // tables. Give it a fresh empty file to initialize.
  fs.writeFileSync(dbPath, "");

  execSync("npx prisma db push", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}
