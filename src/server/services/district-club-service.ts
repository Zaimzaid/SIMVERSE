import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { PLANET_ID } from "@/lib/planet/contracts";
import { prisma } from "@/server/db/client";
import {
  DISTRICT_CLUB_ROOMS, districtClubMessageSchema, districtClubReportSchema,
  districtClubReviewSchema, districtClubRoomSchema, districtClubRules,
} from "@/lib/civilization/district-club-contract";
import { recordAudit } from "./audit-service";

type Db = Prisma.TransactionClient | typeof prisma;

async function approvedHome(userId: string, db: Db = prisma) {
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
  return district;
}

async function ensureClubModerator(userId: string, districtId: string, db: Db = prisma) {
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
    include: { message: { select: { room: true, body: true, authorUserId: true } } },
    orderBy: { createdAt: "asc" }, take: 50,
  });
  return {
    district: { id: district.id, name: district.name },
    reports: reports.map(report => ({
      id: report.id,
      messageId: report.messageId,
      messageBody: report.message.body,
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
