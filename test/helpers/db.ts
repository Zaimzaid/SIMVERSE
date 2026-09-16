import { prisma } from "@/server/db/client";

/** Delete all rows in FK-safe order. Used between integration tests. */
export async function resetDb(): Promise<void> {
  // Entity system (children first): values + tag links, then entities, then the
  // workspace-scoped catalogs (tags, attribute definitions).
  await prisma.entityAttributeValue.deleteMany();
  await prisma.entityTag.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.attributeDefinition.deleteMany();
  // Platform (Phase 0).
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}
