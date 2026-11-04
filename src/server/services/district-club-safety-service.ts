import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { PLANET_ID } from "@/lib/planet/contracts";
import {
  clubAppealDecisionSchema, clubAppealSchema, clubGrantSchema,
  clubSanctionRevokeSchema, clubSanctionSchema,
} from "@/lib/civilization/district-club-safety-contract";
import { recordAudit } from "./audit-service";
import { approvedHome, ensureClubModerator } from "./district-club-service";

type Db = Prisma.TransactionClient | typeof prisma;

async function ensureMemberInDistrict(targetId: string, districtId: string, countryId: string, tx: Db) {
  const residence = await tx.foundingDistrictResidence.findUnique({ where: { userId: targetId } });
  const passport = await tx.foundingPrimaryCitizenship.findUnique({ where: { userId: targetId } });
  if (!residence || residence.districtId !== districtId ||
      passport?.status !== "ACTIVE" || passport.countryId !== countryId) {
    throw new NotFoundError("This user is not an approved current resident of your district.");
  }
}

export async function getMyClubSafety(userId: string) {
  // Account's own sanction and appeal history remains accessible during a ban
  // and after a citizenship change; never require approvedHome here.
  const sanctions = await prisma.districtClubSanction.findMany({
    where: { targetUserId: userId },
    orderBy: { createdAt: "desc" }, take: 30,
    include: { appeal: { select: { id: true, status: true, reason: true,
      decisionReason: true, reviewedAt: true } },
      district: { select: { name: true } },
    },
  });
  return {
    sanctions: sanctions.map(s => ({
      id: s.id, kind: s.kind, reason: s.reason, districtName: s.district.name,
      isActive: s.status === "ACTIVE" && s.expiresAt > new Date(),
      status: s.status, expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      appeal: s.appeal ? { ...s.appeal,
        reviewedAt: s.appeal.reviewedAt?.toISOString() ?? null } : null,
    })),
  };
}

export async function issueClubSanction(userId: string, input: unknown) {
  const p = parseOrThrow(clubSanctionSchema, input);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubModerator(userId, district.id, tx);
    if (p.targetUserId === userId) throw new AuthorizationError("A moderator cannot sanction themself.");
    await ensureMemberInDistrict(p.targetUserId, district.id, district.countryId, tx);
    const targetModerator = await tx.districtClubModeratorGrant.findUnique({
      where: { userId_districtId: { userId: p.targetUserId, districtId: district.id } },
    });
    if (targetModerator?.isActive) {
      throw new AuthorizationError("Staff misconduct must be escalated to a platform steward.");
    }
    const active = await tx.districtClubSanction.findFirst({
      where: { districtId: district.id, targetUserId: p.targetUserId,
        kind: p.kind, status: "ACTIVE", expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (active) throw new ConflictError("An active restriction of this type already exists.");
    const recent = await tx.districtClubSanction.count({
      where: { issuedByUserId: userId, createdAt: { gt: new Date(Date.now() - 86_400_000) } },
    });
    if (recent >= 12) throw new ConflictError("Moderator daily sanction limit reached.");
    const sanction = await tx.districtClubSanction.create({
      data: { districtId: district.id, targetUserId: p.targetUserId,
        issuedByUserId: userId, kind: p.kind, reason: p.reason,
        expiresAt: new Date(Date.now() + p.durationHours * 3_600_000) },
    });
    await recordAudit({
      action: "club.sanction_issued", actorUserId: userId,
      entityType: "DistrictClubSanction", entityId: sanction.id,
      metadata: { districtId: district.id, kind: p.kind, targetId: p.targetUserId },
    }, tx);
    return { sanctionId: sanction.id, expiresAt: sanction.expiresAt.toISOString() };
  });
}

export async function revokeClubSanction(userId: string, input: unknown) {
  const p = parseOrThrow(clubSanctionRevokeSchema, input);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubModerator(userId, district.id, tx);
    const original = await tx.districtClubSanction.findFirst({
      where: { id: p.sanctionId, districtId: district.id, status: "ACTIVE" },
    });
    if (!original) throw new NotFoundError("No active Club restriction matches this request.");
    if (original.issuedByUserId === userId) {
      throw new AuthorizationError("A second moderator must review the revocation.");
    }
    await tx.districtClubSanction.update({
      where: { id: original.id },
      data: { status: "REVOKED", revokedByUserId: userId, revokedAt: new Date() },
    });
    await recordAudit({
      action: "club.sanction_revoked", actorUserId: userId,
      entityType: "DistrictClubSanction", entityId: original.id,
      metadata: { districtId: district.id, reason: p.reason },
    }, tx);
    return { revoked: true };
  });
}

export async function submitClubAppeal(userId: string, input: unknown) {
  const p = parseOrThrow(clubAppealSchema, input);
  return prisma.$transaction(async tx => {
    const sanction = await tx.districtClubSanction.findUnique({
      where: { id: p.sanctionId }, include: { appeal: { select: { id: true } } },
    });
    if (!sanction || sanction.targetUserId !== userId)
      throw new NotFoundError("No Club restriction matches your account.");
    if (sanction.appeal) throw new ConflictError("An appeal is already recorded for this restriction.");
    if (sanction.createdAt.getTime() < Date.now() - 90 * 86_400_000) {
      throw new ConflictError("Appeals for this restriction have closed.");
    }
    const appeal = await tx.districtClubAppeal.create({
      data: { sanctionId: sanction.id, authorUserId: userId, reason: p.reason },
    });
    await recordAudit({
      action: "club.appeal_submitted", actorUserId: userId,
      entityType: "DistrictClubAppeal", entityId: appeal.id,
      metadata: { districtId: sanction.districtId, sanctionId: sanction.id },
    }, tx);
    return { appealId: appeal.id, status: "OPEN" as const };
  });
}

export async function getMyClubSafetyQueue(userId: string) {
  const district = await approvedHome(userId);
  await ensureClubModerator(userId, district.id);
  const [appeals, sanctions, overview] = await Promise.all([
    prisma.districtClubAppeal.findMany({
      where: { status: "OPEN", sanction: { districtId: district.id } },
      include: { sanction: { select: {
        kind: true, reason: true, issuedByUserId: true, targetUserId: true, expiresAt: true,
      } }, author: { select: { displayName: true } } },
      orderBy: { createdAt: "asc" }, take: 50,
    }),
    prisma.districtClubSanction.findMany({
      where: { districtId: district.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      include: { target: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
    Promise.all([
      prisma.districtClubMessage.count({ where: { districtId: district.id } }),
      prisma.districtClubReport.count({ where: { message: { districtId: district.id }, status: "OPEN" } }),
      prisma.districtClubEvent.count({ where: { districtId: district.id, status: "PUBLISHED" } }),
    ]),
  ]);
  return {
    district: { id: district.id, name: district.name },
    overview: { messages: overview[0], openReports: overview[1],
      publishedEvents: overview[2], activeRestrictions: sanctions.length, pendingAppeals: appeals.length },
    appeals: appeals.map(a => ({
      id: a.id, reason: a.reason, authorDisplayName: a.author.displayName,
      kind: a.sanction.kind, sanctionReason: a.sanction.reason,
      expiresAt: a.sanction.expiresAt.toISOString(),
      conflict: a.sanction.issuedByUserId === userId || a.sanction.targetUserId === userId,
    })),
    sanctions: sanctions.map(s => ({
      id: s.id, kind: s.kind, reason: s.reason,
      targetDisplayName: s.target.displayName,
      expiresAt: s.expiresAt.toISOString(),
      ownDecision: s.issuedByUserId === userId,
    })),
  };
}

export async function decideClubAppeal(userId: string, input: unknown) {
  const p = parseOrThrow(clubAppealDecisionSchema, input);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubModerator(userId, district.id, tx);
    const appeal = await tx.districtClubAppeal.findUnique({
      where: { id: p.appealId }, include: { sanction: true },
    });
    if (!appeal || appeal.sanction.districtId !== district.id || appeal.status !== "OPEN")
      throw new NotFoundError("This Club appeal is not open in your district.");
    if (appeal.sanction.issuedByUserId === userId || appeal.authorUserId === userId) {
      throw new AuthorizationError("A different moderator must decide this appeal.");
    }
    await tx.districtClubAppeal.update({
      where: { id: appeal.id }, data: {
        status: p.decision === "OVERTURN" ? "OVERTURNED" : "UPHELD",
        reviewedByUserId: userId, reviewedAt: new Date(), decisionReason: p.reason,
      },
    });
    if (p.decision === "OVERTURN" && appeal.sanction.status === "ACTIVE") {
      await tx.districtClubSanction.update({
        where: { id: appeal.sanction.id }, data: {
          status: "REVOKED", revokedByUserId: userId, revokedAt: new Date(),
        },
      });
    }
    await recordAudit({
      action: "club.appeal_reviewed", actorUserId: userId,
      entityType: "DistrictClubAppeal", entityId: appeal.id,
      metadata: { districtId: district.id, decision: p.decision },
    }, tx);
    return { decision: p.decision };
  });
}

export async function updateClubModeratorGrant(userId: string, input: unknown) {
  const p = parseOrThrow(clubGrantSchema, input);
  const steward = await prisma.fictionalPlanetSteward.findUnique({ where: { userId } });
  if (!steward?.isActive || !steward.canPublish)
    throw new AuthorizationError("Only an active planet publishing steward may provision Club moderators.");
  return prisma.$transaction(async tx => {
    const district = await tx.foundingDistrict.findUnique({
      where: { id: p.districtId },
      include: { country: { select: { status: true, planetId: true, publishedVersionId: true } } },
    });
    if (!district || district.status !== "ACTIVE" || !district.verifiedGeoVersionId ||
        district.country.status !== "PUBLISHED" || !district.country.publishedVersionId ||
        district.country.planetId !== PLANET_ID) {
      // World identity value is checked separately by the active Club access gate.
      throw new NotFoundError("Choose a verified, active founding district.");
    }
    if (p.targetUserId === userId) throw new AuthorizationError("A steward cannot provision themself.");
    if (p.active) {
      await ensureMemberInDistrict(p.targetUserId, district.id, district.countryId, tx);
    }
    await tx.districtClubModeratorGrant.upsert({
      where: { userId_districtId: { userId: p.targetUserId, districtId: district.id } },
      create: { userId: p.targetUserId, districtId: district.id, isActive: p.active },
      update: { isActive: p.active },
    });
    await recordAudit({
      action: "club.moderator_grant_updated", actorUserId: userId,
      entityType: "DistrictClubModeratorGrant", entityId: p.targetUserId,
      metadata: { districtId: district.id, active: p.active, reason: p.reason },
    }, tx);
    return { active: p.active, districtId: district.id };
  });
}
