import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * Phase 0 connects to SQLite through the better-sqlite3 driver adapter. To move
 * to PostgreSQL later, swap the adapter here (e.g. @prisma/adapter-pg) and the
 * datasource provider in schema.prisma — no service/UI code changes required.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Fields to omit so a User is never returned with its password hash. */
export const SAFE_USER_OMIT = { passwordHash: true } as const;

/** Strip the password hash from a fully-loaded user record. */
export function toSafeUser<T extends { passwordHash: string }>(
  user: T,
): Omit<T, "passwordHash"> {
  const { passwordHash, ...safe } = user;
  void passwordHash;
  return safe;
}
