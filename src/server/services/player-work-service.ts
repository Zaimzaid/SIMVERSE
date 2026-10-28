import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { applyJobInput, employerDecisionInput, applicantDecisionInput, jobCreateInput, WORK_NOTICE } from "@/lib/player-identity/work";
import { prisma } from "@/server/db/client";
import { ensurePlayerIdentity } from "./player-identity-service";
import { recordAudit } from "./audit-service";

const jobSelect = {
  id: true, title: true, description: true, professionCode: true, status: true, createdAt: true,
  business: { select: { id: true, name: true, sector: true } },
} satisfies Prisma.PlayerVirtualJobSelect;

async function withOrientation(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  const certificate = await prisma.playerOrientationCertificate.findUnique({
    where: { identityId: identity.id }, select: { professionCode: true },
  });
  if (!identity.username || !certificate) throw new ValidationError(
    "Set your username, choose a career and complete your SIMVERSE orientation first.");
  return { identity, certificate };
}

export async function getMyWorkCenter(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  const [businesses, jobs, mine, available, orientation] = await Promise.all([
    prisma.playerVirtualBusiness.findMany({
      where: { identityId: identity.id },
      select: { id: true, name: true, status: true, sector: true, reviewNote: true },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
    prisma.playerVirtualJob.findMany({
      where: { business: { identityId: identity.id } },
      select: {
        ...jobSelect,
        applications: {
          select: { id: true, statement: true, status: true, createdAt: true,
            applicant: { select: { username: true, user: { select: { displayName: true } } } } },
          orderBy: { createdAt: "asc" }, take: 100,
        },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    prisma.playerWorkApplication.findMany({
      where: { applicantIdentityId: identity.id },
      select: { id: true, status: true, statement: true, createdAt: true,
        employment: { select: { id: true, startedAt: true, status: true } },
        job: { select: jobSelect },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    prisma.playerVirtualJob.findMany({
      where: { status: "OPEN", business: { status: "APPROVED" } },
      select: jobSelect, orderBy: { createdAt: "desc" }, take: 100,
    }),
    prisma.playerOrientationCertificate.findUnique({
      where: { identityId: identity.id },
      select: { earnedAt: true, professionCode: true, score: true },
    }),
  ]);
  return { businesses, jobs, applications: mine, availableJobs: available,
    orientation, usernameSet: Boolean(identity.username), notice: WORK_NOTICE };
}

export async function postMyVirtualJob(userId: string, raw: unknown) {
  const data = parseOrThrow(jobCreateInput, raw);
  const { identity } = await withOrientation(userId);
  const business = await prisma.playerVirtualBusiness.findFirst({
    where: { id: data.businessId, identityId: identity.id, status: "APPROVED" },
    select: { id: true },
  });
  if (!business) throw new ValidationError("Only your separately approved SIMVERSE business may post jobs.");
  const job = await prisma.playerVirtualJob.create({
    data: { businessId: business.id, title: data.title,
      description: data.description, professionCode: data.professionCode },
    select: jobSelect,
  });
  await recordAudit({
    action: "player.work.job_posted", actorUserId: userId,
    entityType: "PlayerVirtualJob", entityId: job.id,
  });
  return { job, notice: WORK_NOTICE };
}

export async function applyForVirtualJob(userId: string, jobId: string, raw: unknown) {
  const { statement } = parseOrThrow(applyJobInput, raw);
  const { identity, certificate } = await withOrientation(userId);
  const job = await prisma.playerVirtualJob.findUnique({
    where: { id: jobId },
    include: { business: { select: { identityId: true, status: true } } },
  });
  if (!job) throw new NotFoundError("SIMVERSE job not found.");
  if (job.status !== "OPEN" || job.business.status !== "APPROVED") {
    throw new ConflictError("This simulated position is not open.");
  }
  if (job.business.identityId === identity.id) {
    throw new ValidationError("You cannot apply to your own company's vacancy.");
  }
  if (job.professionCode !== certificate.professionCode) {
    throw new ValidationError("Your completed SIMVERSE orientation does not match the job's profession.");
  }
  try {
    const application = await prisma.playerWorkApplication.create({
      data: { jobId: job.id, applicantIdentityId: identity.id, statement },
      select: { id: true, status: true },
    });
    await recordAudit({
      action: "player.work.job_applied", actorUserId: userId,
      entityType: "PlayerWorkApplication", entityId: application.id,
    });
    return { application, notice: WORK_NOTICE };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You already applied for this SIMVERSE vacancy.");
    }
    throw error;
  }
}

/** A company owner can reject submissions or issue exactly one offer at a
 * time. OFFER_PENDING locks further offers until acceptance/decline. */
export async function decideWorkApplicationAsEmployer(userId: string, applicationId: string, raw: unknown) {
  const { decision } = parseOrThrow(employerDecisionInput, raw);
  const identity = await ensurePlayerIdentity(userId);
  const application = await prisma.playerWorkApplication.findUnique({
    where: { id: applicationId },
    include: { job: { include: { business: { select: { identityId: true, status: true } } } } },
  });
  if (!application) throw new NotFoundError("Work application not found.");
  if (application.job.business.identityId !== identity.id) {
    throw new ConflictError("Only the employer may review this work application.");
  }
  if (application.job.business.status !== "APPROVED") {
    throw new ConflictError("The business is not currently approved.");
  }
  await prisma.$transaction(async (tx) => {
    if (decision === "OFFER") {
      const lock = await tx.playerVirtualJob.updateMany({
        where: { id: application.jobId, status: "OPEN" }, data: { status: "OFFER_PENDING" },
      });
      if (lock.count !== 1) throw new ConflictError("This vacancy already has an offer or is closed.");
    }
    const updated = await tx.playerWorkApplication.updateMany({
      where: { id: application.id, status: "SUBMITTED" },
      data: { status: decision === "OFFER" ? "OFFERED" : "REJECTED" },
    });
    if (updated.count !== 1) throw new ConflictError("This application was already decided.");
    await recordAudit({
      action: "player.work.employer_decision", actorUserId: userId,
      entityType: "PlayerWorkApplication", entityId: application.id,
      metadata: { decision },
    }, tx);
  });
  return { applicationId, status: decision === "OFFER" ? "OFFERED" : "REJECTED", notice: WORK_NOTICE };
}

/** Applicant must explicitly accept an offered fictional role. Atomic CAS
 * across application/job prevents duplicate placement or concurrent hires. */
export async function decideMyWorkOffer(userId: string, applicationId: string, raw: unknown) {
  const { decision } = parseOrThrow(applicantDecisionInput, raw);
  const identity = await ensurePlayerIdentity(userId);
  const application = await prisma.playerWorkApplication.findUnique({
    where: { id: applicationId },
    include: { job: { include: { business: { select: { status: true } } } } },
  });
  if (!application) throw new NotFoundError("Work application not found.");
  if (application.applicantIdentityId !== identity.id) {
    throw new ConflictError("Only this applicant can respond to the offer.");
  }
  if (application.job.business.status !== "APPROVED") {
    throw new ConflictError("Employer's virtual business is not approved.");
  }
  const result = await prisma.$transaction(async (tx) => {
    const nextJobStatus = decision === "ACCEPT" ? "CLOSED" : "OPEN";
    const locked = await tx.playerVirtualJob.updateMany({
      where: { id: application.jobId, status: "OFFER_PENDING" },
      data: { status: nextJobStatus },
    });
    if (locked.count !== 1) throw new ConflictError("This offer is no longer active.");
    const updated = await tx.playerWorkApplication.updateMany({
      where: { id: application.id, applicantIdentityId: identity.id, status: "OFFERED" },
      data: { status: decision === "ACCEPT" ? "ACCEPTED" : "DECLINED" },
    });
    if (updated.count !== 1) throw new ConflictError("The offer was already answered.");
    const employment = decision === "ACCEPT" ? await tx.playerVirtualEmployment.create({
      data: { applicationId: application.id, status: "ACTIVE" },
      select: { id: true, startedAt: true, status: true },
    }) : null;
    await recordAudit({
      action: "player.work.offer_answered", actorUserId: userId,
      entityType: "PlayerWorkApplication", entityId: application.id,
      metadata: { decision },
    }, tx);
    return employment;
  });
  return { status: decision === "ACCEPT" ? "ACCEPTED" : "DECLINED",
    employment: result, notice: WORK_NOTICE };
}
