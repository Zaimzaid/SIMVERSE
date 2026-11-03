import { Prisma } from "@prisma/client";
import { ConflictError, ValidationError } from "@/lib/errors";
import { PLANET_ID } from "@/lib/planet/contracts";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";

const TRANSFER_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const BALLOT_TENURE_MS = 14 * 24 * 60 * 60 * 1000;
const VISIT_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;
const validId = (id: string) => /^[a-z0-9_-]{8,64}$/i.test(id);

export const foundingMobilityPolicy = {
  transferCooldownDays: 30,
  ballotResidenceTenureDays: 14,
  visitDurationDays: 7,
} as const;

async function verifiedDistrict(id: string, db: Prisma.TransactionClient | typeof prisma) {
  const district = await db.foundingDistrict.findUnique({
    where: { id },
    include: { country: { select: { id: true, planetId: true, status: true, publishedVersionId: true } } },
  });
  if (!district || district.status !== "ACTIVE" || !district.verifiedGeoVersionId || !district.activatedAt
    || district.capacity <= 0 || district.country.planetId !== PLANET_ID || district.country.status !== "PUBLISHED"
    || !district.country.publishedVersionId) {
    throw new ConflictError("The destination district is not an approved active fictional location.");
  }
  return district;
}

export async function listJoinableFoundingDistricts(userId: string) {
  const primary = await prisma.foundingPrimaryCitizenship.findUnique({ where: { userId } });
  if (!primary || primary.status !== "ACTIVE") return { districts: [], requiresPrimaryNationality: true };
  const raw = await prisma.foundingDistrict.findMany({
    where: { countryId: primary.countryId, status: "ACTIVE", verifiedGeoVersionId: { not: null },
      activatedAt: { not: null }, capacity: { gt: 0 },
      country: { planetId: PLANET_ID, status: "PUBLISHED", publishedVersionId: { not: null } },
    },
    select: { id: true, name: true, countryId: true, capacity: true, occupied: true }, take: 100,
    orderBy: { name: "asc" },
  });
  return { districts: raw.map((d) => ({ ...d, available: Math.max(0, d.capacity - d.occupied) })),
    requiresPrimaryNationality: false };
}

/** One current home per account, backed by a unique userId and atomic occupancy. */
export async function joinOrTransferFoundingDistrict(userId: string, districtId: string) {
  if (!validId(districtId)) throw new ValidationError("Choose a valid reviewed district.");
  return prisma.$transaction(async (tx) => {
    const [primary, previous, destination] = await Promise.all([
      tx.foundingPrimaryCitizenship.findUnique({ where: { userId } }),
      tx.foundingDistrictResidence.findUnique({ where: { userId } }),
      verifiedDistrict(districtId, tx),
    ]);
    if (!primary || primary.status !== "ACTIVE" || primary.countryId !== destination.countryId) {
      throw new ConflictError("An active primary nationality in this country is required to settle in the district.");
    }
    if (previous?.districtId === districtId) throw new ConflictError("This is already your current home district.");
    if (previous && Date.now() - previous.lastTransferAt.getTime() < TRANSFER_COOLDOWN_MS) {
      throw new ConflictError("District transfers have a 30-day cooldown.");
    }
    const reserved = await tx.foundingDistrict.updateMany({
      where: { id: destination.id, status: "ACTIVE", occupied: { lt: destination.capacity } },
      data: { occupied: { increment: 1 } },
    });
    if (reserved.count !== 1) throw new ConflictError("This district is full or no longer accepting residents.");
    if (previous) {
      await tx.foundingDistrict.update({
        where: { id: previous.districtId }, data: { occupied: { decrement: 1 } },
      });
    }
    const at = new Date();
    await tx.foundingDistrictResidence.upsert({
      where: { userId },
      create: { userId, districtId: destination.id, startedAt: at, lastTransferAt: at },
      update: { districtId: destination.id, startedAt: at, lastTransferAt: at },
    });
    // Moving districts revokes an earlier voluntary Club directory listing.
    // Even a future return to the original district requires fresh consent.
    await tx.districtClubDirectoryPreference.updateMany({
      where: { userId },
      data: { isVisible: false, intro: "" },
    });
    await tx.foundingDistrictMove.create({
      data: { userId, fromDistrictId: previous?.districtId ?? null, toDistrictId: destination.id },
    });
    await recordAudit({
      action: "user.founding_district_residence_changed",
      actorUserId: userId, entityType: "FoundingDistrictResidence", entityId: userId,
      metadata: { from: previous?.districtId ?? null, to: destination.id },
    }, tx);
    return { districtId: destination.id, districtName: destination.name, residenceAssigned: true,
      nextTransferAvailableAt: new Date(at.getTime() + TRANSFER_COOLDOWN_MS) };
  });
}

export async function getMyFoundingCivicStatus(userId: string) {
  const [primary, residence, visit] = await Promise.all([
    prisma.foundingPrimaryCitizenship.findUnique({
      where: { userId }, select: { countryId: true, issuedAt: true, status: true, country: { select: { name: true } } },
    }),
    prisma.foundingDistrictResidence.findUnique({
      where: { userId }, include: { district: { include: {
        country: { select: { status: true, planetId: true, publishedVersionId: true } },
      } } },
    }),
    prisma.foundingVisit.findUnique({
      where: { userId }, select: { countryId: true, arrivedAt: true, expiresAt: true,
        country: { select: { name: true } } },
    }),
  ]);
  const stillApproved = Boolean(residence && primary?.status === "ACTIVE"
    && residence.district.countryId === primary.countryId
    && residence.district.status === "ACTIVE"
    && residence.district.verifiedGeoVersionId
    && residence.district.activatedAt
    && residence.district.country.status === "PUBLISHED"
    && residence.district.country.publishedVersionId
    && residence.district.country.planetId === PLANET_ID);
  const eligibleToVote = stillApproved
    && Date.now() - residence!.startedAt.getTime() >= BALLOT_TENURE_MS;
  return {
    primaryNationality: primary?.status === "ACTIVE" ? {
      countryId: primary.countryId, countryName: primary.country.name, issuedAt: primary.issuedAt,
    } : null,
    residence: residence && stillApproved ? {
      districtId: residence.districtId, districtName: residence.district.name, since: residence.startedAt,
      nextTransferAvailableAt: new Date(residence.lastTransferAt.getTime() + TRANSFER_COOLDOWN_MS),
    } : null,
    visit: visit && visit.expiresAt.getTime() > Date.now()
      ? { countryId: visit.countryId, countryName: visit.country.name, expiresAt: visit.expiresAt } : null,
    ballotDistrictId: eligibleToVote ? residence!.districtId : null,
    eligibleToVote: Boolean(eligibleToVote),
    votingNotice: "Only one current home district can become eligible after 14 days of continuous approved residence. Travel does not change the ballot district.",
    policies: foundingMobilityPolicy,
  };
}

export async function beginFoundingVisit(userId: string, countryId: string) {
  if (!validId(countryId)) throw new ValidationError("Choose a valid published fictional country.");
  const country = await prisma.fictionalCountry.findFirst({
    where: { id: countryId, planetId: PLANET_ID, status: "PUBLISHED", publishedVersionId: { not: null } },
    select: { id: true, name: true },
  });
  if (!country) throw new ConflictError("Travel is not available to an unpublished fictional country.");
  const expiresAt = new Date(Date.now() + VISIT_LENGTH_MS);
  await prisma.foundingVisit.upsert({
    where: { userId }, create: { userId, countryId, expiresAt },
    update: { countryId, districtId: null, arrivedAt: new Date(), expiresAt },
  });
  await recordAudit({ action: "user.founding_travel_started", actorUserId: userId,
    entityType: "FoundingVisit", entityId: userId, metadata: { countryId } });
  return { countryId, countryName: country.name, expiresAt, changedResidence: false, changedCitizenship: false };
}

export async function endFoundingVisit(userId: string) {
  await prisma.foundingVisit.deleteMany({ where: { userId } });
  await recordAudit({ action: "user.founding_travel_ended", actorUserId: userId,
    entityType: "FoundingVisit", entityId: userId });
  return { ended: true, changedResidence: false, changedCitizenship: false };
}
