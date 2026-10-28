import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import {
  citizenshipPolicyProposalSchema, treatyApprovalSchema, treatyProposalSchema,
  type DualCitizenshipAssessment,
} from "@/lib/player-identity/governance";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { ensurePlayerIdentity, listPlayerHomeCountries } from "./player-identity-service";

type Db = Prisma.TransactionClient;
const countrySelect = { id: true, name: true, isoAlpha2: true } as const;
const notice = "SIMVERSE fictional citizenship and visa-waiver policy only. Not real government law, visas, residency or nationality.";

async function requireGovernor(userId: string, countryPlaceId: string, activation = false) {
  const grant = await prisma.playerCountryGovernanceGrant.findUnique({
    where: { userId_countryPlaceId: { userId, countryPlaceId } },
    select: { isActive: true, canActivate: true },
  });
  if (!grant?.isActive || (activation && !grant.canActivate)) {
    throw new AuthorizationError("An active SIMVERSE country governance grant"
      + (activation ? " with independent activation authority" : "") + " is required.");
  }
}

async function validCountry(countryPlaceId: string) {
  const record = await prisma.earthGeoPlace.findFirst({
    where: {
      id: countryPlaceId, kind: "COUNTRY",
      revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
    },
    select: countrySelect,
  });
  if (!record) throw new ValidationError("Select an active, sourced SIMVERSE virtual country.");
  return record;
}

export async function assessVirtualDualCitizenship(
  identity: { id: string; homeCountryId: string | null },
  targetCountryId: string,
  tx: Db = prisma,
  now = new Date(),
): Promise<DualCitizenshipAssessment> {
  const records = await tx.playerCitizenship.findMany({
    where: { playerIdentityId: identity.id, status: "ACTIVE" },
    select: { countryPlaceId: true },
  });
  if (records.some((r) => r.countryPlaceId === targetCountryId)) {
    return {
      eligible: false, path: "ALREADY_CITIZEN",
      checks: [{ code: "already_citizen", label: "Citizenship in this country is not already active", met: false }],
    };
  }
  if (!records.length) {
    const met = identity.homeCountryId === targetCountryId;
    return {
      eligible: met, path: met ? "FIRST_HOME" : "NOT_ELIGIBLE",
      checks: [{ code: "first_home", label: "First citizenship requires your selected virtual home country", met }],
    };
  }
  if (records.length !== 1) {
    return {
      eligible: false, path: "NOT_ELIGIBLE",
      checks: [{ code: "pilot_limit", label: "SIMVERSE pilot supports at most two active virtual citizenships", met: false }],
    };
  }
  const previousCountryId = records[0]!.countryPlaceId;
  const [previousPolicy, targetPolicy, residence] = await Promise.all([
    tx.playerCitizenshipPolicy.findFirst({
      where: { countryPlaceId: previousCountryId, status: "ACTIVE" },
      orderBy: { revision: "desc" },
      select: { allowsDualCitizenship: true },
    }),
    tx.playerCitizenshipPolicy.findFirst({
      where: { countryPlaceId: targetCountryId, status: "ACTIVE" },
      orderBy: { revision: "desc" },
      select: { allowsDualCitizenship: true, minResidenceDays: true },
    }),
    tx.playerVirtualDocument.findFirst({
      where: {
        identityId: identity.id, kind: "RESIDENCY", status: "ISSUED", expiresAt: { gt: now },
        application: { countryPlaceId: targetCountryId, status: "APPROVED" },
      },
      orderBy: { issuedAt: "desc" },
      select: { issuedAt: true, expiresAt: true },
    }),
  ]);
  const minDays = targetPolicy?.minResidenceDays ?? 180;
  const residentDays = residence ? Math.max(0,
    Math.floor((now.getTime() - residence.issuedAt.getTime()) / 86400000)) : 0;
  const checks = [
    {
      code: "first_country_policy",
      label: "First citizenship country's active SIMVERSE policy allows a second citizenship",
      met: previousPolicy?.allowsDualCitizenship === true,
    },
    {
      code: "destination_policy",
      label: "Destination's active SIMVERSE policy allows dual citizenship",
      met: targetPolicy?.allowsDualCitizenship === true,
    },
    {
      code: "residency",
      label: `Approved, valid virtual residency in destination for at least ${minDays} days`,
      met: Boolean(residence) && residentDays >= minDays,
    },
  ];
  return {
    eligible: checks.every((x) => x.met),
    path: checks.every((x) => x.met) ? "SECOND_CITIZENSHIP" : "NOT_ELIGIBLE",
    checks,
  };
}

/** Personal self-service preview, no nationality privileges granted. */
export async function getMyVirtualCitizenshipQualification(userId: string, countryPlaceId: string) {
  const country = await validCountry(countryPlaceId);
  const identity = await ensurePlayerIdentity(userId);
  return {
    country,
    assessment: await assessVirtualDualCitizenship(identity, country.id),
    notice,
  };
}

/** Country-scoped dashboard; grants are provisioned out-of-band. */
export async function getMyVirtualGovernance(userId: string) {
  const grants = await prisma.playerCountryGovernanceGrant.findMany({
    where: { userId, isActive: true },
    select: { countryPlaceId: true, canActivate: true, country: { select: countrySelect } },
  });
  if (!grants.length) throw new AuthorizationError("Country governance access has not been granted.");
  const authorizedIds = grants.map((g) => g.countryPlaceId);
  const [policies, agreements, countries] = await Promise.all([
    prisma.playerCitizenshipPolicy.findMany({
      where: { countryPlaceId: { in: authorizedIds } },
      include: { country: { select: countrySelect } },
      orderBy: [{ countryPlaceId: "asc" }, { revision: "desc" }], take: 100,
    }),
    prisma.playerBilateralTravelAgreement.findMany({
      where: { OR: [
        { originCountryId: { in: authorizedIds } },
        { destinationCountryId: { in: authorizedIds } },
      ] },
      include: {
        originCountry: { select: countrySelect },
        destinationCountry: { select: countrySelect },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
    listPlayerHomeCountries(),
  ]);
  return { grants, policies, agreements, countries, notice };
}

export async function proposeVirtualCitizenshipPolicy(userId: string, raw: unknown) {
  const data = parseOrThrow(citizenshipPolicyProposalSchema, raw);
  const country = await validCountry(data.countryPlaceId);
  await requireGovernor(userId, country.id);
  const latest = await prisma.playerCitizenshipPolicy.findFirst({
    where: { countryPlaceId: country.id }, orderBy: { revision: "desc" },
    select: { revision: true, status: true },
  });
  if (latest?.status === "DRAFT") throw new ConflictError("Review the existing draft before proposing another.");
  try {
    const policy = await prisma.playerCitizenshipPolicy.create({
      data: {
        countryPlaceId: country.id, revision: (latest?.revision ?? 0) + 1,
        allowsDualCitizenship: data.allowsDualCitizenship,
        minResidenceDays: data.minResidenceDays,
        proposedByUserId: userId,
      },
      include: { country: { select: countrySelect } },
    });
    await recordAudit({
      action: "player.governance.policy_proposed", actorUserId: userId,
      entityType: "PlayerCitizenshipPolicy", entityId: policy.id,
      metadata: { countryPlaceId: country.id, revision: policy.revision },
    });
    return { policy, notice };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Citizenship policy version conflict. Refresh before retrying.");
    }
    throw error;
  }
}

export async function activateVirtualCitizenshipPolicy(userId: string, policyId: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(policyId)) throw new NotFoundError("Virtual country policy not found.");
  const policy = await prisma.playerCitizenshipPolicy.findUnique({ where: { id: policyId } });
  if (!policy) throw new NotFoundError("Virtual country policy not found.");
  await requireGovernor(userId, policy.countryPlaceId, true);
  if (policy.proposedByUserId === userId) {
    throw new AuthorizationError("The policy proposer cannot activate their own citizenship policy.");
  }
  if (policy.status !== "DRAFT") throw new ConflictError("Only a draft citizenship policy can be activated.");
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.playerCitizenshipPolicy.findFirst({
      where: { countryPlaceId: policy.countryPlaceId, status: "ACTIVE" },
      select: { id: true },
    });
    const changed = await tx.playerCitizenshipPolicy.updateMany({
      where: { id: policy.id, status: "DRAFT" },
      data: { status: "ACTIVE", activatedByUserId: userId, activatedAt: new Date() },
    });
    if (changed.count !== 1) throw new ConflictError("The policy has already changed.");
    if (current) await tx.playerCitizenshipPolicy.updateMany({
      where: { id: current.id, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });
    await recordAudit({
      action: "player.governance.policy_activated", actorUserId: userId,
      entityType: "PlayerCitizenshipPolicy", entityId: policy.id,
      metadata: { countryPlaceId: policy.countryPlaceId, revision: policy.revision },
    }, tx);
    return tx.playerCitizenshipPolicy.findUniqueOrThrow({ where: { id: policy.id } });
  });
  return { policy: result, notice };
}

export async function proposeVirtualTreaty(userId: string, raw: unknown) {
  const pair = parseOrThrow(treatyProposalSchema, raw);
  const origin = await validCountry(pair.originCountryId);
  await validCountry(pair.destinationCountryId);
  await requireGovernor(userId, origin.id);
  try {
    const agreement = await prisma.playerBilateralTravelAgreement.create({
      data: { originCountryId: pair.originCountryId,
        destinationCountryId: pair.destinationCountryId, proposedByUserId: userId },
    });
    await recordAudit({
      action: "player.governance.treaty_proposed", actorUserId: userId,
      entityType: "PlayerBilateralTravelAgreement", entityId: agreement.id,
      metadata: { originId: pair.originCountryId, destinationId: pair.destinationCountryId },
    });
    return { agreement, notice };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("A bilateral agreement for this country pair already exists.");
    }
    throw error;
  }
}

export async function approveVirtualTreaty(
  userId: string, agreementId: string, raw: unknown,
) {
  if (!/^[a-z0-9]{20,40}$/i.test(agreementId)) throw new NotFoundError("SIMVERSE treaty not found.");
  const { countryPlaceId } = parseOrThrow(treatyApprovalSchema, raw);
  const agreement = await prisma.playerBilateralTravelAgreement.findUnique({
    where: { id: agreementId },
  });
  if (!agreement) throw new NotFoundError("SIMVERSE treaty not found.");
  if (![agreement.originCountryId, agreement.destinationCountryId].includes(countryPlaceId)) {
    throw new AuthorizationError("This SIMVERSE country is not a party to the agreement.");
  }
  await requireGovernor(userId, countryPlaceId, true);
  if (agreement.status !== "DRAFT") throw new ConflictError("The treaty is no longer awaiting approvals.");
  const originSide = countryPlaceId === agreement.originCountryId;
  if (originSide && agreement.originApprovedByUserId) throw new ConflictError("Origin country already approved.");
  if (!originSide && agreement.destinationApprovedByUserId) throw new ConflictError("Destination country already approved.");
  if (originSide && agreement.destinationApprovedByUserId === userId
    || !originSide && agreement.originApprovedByUserId === userId) {
    throw new AuthorizationError("Two different country representatives must approve a bilateral agreement.");
  }
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.playerBilateralTravelAgreement.updateMany({
      where: {
        id: agreement.id, status: "DRAFT",
        ...(originSide ? { originApprovedByUserId: null } : { destinationApprovedByUserId: null }),
      },
      data: originSide
        ? { originApprovedByUserId: userId, originApprovedAt: now }
        : { destinationApprovedByUserId: userId, destinationApprovedAt: now },
    });
    if (changed.count !== 1) throw new ConflictError("This treaty approval is already recorded.");
    const refreshed = await tx.playerBilateralTravelAgreement.findUniqueOrThrow({
      where: { id: agreement.id },
    });
    if (refreshed.originApprovedByUserId && refreshed.destinationApprovedByUserId) {
      if (refreshed.originApprovedByUserId === refreshed.destinationApprovedByUserId) {
        throw new ConflictError("Bilateral approval requires distinct authorized representatives.");
      }
      await tx.playerBilateralTravelAgreement.update({
        where: { id: agreement.id }, data: { status: "ACTIVE" },
      });
    }
    await recordAudit({
      action: "player.governance.treaty_approved", actorUserId: userId,
      entityType: "PlayerBilateralTravelAgreement", entityId: agreement.id,
      metadata: { approvedCountryPlaceId: countryPlaceId },
    }, tx);
    return tx.playerBilateralTravelAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
  });
  return { agreement: result, notice };
}
