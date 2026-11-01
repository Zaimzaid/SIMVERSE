import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { PLANET_ID } from "@/lib/planet/contracts";
import { foundingNationName } from "@/lib/civilization/phase3-contract";
import { denyFoundingApplicationSchema, type FoundingApplicationReadiness } from "@/lib/civilization/application-intake-contract";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";

type Db = Prisma.TransactionClient;
type ApplicationStatus = "PENDING_REVIEW" | "DENIED" | "WITHDRAWN";
const validStatus = (status: string): ApplicationStatus =>
  status === "DENIED" || status === "WITHDRAWN" ? status : "PENDING_REVIEW";

async function publishedFoundingCountry(slug: string, db: Db | typeof prisma) {
  if (!foundingNationName(slug)) return null;
  const countries = await db.fictionalCountry.findMany({
    where: { planetId: PLANET_ID, status: "PUBLISHED", publishedVersionId: { not: null } },
    select: {
      id: true, status: true, publishedVersionId: true,
      versions: { select: { id: true, slug: true, name: true, revision: true } },
    },
    take: 100,
  });
  for (const country of countries) {
    const version = country.versions.find((v) => v.id === country.publishedVersionId);
    if (version?.slug === slug) return { id: country.id, name: version.name, revision: version.revision };
  }
  return null;
}

async function readinessData(userId: string, db: Db | typeof prisma = prisma) {
  const [draft, previous, identity] = await Promise.all([
    db.foundingCitizenshipDraft.findUnique({ where: { userId } }),
    db.foundingCitizenshipApplication.findUnique({
      where: { userId },
      select: { id: true, status: true, countryId: true, submittedNationSlug: true, createdAt: true, reviewedAt: true, reviewNote: true },
    }),
    db.playerIdentity.findUnique({ where: { userId }, select: { username: true } }),
  ]);
  const targetName = draft ? foundingNationName(draft.targetNationSlug) : null;
  const published = draft ? await publishedFoundingCountry(draft.targetNationSlug, db) : null;
  const intake = published ? await db.foundingCitizenshipIntake.findUnique({
    where: { countryId: published.id },
    select: { isOpen: true, policyVersion: true },
  }) : null;

  const checks = [
    { key: "draft", label: "Save a private founding-country application draft", met: Boolean(draft && targetName) },
    { key: "account", label: "Complete your SIMVERSE username", met: Boolean(identity?.username) },
    { key: "published", label: "Country has an independently published fictional territory", met: Boolean(published) },
    { key: "intake", label: "Country citizenship intake is explicitly opened by the operator", met: Boolean(published && intake?.isOpen) },
    { key: "one_application", label: "No previous founding-country application exists for this account", met: !previous },
  ];
  const canSubmit = checks.every((check) => check.met);
  const stage: FoundingApplicationReadiness["stage"] = previous ? "ALREADY_SUBMITTED"
    : !draft ? "NO_DRAFT"
    : !identity?.username ? "ACCOUNT_INCOMPLETE"
    : !published ? "NOT_PUBLISHED"
    : !intake?.isOpen ? "INTAKE_CLOSED" : "READY_TO_SUBMIT";

  const readiness: FoundingApplicationReadiness = {
    stage,
    countryName: targetName,
    countryId: published?.id ?? null,
    publishedRevision: published?.revision ?? null,
    checks,
    canSubmit,
    citizenshipGranted: false,
  };
  return { draft, previous, published, intake, readiness };
}

/** Safe self-service overview; never grants or implies an issued nationality. */
export async function getMyFoundingApplicationReadiness(userId: string) {
  const result = await readinessData(userId);
  return {
    ...result.readiness,
    application: result.previous ? {
      id: result.previous.id,
      status: validStatus(result.previous.status),
      submittedNationSlug: result.previous.submittedNationSlug,
      submittedAt: result.previous.createdAt,
      reviewedAt: result.previous.reviewedAt,
      reviewNote: result.previous.reviewNote,
    } : null,
    note: "Founding nationality is never automatically issued. Only published countries with independently opened intake can receive applications. This version has no approval or issuance operation.",
  };
}

export async function submitMyFoundingCitizenshipApplication(userId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { draft, published, intake, readiness } = await readinessData(userId, tx);
      if (!readiness.canSubmit || !draft || !published || !intake?.isOpen) {
        throw new ConflictError("Application intake is not available for your account or selected country. Review the requirements first.");
      }
      const app = await tx.foundingCitizenshipApplication.create({
        data: {
          userId,
          countryId: published.id,
          submittedNationSlug: draft.targetNationSlug,
          motivation: draft.motivation,
          status: "PENDING_REVIEW",
          intakePolicyVersion: intake.policyVersion,
        },
      });
      await recordAudit({
        action: "user.founding_citizenship_application_submitted",
        actorUserId: userId,
        entityType: "FoundingCitizenshipApplication",
        entityId: app.id,
        metadata: { countryId: published.id, publishedRevision: published.revision, policyVersion: intake.policyVersion },
      }, tx);
      return { id: app.id, status: "PENDING_REVIEW" as const, citizenshipGranted: false as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You already have an application. Only one is permitted during this pilot.");
    }
    throw error;
  }
}

export async function withdrawMyFoundingCitizenshipApplication(userId: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.foundingCitizenshipApplication.findUnique({ where: { userId } });
    if (!app || app.status !== "PENDING_REVIEW") {
      throw new ConflictError("Only an application still awaiting review can be withdrawn.");
    }
    const changed = await tx.foundingCitizenshipApplication.updateMany({
      where: { id: app.id, userId, status: "PENDING_REVIEW" },
      data: { status: "WITHDRAWN" },
    });
    if (changed.count !== 1) throw new ConflictError("This application already changed.");
    await recordAudit({
      action: "user.founding_citizenship_application_withdrawn",
      actorUserId: userId, entityType: "FoundingCitizenshipApplication", entityId: app.id,
      metadata: { countryId: app.countryId },
    }, tx);
    return { id: app.id, status: "WITHDRAWN" as const, citizenshipGranted: false as const };
  });
}

/** Only country-scoped grants can view applicant motivations. */
export async function getMyFoundingReviewQueue(reviewerId: string) {
  const grants = await prisma.foundingCitizenshipReviewerGrant.findMany({
    where: { userId: reviewerId, isActive: true },
    select: { countryId: true },
  });
  if (!grants.length) throw new AuthorizationError("No active country-scoped founding-citizenship reviewer grant.");
  const applications = await prisma.foundingCitizenshipApplication.findMany({
    where: { status: "PENDING_REVIEW", countryId: { in: grants.map((g) => g.countryId) } },
    select: {
      id: true, status: true, motivation: true, submittedNationSlug: true, createdAt: true,
      user: { select: { displayName: true } },
      country: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" }, take: 50,
  });
  return { applications, permittedCountries: grants.length, canIssueCitizenship: false as const };
}

/** Limited reviewer action: DENY only. No approval or issuance is implemented. */
export async function denyFoundingCitizenshipApplication(reviewerId: string, payload: unknown) {
  const { applicationId, reviewNote } = parseOrThrow(denyFoundingApplicationSchema, payload);
  return prisma.$transaction(async (tx) => {
    const app = await tx.foundingCitizenshipApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new ValidationError("No pending application with that ID.");
    const grant = await tx.foundingCitizenshipReviewerGrant.findUnique({
      where: { userId_countryId: { userId: reviewerId, countryId: app.countryId } },
    });
    if (!grant?.isActive) throw new AuthorizationError("Active reviewer permission for this founding country is required.");
    if (app.userId === reviewerId) throw new AuthorizationError("You cannot review your own application.");
    const changed = await tx.foundingCitizenshipApplication.updateMany({
      where: { id: applicationId, countryId: app.countryId, status: "PENDING_REVIEW" },
      data: { status: "DENIED", reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewNote },
    });
    if (changed.count !== 1) throw new ConflictError("Application has already been reviewed or withdrawn.");
    await recordAudit({
      action: "user.founding_citizenship_application_denied",
      actorUserId: reviewerId, entityType: "FoundingCitizenshipApplication", entityId: applicationId,
      metadata: { countryId: app.countryId },
    }, tx);
    return { id: applicationId, status: "DENIED" as const, citizenshipGranted: false as const };
  });
}
