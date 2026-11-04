import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import {
  clubInterestCreateSchema, clubInterestIdSchema, clubInterestMembershipSchema,
  clubInterestMessageSchema, clubInterestModerationSchema, clubInterestReportSchema,
} from "@/lib/civilization/district-club-interest-contract";
import { approvedHome, ensureClubCanPost, ensureClubModerator } from "./district-club-service";
import { recordAudit } from "./audit-service";

async function groupInMyDistrict(userId: string, groupId: string) {
  const district = await approvedHome(userId);
  const group = await prisma.districtClubInterestGroup.findFirst({
    where: { id: groupId, districtId: district.id, status: "ACTIVE" },
  });
  if (!group) throw new NotFoundError("The interest group is not available to your district.");
  return { group, district };
}
async function activeMembership(userId: string, groupId: string) {
  const membership = await prisma.districtClubInterestMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (membership?.status !== "ACTIVE") throw new AuthorizationError("Join this interest group first.");
}

export async function listMyClubInterestGroups(userId: string) {
  const district = await approvedHome(userId);
  const groups = await prisma.districtClubInterestGroup.findMany({
    where: { districtId: district.id, status: "ACTIVE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 60,
    include: {
      _count: { select: { members: { where: { status: "ACTIVE",
        user: { foundingResidence: { is: { districtId: district.id } },
          foundingPrimaryCitizenship: { is: { countryId: district.countryId, status: "ACTIVE" } } },
      } } } },
      members: { where: { userId }, select: { status: true } },
      creator: { select: { displayName: true } },
    },
  });
  return { district: { id: district.id, name: district.name }, groups: groups.map(g => ({
    id: g.id, title: g.title, description: g.description,
    memberCount: g._count.members,
    joined: g.members[0]?.status === "ACTIVE",
    createdBy: g.creator.displayName,
  })) };
}

export async function createMyClubInterestGroup(userId: string, input: unknown) {
  const payload = parseOrThrow(clubInterestCreateSchema, input);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubCanPost(userId, district.id, tx);
    const recent = await tx.districtClubInterestGroup.count({
      where: { createdByUserId: userId, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    });
    if (recent >= 4) throw new ConflictError("You may create at most four interest groups per 30 days.");
    if (await tx.districtClubInterestGroup.count({
      where: { districtId: district.id, status: "ACTIVE" },
    }) >= 40) throw new ConflictError("This district has reached its active interest-group limit.");
    const group = await tx.districtClubInterestGroup.create({
      data: {
        districtId: district.id, createdByUserId: userId,
        title: payload.title, description: payload.description,
        members: { create: { userId, status: "ACTIVE" } },
      },
    });
    await recordAudit({
      action: "club.interest_group_created", actorUserId: userId,
      entityType: "DistrictClubInterestGroup", entityId: group.id,
      metadata: { districtId: district.id },
    }, tx);
    return { groupId: group.id };
  });
}

export async function changeMyClubInterestMembership(userId: string, raw: unknown) {
  const { groupId, action } = parseOrThrow(clubInterestMembershipSchema, raw);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    const group = await tx.districtClubInterestGroup.findFirst({
      where: { id: groupId, districtId: district.id, status: "ACTIVE" },
    });
    if (!group) throw new NotFoundError("The interest group is not available.");
    if (action === "JOIN") {
      await ensureClubCanPost(userId, district.id, tx);
      if ((await tx.districtClubInterestMembership.count({
        where: { groupId, status: "ACTIVE" },
      })) >= 100) throw new ConflictError("This interest group has reached its member cap.");
      await tx.districtClubInterestMembership.upsert({
        where: { groupId_userId: { userId, groupId } },
        create: { userId, groupId, status: "ACTIVE" },
        update: { status: "ACTIVE" },
      });
    } else {
      await tx.districtClubInterestMembership.updateMany({
        where: { userId, groupId }, data: { status: "LEFT" },
      });
    }
    await recordAudit({
      action: "club.interest_membership_changed", actorUserId: userId,
      entityType: "DistrictClubInterestGroup", entityId: group.id,
      metadata: { districtId: district.id, action },
    }, tx);
    return { groupId, joined: action === "JOIN" };
  });
}

export async function listMyClubInterestMessages(userId: string, rawId: unknown) {
  const groupId = parseOrThrow(clubInterestIdSchema, rawId);
  await groupInMyDistrict(userId, groupId);
  await activeMembership(userId, groupId);
  const messages = await prisma.districtClubInterestMessage.findMany({
    where: {
      groupId, status: "VISIBLE",
      author: {
        NOT: { OR: [
          { socialBlocksCreated: { some: { blockedId: userId } } },
          { socialBlocksReceived: { some: { blockerId: userId } } },
        ] },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 60,
    include: { author: { select: { displayName: true } } },
  });
  return { groupId, messages: messages.reverse().map(m => ({
    id: m.id, body: m.body, authorDisplayName: m.author.displayName,
    isMine: m.authorUserId === userId, createdAt: m.createdAt.toISOString(),
  })) };
}

export async function sendMyClubInterestMessage(userId: string, raw: unknown) {
  const { groupId, body } = parseOrThrow(clubInterestMessageSchema, raw);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubCanPost(userId, district.id, tx);
    const group = await tx.districtClubInterestGroup.findFirst({
      where: { id: groupId, districtId: district.id, status: "ACTIVE" },
    });
    if (!group) throw new NotFoundError("This group is not in your current district.");
    const m = await tx.districtClubInterestMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (m?.status !== "ACTIVE") throw new AuthorizationError("Join the interest group before posting.");
    if (await tx.districtClubInterestMessage.count({
      where: { authorUserId: userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    }) >= 30) throw new ConflictError("Hourly interest-group posting limit reached.");
    const post = await tx.districtClubInterestMessage.create({
      data: { groupId, authorUserId: userId, body },
    });
    await recordAudit({
      action: "club.interest_message_posted", actorUserId: userId,
      entityType: "DistrictClubInterestMessage", entityId: post.id,
      metadata: { districtId: district.id, groupId },
    }, tx);
    return { messageId: post.id };
  });
}

export async function reportClubInterestMessage(userId: string, raw: unknown) {
  const { messageId, reason } = parseOrThrow(clubInterestReportSchema, raw);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    const message = await tx.districtClubInterestMessage.findUnique({
      where: { id: messageId }, include: { group: true },
    });
    if (!message || message.group.districtId !== district.id ||
        message.status !== "VISIBLE" || message.authorUserId === userId) {
      throw new NotFoundError("This message cannot be reported.");
    }
    const m = await tx.districtClubInterestMembership.findUnique({
      where: { groupId_userId: { groupId: message.groupId, userId } },
    });
    if (m?.status !== "ACTIVE") throw new AuthorizationError("Join the group before reporting.");
    if (await tx.districtClubInterestReport.count({
      where: { reporterUserId: userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    }) >= 5) throw new ConflictError("Hourly report limit reached.");
    const existing = await tx.districtClubInterestReport.findUnique({
      where: { messageId_reporterUserId: { messageId, reporterUserId: userId } },
    });
    if (existing) throw new ConflictError("You have already reported this message.");
    const report = await tx.districtClubInterestReport.create({
      data: { messageId, reporterUserId: userId, reason },
    });
    await recordAudit({
      action: "club.interest_reported", actorUserId: userId,
      entityType: "DistrictClubInterestReport", entityId: report.id,
      metadata: { districtId: district.id, groupId: message.groupId },
    }, tx);
    return { reportId: report.id };
  });
}

export async function listMyClubInterestModeration(userId: string) {
  const district = await approvedHome(userId);
  await ensureClubModerator(userId, district.id);
  const reports = await prisma.districtClubInterestReport.findMany({
    where: { status: "OPEN", message: {
      group: { districtId: district.id }, status: "VISIBLE",
    } },
    include: { message: { select: { body: true, authorUserId: true, groupId: true } } },
    orderBy: { createdAt: "asc" }, take: 50,
  });
  return { district: { id: district.id, name: district.name },
    reports: reports.map(r => ({
      id: r.id, body: r.message.body, groupId: r.message.groupId,
      reason: r.reason, conflict: r.reporterUserId === userId ||
        r.message.authorUserId === userId,
    })) };
}

export async function moderateClubInterest(userId: string, raw: unknown) {
  const input = parseOrThrow(clubInterestModerationSchema, raw);
  return prisma.$transaction(async tx => {
    const district = await approvedHome(userId, tx);
    await ensureClubModerator(userId, district.id, tx);
    if (input.action === "CLOSE_GROUP") {
      const group = await tx.districtClubInterestGroup.findFirst({
        where: { id: input.groupId, districtId: district.id, status: "ACTIVE" },
      });
      if (!group || group.createdByUserId === userId) {
        throw new NotFoundError("An independent moderator must close this group.");
      }
      await tx.districtClubInterestGroup.update({
        where: { id: group.id }, data: { status: "CLOSED" },
      });
    } else {
      const report = await tx.districtClubInterestReport.findUnique({
        where: { id: input.reportId }, include: { message: { include: { group: true } } },
      });
      if (!report || report.status !== "OPEN" || report.message.status !== "VISIBLE" ||
          report.message.group.districtId !== district.id) {
        throw new NotFoundError("This report cannot be moderated.");
      }
      if (report.reporterUserId === userId || report.message.authorUserId === userId) {
        throw new AuthorizationError("A moderator cannot review their own content or report.");
      }
      if (input.action === "HIDE") {
        await tx.districtClubInterestMessage.update({
          where: { id: report.messageId }, data: { status: "HIDDEN" },
        });
        await tx.districtClubInterestReport.updateMany({
          where: { messageId: report.messageId, status: "OPEN" },
          data: { status: "RESOLVED", reviewedByUserId: userId, reviewedAt: new Date() },
        });
      } else {
        await tx.districtClubInterestReport.update({
          where: { id: report.id },
          data: { status: "RESOLVED", reviewedByUserId: userId, reviewedAt: new Date() },
        });
      }
    }
    await recordAudit({
      action: "club.interest_moderated", actorUserId: userId,
      entityType: "DistrictClubInterestGroup",
      entityId: input.action === "CLOSE_GROUP" ? input.groupId : input.reportId,
      metadata: { districtId: district.id, action: input.action },
    }, tx);
    return { reviewed: true, action: input.action };
  });
}
