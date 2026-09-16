import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 CLI configuration. The connection URL now lives here (not in the
// schema). CLI commands (`prisma db push`, `prisma migrate`) connect via this
// datasource; the application runtime connects through a driver adapter (see
// src/server/db/client.ts). Switching to PostgreSQL later means changing the
// datasource provider in schema.prisma and pointing DATABASE_URL at Postgres.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
