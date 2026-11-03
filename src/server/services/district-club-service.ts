import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { PLANET_ID } from "@/lib/planet/contracts";
import { prisma } from "@/server/db/client";
import {
  DISTRICT_CLUB_ROOMS, districtClubMessageSchema, districtClubReportSchema,
  districtClubReviewSchema, districtClubRoomSchema, districtClubRules,
  districtClubDirectoryPreferenceSchema,
} from "@/lib/civilization/district-club-contract";
import { recordAudit } from "./audit-service";

type Db = Prisma.TransactionClient | typeof prisma;

export async function approvedHome(userId: string, db: Db = prisma) {
  const [home, primary] = await Promise.all([
    db.foundingDistrictResidence.findUnique({
      where: { userId },
      include: { district: { include: { country: {
        select: { id: true, planetId: true, status: true, publishedVersionId: true },
      } } } },
    }),
    db.foundingPrimaryCitizenship.findUnique({ where: { userId } }),
  ]);
  if (!home || !primary || primary.status !== "ACTIVE" ||
      primary.countryId !== home.district.countryId) {
    throw new AuthorizationError("Club access requires active citizenship and residence in the same approved district.");
  }
  const district = home.district;
  if (district.country.planetId !== PLANET_ID ||
      district.country.status !== "PUBLISHED" ||
      !district.country.publishedVersionId ||
      district.status !== "ACTIVE" ||
      !district.activatedAt ||
      !district.verifiedGeoVersionId) {
    throw new ConflictError("The district club cannot open until its district and geography are officially approved.");
  }
  // BAN excludes members from all private Club features while the sanction is active.
  if (await db.districtClubSanction.findFirst({
    where: { districtId: district.id, targetUserId: userId, kind: "BAN",
      status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { id: true },
  })) {
    throw new AuthorizationError("Your District Club access is temporarily suspended. You can appeal in Club Safety.");
  }
  return district;
}

export async function ensureClubCanPost(userId: string, districtId: string,
  db: Db = prisma) {
  const sanction = await db.districtClubSanction.findFirst({
    where: { districtId, targetUserId: userId, status: "ACTIVE",
      expiresAt: { gt: new Date() }, kind: { in: ["MUTE", "BAN"] } },
    select: { id: true },
  });
  if (sanction) throw new AuthorizationError("Club participation is temporarily restricted; review your sanctions and appeal options.");
}

export async function ensureClubModerator(userId: string, districtId: string, db: Db = prisma) {
  // Independent club roles: neither workspace admins nor assembly moderators inherit access.
  const grant = await db.districtClubModeratorGrant.findUnique({
    where: { userId_districtId: { userId, districtId } },
  });
  if (!grant?.isActive) throw new AuthorizationError("An independent active district club moderator grant is required.");
}

export async function getMyDistrictClubHome(userId: string) {
  try {
    const district = await approvedHome(userId);
    const grant = await prisma.districtClubModeratorGrant.findUnique({
      where: { userId_districtId: { userId, districtId: district.id } },
    });
    return {
      active: true as const,
      district: { id: district.id, name: district.name },
      rooms: DISTRICT_CLUB_ROOMS.map(room => ({ ...room })),
      canModerate: Boolean(grant?.isActive),
      explanation: null,
      notice: "Residents-only social chat. Club posts do not approve construction, spend Vascoin or represent official Assembly votes.",
    };
  } catch (error) {
    if (!(error instanceof AuthorizationError) && !(error instanceof ConflictError)) throw error;
    return {
      active: false as const,
      district: null,
      rooms: DISTRICT_CLUB_ROOMS.map(room => ({ ...room })),
      canModerate: false,
      explanation: error.message,
      notice: "The District Club is not open yet. Choose a founding-country preference without receiving residence or chat access.",
    };
  }
}

export async function listMyDistrictClubMessages(userId: string, roomInput: unknown) {
  const room = parseOrThrow(districtClubRoomSchema, roomInput);
  const district = await approvedHome(userId);
  const messages = await prisma.districtClubMessage.findMany({
    where: { districtId: district.id, room, status: "VISIBLE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 60,
    include: { author: { select: { displayName: true } } },
  });
  return {
    district: { id: district.id, name: district.name },
    room,
    messages: messages.reverse().map(message => ({
      id: message.id,
      room: message.room,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      authorDisplayName: message.author.displayName,
      isMine: message.authorUserId === userId,
    })),
  };
}

export async function postMyDistrictClubMessage(userId: string, payload: unknown) {
  const { room, body } = parseOrThrow(districtClubMessageSchema, payload);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubCanPost(userId, district.id, tx);
    const oneHour = new Date(Date.now() - 3_600_000);
    const recent = await tx.districtClubMessage.findMany({
      where: { authorUserId: userId, createdAt: { gte: oneHour } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" }, take: districtClubRules.messagesPerHour,
    });
    if (recent.length >= districtClubRules.messagesPerHour) {
      throw new ConflictError("Your hourly club message limit was reached.");
    }
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() <
        districtClubRules.minimumSecondsBetweenMessages * 1_000) {
      throw new ConflictError("Please allow a few seconds between club messages.");
    }
    const message = await tx.districtClubMessage.create({
      data: { districtId: district.id, authorUserId: userId, room, body, status: "VISIBLE" },
    });
    await recordAudit({
      action: "club.message_posted", actorUserId: userId,
      entityType: "DistrictClubMessage", entityId: message.id,
      metadata: { districtId: district.id, room },
    }, tx);
    return { id: message.id, accepted: true, officialAssemblyAction: false, vascoinGranted: false };
  });
}

export async function reportDistrictClubMessage(userId: string, payload: unknown) {
  const { messageId, reason } = parseOrThrow(districtClubReportSchema, payload);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    const message = await tx.districtClubMessage.findUnique({ where: { id: messageId } });
    if (!message || message.districtId !== district.id || message.status !== "VISIBLE") {
      throw new NotFoundError("That club message is not accessible.");
    }
    if (message.authorUserId === userId) throw new ConflictError("You cannot report your own message.");
    const count = await tx.districtClubReport.count({
      where: { reporterUserId: userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (count >= districtClubRules.reportsPerHour) throw new ConflictError("Club report limit reached.");
    const existing = await tx.districtClubReport.findUnique({
      where: { messageId_reporterUserId: { messageId, reporterUserId: userId } },
    });
    if (existing) throw new ConflictError("You already reported this message.");
    const report = await tx.districtClubReport.create({
      data: { messageId, reporterUserId: userId, reason, status: "OPEN" },
    });
    await recordAudit({
      action: "club.message_reported", actorUserId: userId,
      entityType: "DistrictClubReport", entityId: report.id,
      metadata: { districtId: district.id, messageId },
    }, tx);
    return { reportId: report.id, status: "OPEN" as const, hiddenAutomatically: false };
  });
}

export async function listMyClubModerationQueue(userId: string) {
  const district = await approvedHome(userId);
  await ensureClubModerator(userId, district.id);
  const reports = await prisma.districtClubReport.findMany({
    where: { status: "OPEN", message: { districtId: district.id, status: "VISIBLE" } },
    include: { message: { select: { room: true, body: true, authorUserId: true,
      author: { select: { displayName: true } } } } },
    orderBy: { createdAt: "asc" }, take: 50,
  });
  return {
    district: { id: district.id, name: district.name },
    reports: reports.map(report => ({
      id: report.id,
      messageId: report.messageId,
      messageBody: report.message.body,
      reportedAuthorId: report.message.authorUserId,
      reportedAuthorName: report.message.author.displayName,
      room: report.message.room,
      reason: report.reason,
      createdAt: report.createdAt.toISOString(),
      ownMessage: report.message.authorUserId === userId,
      ownReport: report.reporterUserId === userId,
    })),
  };
}

export async function reviewDistrictClubReport(userId: string, payload: unknown) {
  const { reportId, action } = parseOrThrow(districtClubReviewSchema, payload);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubModerator(userId, district.id, tx);
    const report = await tx.districtClubReport.findUnique({
      where: { id: reportId },
      include: { message: { select: { districtId: true, authorUserId: true, status: true } } },
    });
    if (!report || report.message.districtId !== district.id) {
      throw new NotFoundError("Report is not in your district.");
    }
    if (report.status !== "OPEN" || report.message.status !== "VISIBLE") {
      throw new ConflictError("This report is already closed.");
    }
    if (report.reporterUserId === userId || report.message.authorUserId === userId) {
      throw new AuthorizationError("A club moderator cannot review their own report or message.");
    }
    if (action === "HIDE") {
      await tx.districtClubMessage.update({
        where: { id: report.messageId }, data: { status: "HIDDEN" },
      });
      // All outstanding reports against the hidden content are resolved.
      await tx.districtClubReport.updateMany({
        where: { messageId: report.messageId, status: "OPEN" },
        data: { status: "RESOLVED", reviewedByUserId: userId, reviewedAt: new Date() },
      });
    } else {
      await tx.districtClubReport.update({
        where: { id: report.id },
        data: { status: "RESOLVED", reviewedByUserId: userId, reviewedAt: new Date() },
      });
    }
    await recordAudit({
      action: "club.report_reviewed", actorUserId: userId,
      entityType: "DistrictClubReport", entityId: report.id,
      metadata: { districtId: district.id, action, messageId: report.messageId },
    }, tx);
    return { reviewed: true, action, hidden: action === "HIDE" };
  });
}


// K4.1 — discoverability is voluntary and district-scoped, not implied by
// chat use, residency, country preference, citizenship or profile privacy.
export async function getMyDistrictClubDirectory(userId: string) {
  const district = await approvedHome(userId);
  const [preference, members] = await Promise.all([
    prisma.districtClubDirectoryPreference.findUnique({ where: { userId } }),
    prisma.user.findMany({
      where: {
        id: { not: userId },
        clubDirectoryPreference: {
          is: { districtId: district.id, isVisible: true },
        },
        foundingResidence: { is: { districtId: district.id } },
        foundingPrimaryCitizenship: {
          is: { countryId: district.countryId, status: "ACTIVE" },
        },
        NOT: {
          OR: [
            { socialBlocksCreated: { some: { blockedId: userId } } },
            { socialBlocksReceived: { some: { blockerId: userId } } },
          ],
        },
      },
      select: {
        id: true,
        displayName: true,
        clubDirectoryPreference: { select: { intro: true } },
        playerIdentity: { select: { username: true, profileVisibility: true } },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 50,
    }),
  ]);
  const sameDistrictPreference = preference?.districtId === district.id;
  return {
    district: { id: district.id, name: district.name },
    mine: {
      visible: Boolean(sameDistrictPreference && preference?.isVisible),
      intro: sameDistrictPreference ? preference?.intro ?? "" : "",
    },
    neighbors: members.map(member => {
      const publicUsername = member.playerIdentity?.profileVisibility === "PUBLIC"
        ? member.playerIdentity.username : null;
      return {
        displayName: member.displayName,
        intro: member.clubDirectoryPreference?.intro ?? "",
        // Account identifiers are exposed only when the target also opted
        // into a public player profile (normal friend-request requirement).
        friendTargetUserId: publicUsername ? member.id : null,
        publicUsername: publicUsername ?? null,
      };
    }),
    cappedAt: 50,
    notice: "Private to opted-in residents of this approved district. Hidden by default. Changing districts requires a new opt-in.",
  };
}

export async function saveMyDistrictClubDirectoryPreference(userId: string, input: unknown) {
  const data = parseOrThrow(districtClubDirectoryPreferenceSchema, input);
  // An opted-out user can erase discoverability even if residency was revoked.
  // Never create a listing or grant access while the district is inactive.
  if (!data.visible) {
    await prisma.districtClubDirectoryPreference.updateMany({
      where: { userId }, data: { isVisible: false, intro: "" },
    });
    await recordAudit({
      action: "club.directory_preference_changed", actorUserId: userId,
      entityType: "DistrictClubDirectoryPreference", entityId: userId,
      metadata: { visible: false },
    });
    return { visible: false, intro: "" };
  }

  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubCanPost(userId, district.id, tx);
    await tx.districtClubDirectoryPreference.upsert({
      where: { userId },
      create: { userId, districtId: district.id, isVisible: true, intro: data.intro },
      update: { districtId: district.id, isVisible: true, intro: data.intro },
    });
    await recordAudit({
      action: "club.directory_preference_changed", actorUserId: userId,
      entityType: "DistrictClubDirectoryPreference", entityId: userId,
      metadata: { visible: true, districtId: district.id },
    }, tx);
    return { visible: true, intro: data.intro };
  });
}
