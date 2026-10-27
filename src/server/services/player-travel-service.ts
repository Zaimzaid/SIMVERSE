import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  AuthorizationError, ConflictError, NotFoundError, ValidationError,
} from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import {
  evaluateVirtualTravel, isVirtualCredentialValid, pilotVisaExpiry,
  virtualTravelQuerySchema, virtualVisaApplicationSchema, virtualVisaDecisionSchema,
  VIRTUAL_TRAVEL_NOTICE, type TravelEvidence, type TravelMode,
} from "@/lib/player-identity/travel";
import { prisma } from "@/server/db/client";
import { ensurePlayerIdentity, listPlayerHomeCountries } from "./player-identity-service";
import { recordAudit } from "./audit-service";

const placeSelect = { id: true, name: true, isoAlpha2: true } as const;
const visaSelect = {
  id: true, status: true, purpose: true, submittedAt: true,
  reviewNote: true, reviewedAt: true, issuedAt: true, expiresAt: true, serial: true,
  originCountry: { select: placeSelect },
  destinationCountry: { select: placeSelect },
} satisfies Prisma.PlayerTravelVisaApplicationSelect;

type VisaView = Prisma.PlayerTravelVisaApplicationGetPayload<{ select: typeof visaSelect }>;

function showVisa(visa: VisaView) {
  return {
    ...visa,
    displayStatus: visa.status === "APPROVED" && visa.expiresAt
      ? (visa.expiresAt.getTime() > Date.now() ? "VALID" : "EXPIRED")
      : visa.status,
  };
}

async function checkedCountry(id: string) {
  const place = await prisma.earthGeoPlace.findFirst({
    where: {
      id, kind: "COUNTRY",
      revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
    },
    select: placeSelect,
  });
  if (!place) throw new ValidationError("Choose a supported, sourced SIMVERSE virtual country.");
  return place;
}

async function getTravelEvidence(identityId: string, originCountryId: string,
  destinationCountryId: string, now = new Date()) {
  const domestic = originCountryId === destinationCountryId;
  const [originCitizenship, destinationCitizenship, residence, route, passport, visa] =
    await Promise.all([
      prisma.playerCitizenship.findUnique({
        where: { playerIdentityId_countryPlaceId: {
          playerIdentityId: identityId, countryPlaceId: originCountryId,
        } }, select: { status: true },
      }),
      prisma.playerCitizenship.findUnique({
        where: { playerIdentityId_countryPlaceId: {
          playerIdentityId: identityId, countryPlaceId: destinationCountryId,
        } }, select: { status: true },
      }),
      prisma.playerVirtualDocument.findFirst({
        where: { identityId, kind: "RESIDENCY",
          application: { countryPlaceId: destinationCountryId, status: "APPROVED" },
          status: "ISSUED", expiresAt: { gt: now },
        },
        select: { status: true, expiresAt: true },
      }),
      domestic ? Promise.resolve(null) : prisma.playerTravelRoutePolicy.findUnique({
        where: { originCountryId_destinationCountryId: { originCountryId, destinationCountryId } },
      }),
      prisma.playerVirtualDocument.findMany({
        where: { identityId, status: "ISSUED", expiresAt: { gt: now },
          kind: { in: ["NATIONAL_PASSPORT", "INTERNATIONAL_PASSPORT"] },
          application: { countryPlaceId: originCountryId, status: "APPROVED" },
        },
        select: { kind: true, status: true, expiresAt: true },
      }),
      domestic ? Promise.resolve(null) : prisma.playerTravelVisaApplication.findUnique({
        where: { identityId_originCountryId_destinationCountryId: {
          identityId, originCountryId, destinationCountryId,
        } },
        select: { status: true, expiresAt: true },
      }),
    ]);
  const selectedKind = route?.passportKind ?? "INTERNATIONAL_PASSPORT";
  const matchingPassport = passport.find((p) => p.kind === selectedKind) ?? null;
  const validVisa = visa?.status === "APPROVED" && !!visa.expiresAt && visa.expiresAt.getTime() > now.getTime();
  const evidence: TravelEvidence = {
    domestic,
    routeEnabled: Boolean(route?.isActive),
    mode: route?.isActive && ["CLOSED", "VISA_REQUIRED", "VISA_WAIVER"].includes(route.mode)
      ? route.mode as TravelMode : null,
    activeOriginCitizenship: originCitizenship?.status === "ACTIVE",
    activeDestinationCitizenship: destinationCitizenship?.status === "ACTIVE",
    activeDestinationResidence: isVirtualCredentialValid(residence, now),
    validPassport: isVirtualCredentialValid(matchingPassport, now),
    validVisa: Boolean(validVisa),
  };
  return { evidence, route };
}

/**
 * UI/logic-only eligibility evaluation. Never moves a character or
 * authorizes a real border crossing. No policy -> closed by default.
 */
export async function checkMyVirtualTravel(userId: string, raw: unknown) {
  const data = parseOrThrow(virtualTravelQuerySchema, raw);
  const [origin, destination, identity] = await Promise.all([
    checkedCountry(data.originCountryId),
    checkedCountry(data.destinationCountryId),
    ensurePlayerIdentity(userId),
  ]);
  const { evidence, route } = await getTravelEvidence(identity.id, origin.id, destination.id);
  return {
    origin, destination, verdict: evaluateVirtualTravel(evidence),
    route: route?.isActive ? {
      mode: evidence.mode, passportKind: route.passportKind, description: route.description,
    } : null,
  };
}

export async function getMyVirtualTravelCenter(userId: string) {
  const identity = await ensurePlayerIdentity(userId);
  const [visas, countries] = await Promise.all([
    prisma.playerTravelVisaApplication.findMany({
      where: { identityId: identity.id }, select: visaSelect,
      orderBy: { submittedAt: "desc" }, take: 100,
    }),
    listPlayerHomeCountries(),
  ]);
  return { visas: visas.map(showVisa), countries, notice: VIRTUAL_TRAVEL_NOTICE };
}

/** Requires configured policy + approved virtual origin citizenship + valid passport. */
export async function submitVirtualTravelVisa(userId: string, raw: unknown) {
  const data = parseOrThrow(virtualVisaApplicationSchema, raw);
  if (data.originCountryId === data.destinationCountryId) {
    throw new ValidationError("Entry visas are for travel between different virtual countries.");
  }
  const [origin, destination, identity] = await Promise.all([
    checkedCountry(data.originCountryId), checkedCountry(data.destinationCountryId),
    ensurePlayerIdentity(userId),
  ]);
  if (!identity.username) throw new ValidationError("Choose a SIMVERSE username in My Profile first.");
  const { evidence, route } = await getTravelEvidence(identity.id, origin.id, destination.id);
  if (!route?.isActive || route.mode !== "VISA_REQUIRED") {
    throw new ConflictError("This virtual route is not configured for entry visa applications.");
  }
  const verdict = evaluateVirtualTravel(evidence);
  const missing = verdict.checks.filter((check) => check.code !== "visa" && !check.met);
  if (missing.length) {
    throw new ValidationError("SIMVERSE virtual visa prerequisites are missing.",
      missing.map((check) => ({ path: check.code, message: check.label })));
  }
  try {
    const visa = await prisma.playerTravelVisaApplication.create({
      data: {
        identityId: identity.id,
        originCountryId: origin.id, destinationCountryId: destination.id,
        policyId: route.id, purpose: data.purpose,
      },
      select: visaSelect,
    });
    await recordAudit({
      action: "player.travel.visa_applied",
      actorUserId: userId, entityType: "PlayerTravelVisaApplication", entityId: visa.id,
      metadata: { originId: origin.id, destinationId: destination.id },
    });
    return { visa: showVisa(visa), notice: VIRTUAL_TRAVEL_NOTICE };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("A SIMVERSE visa application already exists for this country pair.");
    }
    throw error;
  }
}

/** Reviewer country grants are inherited from the protected Phase 2 model;
 * workspace-admin, Earth steward and account owner never imply this grant. */
export async function getVirtualTravelReviewQueue(reviewerUserId: string) {
  const grants = await prisma.playerDocumentReviewer.findMany({
    where: { userId: reviewerUserId, isActive: true }, select: { countryPlaceId: true },
  });
  if (!grants.length) throw new AuthorizationError("Country-scoped reviewer grant required.");
  const applications = await prisma.playerTravelVisaApplication.findMany({
    where: {
      destinationCountryId: { in: grants.map((g) => g.countryPlaceId) },
      status: "PENDING_REVIEW",
    },
    select: {
      id: true, purpose: true, status: true, submittedAt: true,
      originCountry: { select: placeSelect },
      destinationCountry: { select: placeSelect },
      identity: { select: {
        userId: true, username: true, simverseId: true,
        user: { select: { displayName: true } },
      } },
    },
    orderBy: { submittedAt: "asc" }, take: 100,
  });
  return { applications, notice: VIRTUAL_TRAVEL_NOTICE };
}

export async function reviewVirtualTravelVisa(reviewerUserId: string, visaId: string, raw: unknown) {
  const decision = parseOrThrow(virtualVisaDecisionSchema, raw);
  if (!/^[a-z0-9]{20,40}$/i.test(visaId)) throw new NotFoundError("Virtual visa application not found.");
  const visa = await prisma.playerTravelVisaApplication.findUnique({
    where: { id: visaId }, include: { identity: true },
  });
  if (!visa) throw new NotFoundError("Virtual visa application not found.");
  const grant = await prisma.playerDocumentReviewer.findUnique({
    where: { userId_countryPlaceId: {
      userId: reviewerUserId, countryPlaceId: visa.destinationCountryId,
    } },
    select: { isActive: true },
  });
  if (!grant?.isActive) throw new AuthorizationError("Active reviewer grant for the destination virtual country required.");
  if (visa.identity.userId === reviewerUserId) {
    throw new AuthorizationError("Reviewers cannot approve or deny their own SIMVERSE visa.");
  }
  if (visa.status !== "PENDING_REVIEW") throw new ConflictError("This visa was already reviewed.");
  if (decision.decision === "APPROVE") {
    await checkedCountry(visa.originCountryId);
    await checkedCountry(visa.destinationCountryId);
    const { evidence, route } = await getTravelEvidence(
      visa.identityId, visa.originCountryId, visa.destinationCountryId,
    );
    const verdict = evaluateVirtualTravel(evidence);
    if (!route?.isActive || route.id !== visa.policyId || route.mode !== "VISA_REQUIRED"
      || verdict.checks.some((check) => check.code !== "visa" && !check.met)) {
      throw new ConflictError("Current route policy or player credentials no longer permit approval.");
    }
  }
  const now = new Date();
  const reviewed = await prisma.$transaction(async (tx) => {
    const result = await tx.playerTravelVisaApplication.updateMany({
      where: { id: visa.id, status: "PENDING_REVIEW" },
      data: {
        status: decision.decision === "APPROVE" ? "APPROVED" : "DENIED",
        reviewedByUserId: reviewerUserId, reviewedAt: now,
        reviewNote: decision.note,
        issuedAt: decision.decision === "APPROVE" ? now : null,
        expiresAt: decision.decision === "APPROVE" ? pilotVisaExpiry(now) : null,
        serial: decision.decision === "APPROVE" ? `SV-VISA-${randomBytes(12).toString("hex").toUpperCase()}` : null,
      },
    });
    if (result.count !== 1) throw new ConflictError("Application was already reviewed.");
    await recordAudit({
      action: "player.travel.visa_reviewed",
      actorUserId: reviewerUserId, entityType: "PlayerTravelVisaApplication",
      entityId: visa.id, metadata: { decision: decision.decision, destinationId: visa.destinationCountryId },
    }, tx);
    return tx.playerTravelVisaApplication.findUniqueOrThrow({
      where: { id: visa.id }, select: visaSelect,
    });
  });
  return { visa: showVisa(reviewed), notice: VIRTUAL_TRAVEL_NOTICE };
}
