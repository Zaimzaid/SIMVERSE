import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import {
  INTRO_QUESTIONS, ORIENTATION_VERSION, WORK_NOTICE, businessReviewInput,
  businessSubmitInput, orientationInput,
} from "@/lib/player-identity/work";
import { prisma } from "@/server/db/client";
import { ensurePlayerIdentity } from "./player-identity-service";
import { recordAudit } from "./audit-service";

// Grading keys never cross the player-facing API.
const ANSWERS: readonly number[] = [1, 2, 0];

export async function getOrientationInfo(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  const [career, certificate] = await Promise.all([
    prisma.playerCareerProfile.findUnique({ where: { identityId: identity.id } }),
    prisma.playerOrientationCertificate.findUnique({ where: { identityId: identity.id } }),
  ]);
  return {
    questions: INTRO_QUESTIONS.map(({ id, question, options }) => ({ id, question, options: [...options] })),
    version: ORIENTATION_VERSION,
    professionCode: career?.professionCode ?? null,
    certificate: certificate ? {
      professionCode: certificate.professionCode, earnedAt: certificate.earnedAt,
      score: certificate.score,
    } : null,
    notice: WORK_NOTICE,
  };
}

export async function submitOrientation(userId: string, raw: unknown) {
  const data = parseOrThrow(orientationInput, raw);
  const identity = await ensurePlayerIdentity(userId);
  const career = await prisma.playerCareerProfile.findUnique({
    where: { identityId: identity.id },
  });
  if (!career || !identity.username) throw new ValidationError("Choose your career and username before orientation.");
  const score = data.answers.filter((value, index) => value === ANSWERS[index]).length;
  if (score !== ANSWERS.length) {
    throw new ValidationError("Orientation not passed. Review the training guidance and try again.");
  }
  try {
    const certificate = await prisma.playerOrientationCertificate.create({
      data: {
        identityId: identity.id, professionCode: career.professionCode,
        assessmentVersion: ORIENTATION_VERSION, score,
      },
    });
    await recordAudit({
      action: "player.work.orientation_completed", actorUserId: userId,
      entityType: "PlayerOrientationCertificate", entityId: certificate.id,
      metadata: { professionCode: career.professionCode, version: ORIENTATION_VERSION },
    });
    return { certificate: {
      professionCode: certificate.professionCode,
      earnedAt: certificate.earnedAt, score: certificate.score,
    }, notice: WORK_NOTICE };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Orientation has already been completed for your SIMVERSE player.");
    }
    throw error;
  }
}

export async function submitBusinessForReview(userId: string, businessId: string, raw: unknown) {
  parseOrThrow(businessSubmitInput, raw);
  const identity = await ensurePlayerIdentity(userId);
  const certificate = await prisma.playerOrientationCertificate.findUnique({
    where: { identityId: identity.id },
  });
  if (!certificate) throw new ValidationError("Complete your introductory SIMVERSE orientation before submitting a business.");
  const updated = await prisma.playerVirtualBusiness.updateMany({
    where: { id: businessId, identityId: identity.id, status: "DRAFT" },
    data: { status: "PENDING_REVIEW" },
  });
  if (updated.count !== 1) throw new ConflictError("Only your own draft business may be submitted once.");
  await recordAudit({
    action: "player.work.business_submitted", actorUserId: userId,
    entityType: "PlayerVirtualBusiness", entityId: businessId,
  });
  return { status: "PENDING_REVIEW", notice: WORK_NOTICE };
}

export async function getBusinessReviewQueue(userId: string) {
  const grant = await prisma.playerBusinessReviewer.findUnique({
    where: { userId }, select: { isActive: true },
  });
  if (!grant?.isActive) throw new AuthorizationError("An independently provisioned business reviewer grant is required.");
  const businesses = await prisma.playerVirtualBusiness.findMany({
    where: { status: "PENDING_REVIEW" },
    select: {
      id: true, name: true, sector: true, description: true, createdAt: true,
      identity: { select: { userId: true, username: true, user: { select: { displayName: true } } } },
    }, orderBy: { createdAt: "asc" }, take: 100,
  });
  return { businesses, notice: WORK_NOTICE };
}

export async function reviewBusiness(userId: string, businessId: string, raw: unknown) {
  const { decision, note } = parseOrThrow(businessReviewInput, raw);
  const grant = await prisma.playerBusinessReviewer.findUnique({
    where: { userId }, select: { isActive: true },
  });
  if (!grant?.isActive) throw new AuthorizationError("Independent SIMVERSE business reviewer authorization is required.");
  const business = await prisma.playerVirtualBusiness.findUnique({
    where: { id: businessId }, select: { id: true, identity: { select: { userId: true } }, status: true },
  });
  if (!business) throw new NotFoundError("Virtual business not found.");
  if (business.identity.userId === userId) throw new AuthorizationError("You cannot approve your own company.");
  if (business.status !== "PENDING_REVIEW") throw new ConflictError("Only pending businesses can be reviewed.");
  const next = decision === "APPROVE" ? "APPROVED" : "DENIED";
  await prisma.$transaction(async (tx) => {
    const updated = await tx.playerVirtualBusiness.updateMany({
      where: { id: businessId, status: "PENDING_REVIEW" },
      data: { status: next, reviewedByUserId: userId, reviewedAt: new Date(), reviewNote: note },
    });
    if (updated.count !== 1) throw new ConflictError("Business was already reviewed.");
    await recordAudit({
      action: "player.work.business_reviewed", actorUserId: userId,
      entityType: "PlayerVirtualBusiness", entityId: businessId,
      metadata: { decision },
    }, tx);
  });
  return { businessId, status: next, notice: WORK_NOTICE };
}
