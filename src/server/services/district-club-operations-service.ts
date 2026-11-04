import { AuthorizationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { approvedHome, ensureClubModerator } from "./district-club-service";

// Aggregated counts only: no surveillance of residents or private member exports.
export async function getMyDistrictClubOperations(userId: string) {
  const district = await approvedHome(userId);
  await ensureClubModerator(userId, district.id);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const [residents, visibleMessages, weeklyMessages, reportsOpen, groupsActive,
    pendingEvents, publishedEvents, activeRestrictions, openAppeals,
    recentUniqueGroupPosts, directoryOptIns] = await Promise.all([
    prisma.foundingDistrictResidence.count({
      where: {
        districtId: district.id,
        user: { foundingPrimaryCitizenship: {
          is: { status: "ACTIVE", countryId: district.countryId },
        } },
      },
    }),
    prisma.districtClubMessage.count({ where: {
      districtId: district.id, status: "VISIBLE",
    } }),
    prisma.districtClubMessage.count({ where: {
      districtId: district.id, createdAt: { gte: weekAgo },
    } }),
    prisma.districtClubReport.count({ where: {
      status: "OPEN", message: { districtId: district.id, status: "VISIBLE" },
    } }),
    prisma.districtClubInterestGroup.count({ where: {
      districtId: district.id, status: "ACTIVE",
    } }),
    prisma.districtClubEvent.count({ where: {
      districtId: district.id, status: "PENDING_REVIEW",
    } }),
    prisma.districtClubEvent.count({ where: {
      districtId: district.id, status: "PUBLISHED",
      endsAt: { gt: new Date() },
    } }),
    prisma.districtClubSanction.count({ where: {
      districtId: district.id, status: "ACTIVE", expiresAt: { gt: new Date() },
    } }),
    prisma.districtClubAppeal.count({ where: {
      status: "OPEN", sanction: { districtId: district.id },
    } }),
    prisma.districtClubInterestMessage.count({ where: {
      group: { districtId: district.id }, createdAt: { gte: monthAgo },
    } }),
    prisma.districtClubDirectoryPreference.count({ where: {
      districtId: district.id, isVisible: true,
      user: {
        foundingResidence: { is: { districtId: district.id } },
        foundingPrimaryCitizenship: {
          is: { status: "ACTIVE", countryId: district.countryId },
        },
      },
    } }),
  ]);
  return {
    districtName: district.name,
    checkedAt: new Date().toISOString(),
    metrics: {
      eligibleResidents: residents, directoryOptIns, visibleRoomMessages: visibleMessages,
      newRoomMessages7d: weeklyMessages, openRoomReports: reportsOpen,
      activeInterestGroups: groupsActive, interestMessages30d: recentUniqueGroupPosts,
      pendingEventProposals: pendingEvents, upcomingPublishedEvents: publishedEvents,
      activeClubRestrictions: activeRestrictions, openRestrictionAppeals: openAppeals,
    },
    disclosure: "Aggregated Club operation metrics only. These are not Assembly statistics or a public citizen profile.",
  };
}

// Steward-only visibility into staff. Never infer Club moderator grants
// from workspace or Assembly roles.
export async function listClubModeratorGrantsForSteward(userId: string, districtId: string) {
  const steward = await prisma.fictionalPlanetSteward.findUnique({ where: { userId } });
  if (!steward?.isActive || !steward.canPublish) {
    throw new AuthorizationError("Only authorized planet publishing stewards may review Club staff.");
  }
  const district = await prisma.foundingDistrict.findUnique({
    where: { id: districtId }, select: { name: true },
  });
  if (!district) return { districtName: "", grants: [] };
  const grants = await prisma.districtClubModeratorGrant.findMany({
    where: { districtId },
    select: { isActive: true, userId: true, createdAt: true,
      moderator: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return { districtName: district.name,
    grants: grants.map(g => ({ userId: g.userId,
      name: g.moderator.displayName, active: g.isActive,
      since: g.createdAt.toISOString() })) };
}
