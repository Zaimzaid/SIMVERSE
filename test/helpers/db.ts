import { prisma } from "@/server/db/client";

/** Delete all rows in FK-safe order. Used between integration tests. */
export async function resetDb(): Promise<void> {
  // Core runs and their history (Phase 3). The Simulation FK is Restrict, so
  // test-only cleanup explicitly removes run children before source definitions.
  await prisma.simulationRunEvent.deleteMany();
  await prisma.simulationRunAction.deleteMany();
  await prisma.simulationRunParticipant.deleteMany();
  await prisma.simulationRun.deleteMany();
  // Simulation system (Phase 2): participant links, then simulations.
  await prisma.simulationEntity.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.experienceEventBinding.deleteMany();
  await prisma.experienceAsset.deleteMany();
  await prisma.experienceEntity.deleteMany();
  await prisma.experienceWorld.deleteMany();
  await prisma.experienceProfileTag.deleteMany();
  await prisma.experienceProfileVersion.deleteMany();
  await prisma.experienceProfile.deleteMany();
  await prisma.worldAsset.deleteMany();
  await prisma.worldEntity.deleteMany();
  await prisma.worldTag.deleteMany();
  await prisma.worldVersion.deleteMany();
  await prisma.world.deleteMany();
  // Asset Library follows Worlds because WorldAsset pins Asset identities.
  await prisma.assetRelationship.deleteMany();
  await prisma.assetEntity.deleteMany();
  await prisma.assetTag.deleteMany();
  await prisma.assetVersion.deleteMany();
  await prisma.asset.deleteMany();
  // Project system (Phase 2): entity links, then projects. Deleted BEFORE
  // entities so the link rows never dangle.
  await prisma.projectEntity.deleteMany();
  await prisma.project.deleteMany();
  // Entity system (children first): values + tag links, then entities, then the
  // workspace-scoped catalogs (tags, attribute definitions).
  await prisma.entityVisualProfile.deleteMany();
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
