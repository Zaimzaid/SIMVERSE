import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  AuthorizationError, ConflictError, NotFoundError, ValidationError,
} from "@/lib/errors";
import {
  documentApplicationSchema, documentDisplayStatus, documentReviewSchema,
  pilotDocumentExpiry, qualificationChecklist, type VirtualDocumentKind,
} from "@/lib/player-identity/documents";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { ensurePlayerIdentity, listPlayerHomeCountries } from "./player-identity-service";
import { assessVirtualDualCitizenship } from "./player-governance-service";
import { recordAudit } from "./audit-service";

const notice = "SIMVERSE fictional in-world records only. Not real passports, visas, citizenship, identification or travel authorization.";
const visibleCountry = {
  id: true, name: true, isoAlpha2: true,
} as const;

const applicationSelect = {
  id: true, kind: true, status: true, statement: true,
  reviewNote: true, createdAt: true, reviewedAt: true,
  country: { select: visibleCountry },
  document: { select: { serial: true, kind: true, status: true, issuedAt: true, expiresAt: true } },
} satisfies Prisma.PlayerDocumentApplicationSelect;

function showApplication(row: Prisma.PlayerDocumentApplicationGetPayload<{ select: typeof applicationSelect }>) {
  return {
    ...row,
    document: row.document ? {
      ...row.document,
      displayStatus: documentDisplayStatus(row.document),
    } : null,
  };
}

async function supportedCountry(countryPlaceId: string) {
  const country = await prisma.earthGeoPlace.findFirst({
    where: {
      id: countryPlaceId, kind: "COUNTRY",
      revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
    },
    select: visibleCountry,
  });
  if (!country) throw new ValidationError("The virtual country is not available for applications.");
  return country;
}

export async function getMyVirtualDocuments(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  const [apps, citizenships, countries] = await Promise.all([
    prisma.playerDocumentApplication.findMany({
      where: { identityId: identity.id }, select: applicationSelect,
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    prisma.playerCitizenship.findMany({
      where: { playerIdentityId: identity.id },
      select: { id: true, status: true, country: { select: visibleCountry } },
    }),
    listPlayerHomeCountries(),
  ]);
  return { applications: apps.map(showApplication), citizenships, countries, notice };
}

async function checklistFor(
  kind: VirtualDocumentKind,
  countryPlaceId: string,
  identity: { id: string; username: string | null; homeCountryId: string | null },
  tx: Prisma.TransactionClient = prisma,
) {
  const citizenship = await tx.playerCitizenship.findUnique({
    where: { playerIdentityId_countryPlaceId: { playerIdentityId: identity.id, countryPlaceId } },
    select: { status: true },
  });
  const citizenshipPath = kind === "CITIZENSHIP"
    ? await assessVirtualDualCitizenship(identity, countryPlaceId, tx)
    : null;
  return qualificationChecklist({
    kind,
    hasUsername: Boolean(identity.username),
    homeCountryMatches: citizenshipPath?.path === "FIRST_HOME" && citizenshipPath.eligible,
    eligibleSecondCitizenship: citizenshipPath?.path === "SECOND_CITIZENSHIP" && citizenshipPath.eligible,
    hasActiveVirtualCitizenship: citizenship?.status === "ACTIVE",
  });
}

export async function submitVirtualDocumentApplication(userId: string, raw: unknown) {
  const data = parseOrThrow(documentApplicationSchema, raw);
  const country = await supportedCountry(data.countryPlaceId);
  const identity = await ensurePlayerIdentity(userId);
  const checks = await checklistFor(data.kind, country.id, identity);
  const missing = checks.filter((item) => !item.satisfied);
  if (missing.length) throw new ValidationError("You have not met the SIMVERSE pilot application requirements.",
    missing.map((item) => ({ path: item.id, message: item.description })));
  try {
    const app = await prisma.playerDocumentApplication.create({
      data: {
        identityId: identity.id,
        countryPlaceId: country.id,
        kind: data.kind,
        statement: data.statement,
        eligibilityJson: JSON.stringify({ policy: "SIMVERSE-PILOT-1", checks }),
      },
      select: applicationSelect,
    });
    await recordAudit({
      action: "player.document.applied", actorUserId: userId,
      entityType: "PlayerDocumentApplication", entityId: app.id,
      metadata: { kind: app.kind, countryId: country.id },
    });
    return { application: showApplication(app), notice };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("An application of this type already exists for this virtual country.");
    }
    throw error;
  }
}

async function requireCountryReviewer(userId: string, countryPlaceId: string) {
  const grant = await prisma.playerDocumentReviewer.findUnique({
    where: { userId_countryPlaceId: { userId, countryPlaceId } },
  });
  if (!grant?.isActive) {
    throw new AuthorizationError("An active, country-scoped document reviewer grant is required.");
  }
}

/** Returns applications ONLY in virtual countries the caller can review. */
export async function getVirtualDocumentReviewQueue(userId: string) {
  const grants = await prisma.playerDocumentReviewer.findMany({
    where: { userId, isActive: true }, select: { countryPlaceId: true },
  });
  if (!grants.length) throw new AuthorizationError("No active SIMVERSE document review grant.");
  const applications = await prisma.playerDocumentApplication.findMany({
    where: { status: "PENDING_REVIEW", countryPlaceId: { in: grants.map((g) => g.countryPlaceId) } },
    select: {
      id: true, kind: true, statement: true, createdAt: true,
      country: { select: visibleCountry },
      identity: { select: { userId: true, username: true, simverseId: true, user: { select: { displayName: true } } } },
    },
    orderBy: { createdAt: "asc" }, take: 100,
  });
  return { applications, notice };
}

export async function reviewVirtualDocumentApplication(
  reviewerUserId: string, applicationId: string, raw: unknown,
) {
  const { decision, note } = parseOrThrow(documentReviewSchema, raw);
  if (!/^[a-z0-9]{20,40}$/i.test(applicationId)) {
    throw new NotFoundError("Virtual document application not found.");
  }
  const application = await prisma.playerDocumentApplication.findUnique({
    where: { id: applicationId },
    include: { identity: true },
  });
  if (!application) throw new NotFoundError("Virtual document application not found.");
  await requireCountryReviewer(reviewerUserId, application.countryPlaceId);
  if (application.identity.userId === reviewerUserId) {
    throw new AuthorizationError("You cannot review your own SIMVERSE document application.");
  }
  if (application.status !== "PENDING_REVIEW") {
    throw new ConflictError("This application has already been reviewed.");
  }
  if (decision === "APPROVE") {
    await supportedCountry(application.countryPlaceId);
    const checks = await checklistFor(application.kind as VirtualDocumentKind,
      application.countryPlaceId, application.identity);
    if (checks.some((item) => !item.satisfied)) {
      throw new ConflictError("The applicant no longer meets the SIMVERSE pilot eligibility rules.");
    }
  }

  const reviewed = await prisma.$transaction(async (tx) => {
    // Compare-and-set prevents two reviewers from approving one application.
    const changed = await tx.playerDocumentApplication.updateMany({
      where: { id: application.id, status: "PENDING_REVIEW" },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "DENIED",
        reviewedByUserId: reviewerUserId, reviewedAt: new Date(), reviewNote: note,
      },
    });
    if (changed.count !== 1) throw new ConflictError("Application was already reviewed.");

    if (decision === "APPROVE") {
      if (application.kind === "CITIZENSHIP") {
        // No second automatic grant or duplicate virtual citizenship.
        await tx.playerCitizenship.upsert({
          where: { playerIdentityId_countryPlaceId: {
            playerIdentityId: application.identityId, countryPlaceId: application.countryPlaceId,
          } },
          create: {
            playerIdentityId: application.identityId, countryPlaceId: application.countryPlaceId,
            status: "ACTIVE", sourceApplicationId: application.id, reviewedAt: new Date(),
            category: "STANDARD",
          },
          update: {
            status: "ACTIVE", sourceApplicationId: application.id, reviewedAt: new Date(),
            reviewNote: note,
          },
        });
      } else {
        const issuedAt = new Date();
        await tx.playerVirtualDocument.create({
          data: {
            applicationId: application.id,
            identityId: application.identityId,
            kind: application.kind,
            serial: `SVV-${randomBytes(12).toString("hex").toUpperCase()}`,
            issuedAt,
            expiresAt: pilotDocumentExpiry(issuedAt),
            status: "ISSUED",
          },
        });
      }
    }
    await recordAudit({
      action: "player.document.reviewed", actorUserId: reviewerUserId,
      entityType: "PlayerDocumentApplication", entityId: application.id,
      metadata: { kind: application.kind, decision, countryId: application.countryPlaceId },
    }, tx);
    return tx.playerDocumentApplication.findUniqueOrThrow({
      where: { id: application.id }, select: applicationSelect,
    });
  });
  return { application: showApplication(reviewed), notice };
}
