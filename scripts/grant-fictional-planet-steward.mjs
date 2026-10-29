/**
 * Trusted operator-only enrollment of a SIMVERSE Planet steward.
 * Use locally with privileged filesystem/database access, never via a web route.
 *
 * Example:
 *   node scripts/grant-fictional-planet-steward.mjs --email=owner@example.com --publish --confirm
 *
 * Does not create an account or country and cannot grant a workspace role.
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const args = new Set(process.argv.slice(2));
const email = [...args].find((argument) => argument.startsWith("--email="))?.slice(8)?.trim().toLowerCase();
const canPublish = args.has("--publish");
if (!email || !email.includes("@") || !args.has("--confirm")) {
  console.error("Usage: node scripts/grant-fictional-planet-steward.mjs --email=EXISTING_USER_EMAIL [--publish] --confirm");
  process.exitCode = 2;
} else if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured. No changes made.");
  process.exitCode = 2;
} else {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
  });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("That account does not exist. No changes made.");
    const privilegedWorkspace = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } },
    });
    if (!privilegedWorkspace) throw new Error("This account is not an owner/admin of any workspace. No changes made.");
    await prisma.fictionalPlanetSteward.upsert({
      where: { userId: user.id },
      create: { userId: user.id, canPublish, isActive: true, notes: "Trusted operator enrollment" },
      update: { canPublish, isActive: true },
    });
    console.log(`Planet steward enabled: ${email}; publish=${canPublish}. No country was created.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
