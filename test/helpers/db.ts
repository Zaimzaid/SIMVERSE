import { prisma } from "@/server/db/client";

/** Delete all rows in FK-safe order. Used between integration tests. */
export async function resetDb(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}
