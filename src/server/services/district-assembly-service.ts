import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { PLANET_ID } from "@/lib/planet/contracts";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import {
  districtIdSchema, proposalInputSchema, commentInputSchema, voteInputSchema,
  reviewProposalSchema, reviewCommentSchema, noticeInputSchema, reportInputSchema,
  assemblyPolicy,
} from "@/lib/civilization/assembly-contract";

type Database = Prisma.TransactionClient | typeof prisma;

async function activeDistrict(districtId: string, db: Database = prisma) {
  const district = await db.foundingDistrict.findUnique({
    where: { id: districtId },
    include: { country: { select: { planetId: true, status: true, publishedVersionId: true } } },
  });
  if (!district || district.status !== "ACTIVE" || !district.verifiedGeoVersionId || !district.activatedAt
    || district.country.planetId !== PLANET_ID || district.country.status !== "PUBLISHED"
    || !district.country.publishedVersionId) {
    throw new ConflictError("The district assembly is not active or has no approved geography.");
  }
  return district;
}

async function resident(userId: string, districtId: string, db: Database = prisma) {
  const district = await activeDistrict(districtId, db);
  const [home, primary] = await Promise.all([
    db.foundingDistrictResidence.findUnique({ where: { userId } }),
    db.foundingPrimaryCitizenship.findUnique({ where: { userId } }),
  ]);
  if (!home || home.districtId !== district.id || !primary
    || primary.status !== "ACTIVE" || primary.countryId !== district.countryId) {
    throw new AuthorizationError("Active citizenship and current residence in this district are required.");
  }
  return { district, home };
}

async function moderator(userId: string, districtId: string, db: Database = prisma) {
  await activeDistrict(districtId, db);
  const grant = await db.districtAssemblyModeratorGrant.findUnique({
    where: { userId_districtId: { userId, districtId } },
  });
  if (!grant?.isActive) throw new AuthorizationError("An independent active district moderator grant is required.");
}

async function proposalForMember(userId: string, proposalId: string, db: Database = prisma) {
  const proposal = await db.districtAssemblyProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new ValidationError("Unknown district proposal.");
  await resident(userId, proposal.districtId, db);
  return proposal;
}

function since(hours: number) { return new Date(Date.now() - hours * 60 * 60 * 1000); }

export async function listMyAssemblyDistricts(userId: string) {
  const home = await prisma.foundingDistrictResidence.findUnique({ where: { userId } });
  if (!home) return { districts: [], explanation: "Join an approved active district before entering its assembly." };
  try {
    const { district } = await resident(userId, home.districtId);
    return { districts: [{ id: district.id, name: district.name }], explanation: null };
  } catch {
    return { districts: [], explanation: "Your home district is not currently approved and active." };
  }
}

export async function getDistrictAssembly(userId: string, districtId: string) {
  parseOrThrow(districtIdSchema, districtId);
  const { district } = await resident(userId, districtId);
  const [proposals, notices, grant] = await Promise.all([
    prisma.districtAssemblyProposal.findMany({
      where: { districtId },
      select: {
        id: true, title: true, category: true, status: true, description: true,
        createdAt: true, reviewReason: true,
        author: { select: { displayName: true } },
        votes: { select: { userId: true, choice: true } },
        comments: {
          where: { status: "VISIBLE" },
          select: { id: true, body: true, createdAt: true,
            author: { select: { displayName: true } } },
          orderBy: { createdAt: "asc" }, take: 50,
        },
      },
      orderBy: { createdAt: "desc" }, take: 40,
    }),
    prisma.districtAssemblyNotice.findMany({
      where: { districtId }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, body: true, kind: true, scheduledFor: true, createdAt: true },
    }),
    prisma.districtAssemblyModeratorGrant.findUnique({
      where: { userId_districtId: { userId, districtId } },
    }),
  ]);
  const isModerator = Boolean(grant?.isActive);
  const { home } = await resident(userId, districtId);
  const voteEligible = Date.now() - home.startedAt.getTime() >= assemblyPolicy.minimumVotingResidenceDays * 86_400_000;
  return {
    district: { id: district.id, name: district.name },
    canPropose: true, canComment: true, canVote: voteEligible,
    canModerate: isModerator,
    notices,
    proposals: proposals.filter((p) => p.status !== "PENDING_MODERATION" || isModerator).map((p) => ({
      id: p.id, title: p.title, category: p.category, status: p.status, description: p.description,
      authorDisplayName: p.author.displayName, createdAt: p.createdAt, reviewReason: p.reviewReason,
      support: p.votes.filter((v) => v.choice === "SUPPORT").length,
      oppose: p.votes.filter((v) => v.choice === "OPPOSE").length,
      myVote: p.votes.find((v) => v.userId === userId)?.choice ?? null,
      comments: p.comments.map((c) => ({
        id: c.id, body: c.body, createdAt: c.createdAt, authorDisplayName: c.author.displayName,
      })),
    })),
    warning: "Assembly decisions and votes are advisory. No vote constructs buildings, transfers land, spends Vascoin or authorizes staff development.",
  };
}

export async function submitDistrictProposal(userId: string, payload: unknown) {
  const data = parseOrThrow(proposalInputSchema, payload);
  await resident(userId, data.districtId);
  const count = await prisma.districtAssemblyProposal.count({
    where: { authorUserId: userId, createdAt: { gte: since(24) } },
  });
  if (count >= assemblyPolicy.proposalsPer24Hours) throw new ConflictError("You have reached the 24-hour proposal limit.");
  const proposal = await prisma.districtAssemblyProposal.create({
    data: { districtId: data.districtId, authorUserId: userId, title: data.title,
      description: data.description, category: data.category, status: "PENDING_MODERATION" },
  });
  await recordAudit({ action: "assembly.proposal_submitted", actorUserId: userId,
    entityType: "DistrictAssemblyProposal", entityId: proposal.id, metadata: { districtId: data.districtId } });
  return { id: proposal.id, status: "PENDING_MODERATION" as const, developmentApproved: false as const };
}

export async function postDistrictComment(userId: string, payload: unknown) {
  const data = parseOrThrow(commentInputSchema, payload);
  const proposal = await proposalForMember(userId, data.proposalId);
  if (proposal.status !== "OPEN") throw new ConflictError("Discussion is only open on published assembly proposals.");
  const count = await prisma.districtAssemblyComment.count({
    where: { authorUserId: userId, createdAt: { gte: since(1) } },
  });
  if (count >= assemblyPolicy.commentsPerHour) throw new ConflictError("Hourly discussion limit reached.");
  const comment = await prisma.districtAssemblyComment.create({
    data: { proposalId: proposal.id, authorUserId: userId, body: data.body, status: "PENDING_MODERATION" },
  });
  return { id: comment.id, status: "PENDING_MODERATION" as const };
}

export async function castDistrictVote(userId: string, payload: unknown) {
  const data = parseOrThrow(voteInputSchema, payload);
  try {
    return await prisma.$transaction(async (tx) => {
      const proposal = await proposalForMember(userId, data.proposalId, tx);
      if (proposal.status !== "OPEN") throw new ConflictError("Voting is closed for this proposal.");
      const residence = await tx.foundingDistrictResidence.findUnique({ where: { userId } });
      if (!residence || Date.now() - residence.startedAt.getTime()
        < assemblyPolicy.minimumVotingResidenceDays * 86_400_000) {
        throw new AuthorizationError("District voting requires 14 days of continuous approved residence.");
      }
      const result = await tx.districtAssemblyVote.create({
        data: { proposalId: proposal.id, userId, choice: data.choice },
      });
      await recordAudit({ action: "assembly.vote_cast", actorUserId: userId,
        entityType: "DistrictAssemblyVote", entityId: result.proposalId,
        metadata: { districtId: proposal.districtId, choice: data.choice } }, tx);
      return { recorded: true, choice: data.choice, bindingDevelopmentDecision: false as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You have already voted on this proposal.");
    }
    throw error;
  }
}

export async function moderateDistrictProposal(userId: string, payload: unknown) {
  const data = parseOrThrow(reviewProposalSchema, payload);
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.districtAssemblyProposal.findUnique({ where: { id: data.proposalId } });
    if (!proposal) throw new ValidationError("Unknown proposal.");
    await moderator(userId, proposal.districtId, tx);
    if (proposal.authorUserId === userId) throw new AuthorizationError("You cannot moderate your own proposal.");
    const fromStatus = data.action === "SHORTLIST" ? "OPEN" : "PENDING_MODERATION";
    const nextStatus = data.action === "OPEN" ? "OPEN"
      : data.action === "REJECT" ? "REJECTED" : "SHORTLISTED_FOR_FEASIBILITY";
    if (proposal.status !== fromStatus) throw new ConflictError("Proposal is no longer in the required review state.");
    if (data.action === "REJECT" && data.reason.length < 8) throw new ValidationError("Give a clear rejection reason.");
    if (data.action === "SHORTLIST") {
      const [support, oppose] = await Promise.all([
        tx.districtAssemblyVote.count({ where: { proposalId: proposal.id, choice: "SUPPORT" } }),
        tx.districtAssemblyVote.count({ where: { proposalId: proposal.id, choice: "OPPOSE" } }),
      ]);
      if (support < assemblyPolicy.minimumSupportForShortlist || support <= oppose) {
        throw new ConflictError("Shortlisting requires at least three supporting votes and a supporting majority.");
      }
    }
    const changed = await tx.districtAssemblyProposal.updateMany({
      where: { id: proposal.id, status: fromStatus },
      data: { status: nextStatus, reviewReason: data.reason || null,
        reviewedByUserId: userId, reviewedAt: new Date() },
    });
    if (changed.count !== 1) throw new ConflictError("This proposal has already changed.");
    await recordAudit({ action: "assembly.proposal_moderated", actorUserId: userId,
      entityType: "DistrictAssemblyProposal", entityId: proposal.id,
      metadata: { action: data.action, nextStatus, districtId: proposal.districtId } }, tx);
    return { id: proposal.id, status: nextStatus, built: false, fundingAuthorized: false };
  });
}

export async function moderateDistrictComment(userId: string, payload: unknown) {
  const data = parseOrThrow(reviewCommentSchema, payload);
  const comment = await prisma.districtAssemblyComment.findUnique({
    where: { id: data.commentId }, include: { proposal: { select: { districtId: true } } },
  });
  if (!comment) throw new ValidationError("Unknown comment.");
  await moderator(userId, comment.proposal.districtId);
  if (comment.authorUserId === userId) throw new AuthorizationError("You cannot review your own comment.");
  const status = data.action === "SHOW" ? "VISIBLE" : "HIDDEN";
  await prisma.districtAssemblyComment.update({ where: { id: comment.id }, data: { status } });
  await recordAudit({ action: "assembly.comment_moderated", actorUserId: userId,
    entityType: "DistrictAssemblyComment", entityId: comment.id,
    metadata: { districtId: comment.proposal.districtId, status } });
  return { id: comment.id, status };
}

export async function createDistrictNotice(userId: string, payload: unknown) {
  const data = parseOrThrow(noticeInputSchema, payload);
  await moderator(userId, data.districtId);
  const date = data.scheduledFor ? new Date(data.scheduledFor) : null;
  if (data.kind === "MEETING" && (!date || date.getTime() < Date.now() || date.getTime() > Date.now() + 90 * 86_400_000)) {
    throw new ValidationError("Meeting must be scheduled within the next 90 days.");
  }
  if (data.kind === "ANNOUNCEMENT" && date) throw new ValidationError("Announcements do not have meeting dates.");
  const notice = await prisma.districtAssemblyNotice.create({
    data: { districtId: data.districtId, authorUserId: userId, title: data.title, body: data.body,
      kind: data.kind, scheduledFor: date },
  });
  await recordAudit({ action: "assembly.notice_posted", actorUserId: userId,
    entityType: "DistrictAssemblyNotice", entityId: notice.id, metadata: { kind: data.kind, districtId: data.districtId } });
  return { id: notice.id, kind: notice.kind, meetingConfirmedByStaff: false };
}

export async function reportDistrictContent(userId: string, payload: unknown) {
  const data = parseOrThrow(reportInputSchema, payload);
  const proposal = await proposalForMember(userId, data.proposalId);
  if (data.commentId) {
    const comment = await prisma.districtAssemblyComment.findFirst({
      where: { id: data.commentId, proposalId: proposal.id },
    });
    if (!comment) throw new ValidationError("Comment does not belong to this proposal.");
  }
  const recent = await prisma.districtAssemblyReport.count({
    where: { reporterUserId: userId, createdAt: { gte: since(1) } },
  });
  if (recent >= assemblyPolicy.reportsPerHour) throw new ConflictError("Hourly report limit reached.");
  const report = await prisma.districtAssemblyReport.create({
    data: { proposalId: proposal.id, commentId: data.commentId, reporterUserId: userId,
      reason: data.reason, status: "OPEN" },
  });
  await recordAudit({ action: "assembly.report_submitted", actorUserId: userId,
    entityType: "DistrictAssemblyReport", entityId: report.id,
    metadata: { proposalId: proposal.id, districtId: proposal.districtId } });
  return { reportId: report.id, status: "OPEN" as const };
}

export async function getDistrictModerationQueue(userId: string, districtId: string) {
  parseOrThrow(districtIdSchema, districtId);
  await moderator(userId, districtId);
  const [proposals, comments, reports] = await Promise.all([
    prisma.districtAssemblyProposal.findMany({
      where: { districtId, status: "PENDING_MODERATION" }, take: 40,
      select: { id: true, title: true, description: true, category: true, createdAt: true } }),
    prisma.districtAssemblyComment.findMany({
      where: { proposal: { districtId }, status: "PENDING_MODERATION" }, take: 40,
      select: { id: true, body: true, proposalId: true, createdAt: true } }),
    prisma.districtAssemblyReport.findMany({
      where: { proposal: { districtId }, status: "OPEN" }, take: 40,
      select: { id: true, reason: true, proposalId: true, commentId: true, createdAt: true } }),
  ]);
  return { proposals, comments, reports, canApproveConstruction: false, canSpendDistrictFunds: false };
}
