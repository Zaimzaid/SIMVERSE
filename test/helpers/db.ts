import { prisma } from "@/server/db/client";

/** Delete all rows in FK-safe order. Used between integration tests. */
export async function resetDb(): Promise<void> {
  await prisma.socialReaction.deleteMany();
  await prisma.socialGroupMessage.deleteMany();
  await prisma.socialGroupMember.deleteMany();
  await prisma.socialGroup.deleteMany();
  await prisma.socialNotification.deleteMany();
  await prisma.socialCallSignal.deleteMany();
  await prisma.socialMessage.deleteMany();
  await prisma.socialFriendship.deleteMany();
  await prisma.socialBlock.deleteMany();
  await prisma.animationProject.deleteMany();
  await prisma.economyLabTransfer.deleteMany();
  await prisma.economyLab.deleteMany();
  // Player identity references country catalog records; clear its children
  // before deleting Earth geography or the User account.
  await prisma.playerVirtualEmployment.deleteMany();
  await prisma.playerWorkApplication.deleteMany();
  await prisma.playerVirtualJob.deleteMany();
  await prisma.playerBusinessReviewer.deleteMany();
  await prisma.playerOrientationCertificate.deleteMany();
  await prisma.playerVirtualBusiness.deleteMany();
  await prisma.playerWalletEntry.deleteMany();
  await prisma.playerVirtualWallet.deleteMany();
  await prisma.playerCareerProfile.deleteMany();
  await prisma.playerBilateralTravelAgreement.deleteMany();
  await prisma.playerCitizenshipPolicy.deleteMany();
  await prisma.playerCountryGovernanceGrant.deleteMany();
  await prisma.playerTravelVisaApplication.deleteMany();
  await prisma.playerTravelRoutePolicy.deleteMany();
  await prisma.playerVirtualDocument.deleteMany();
  await prisma.playerDocumentApplication.deleteMany();
  await prisma.playerDocumentReviewer.deleteMany();
  await prisma.playerCitizenship.deleteMany();
  await prisma.playerIdentity.deleteMany();
  // Earth Phase 4 global stewardship and immutable zone history. The stable
  // zone points at its active version, so clear that projection before deleting
  // lifecycle/version records.
  await prisma.earthDevelopmentZoneLifecycleEvent.deleteMany();
  await prisma.earthDevelopmentZone.updateMany({ data: { activeVersionId: null } });
  await prisma.earthDevelopmentZoneVersion.deleteMany();
  await prisma.earthDevelopmentZone.deleteMany();
  await prisma.earthSteward.deleteMany();
  // SIMVERSE Earth global geography catalog (children and immutable source
  // history first, then the self-referencing place hierarchy and datasets).
  await prisma.earthGeoPlaceRevision.deleteMany();
  await prisma.earthGeoImport.deleteMany();
  await prisma.earthGeoPlace.updateMany({ data: { parentId: null } });
  await prisma.earthGeoPlace.deleteMany();
  await prisma.earthGeoDatasetVersion.deleteMany();
  await prisma.earthGeoDataset.deleteMany();
  // Creator/Media artifacts reference completed Runs with Restrict semantics.
  await prisma.mediaArtifactVersion.deleteMany();
  await prisma.mediaArtifact.deleteMany();
  // Tournament orchestration owns Match links to derived Simulations/Runs.
  await prisma.tournamentMatch.deleteMany();
  await prisma.tournamentRound.deleteMany();
  await prisma.tournamentParticipant.deleteMany();
  await prisma.tournament.deleteMany();
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
  await prisma.uploadedImage.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.cloudOauthState.deleteMany();
  await prisma.googleDriveConnection.deleteMany();
  await prisma.accountDeletionRequest.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.twoFactorChallenge.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.workspaceInvitation.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}
