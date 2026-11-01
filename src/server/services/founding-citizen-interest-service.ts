import { prisma } from "@/server/db/client";
import { parseOrThrow } from "@/lib/validation";
import { recordAudit } from "./audit-service";
import {
  CITIZEN_INTEREST_STATUS, FOUNDING_NATION_NAMES,
  foundingNationName, citizenInterestInputSchema,
} from "@/lib/civilization/phase3-contract";

/**
 * Personal selection is not citizenship, residency or district membership.
 * Existing official review documents and real-Earth profile choices remain
 * entirely separate. The service does not issue approvals or create places.
 */
export async function getMyFoundingCitizenInterest(userId: string) {
  const saved = await prisma.foundingCitizenInterest.findUnique({ where: { userId } });
  return {
    status: CITIZEN_INTEREST_STATUS,
    countriesPublishedByThisFeature: 0,
    preferredNationSlug: saved?.preferredNationSlug ?? null,
    preferredNationName: foundingNationName(saved?.preferredNationSlug ?? null),
    proposedPilotInterest: saved?.proposedPilotInterest ?? false,
    activeDistrictMembership: false,
    nationalityGranted: false,
    residenceGranted: false,
    availableNations: FOUNDING_NATION_NAMES.map((nation) => ({ ...nation })),
    note: "These are preferences only. No SIMVERSE fictional nationality, residence, district membership, voting rights or virtual documents are granted.",
  };
}

export async function saveMyFoundingCitizenInterest(userId: string, input: unknown) {
  const data = parseOrThrow(citizenInterestInputSchema, input);
  const previous = await prisma.foundingCitizenInterest.findUnique({
    where: { userId },
    select: { preferredNationSlug: true, proposedPilotInterest: true },
  });
  await prisma.foundingCitizenInterest.upsert({
    where: { userId },
    create: {
      userId,
      preferredNationSlug: data.preferredNationSlug,
      proposedPilotInterest: data.proposedPilotInterest,
    },
    update: {
      preferredNationSlug: data.preferredNationSlug,
      proposedPilotInterest: data.proposedPilotInterest,
    },
  });
  await recordAudit({
    action: "user.founding_nation_interest_updated",
    actorUserId: userId,
    entityType: "FoundingCitizenInterest",
    entityId: userId,
    metadata: {
      oldNation: previous?.preferredNationSlug ?? null,
      newNation: data.preferredNationSlug,
      oldPilotInterest: previous?.proposedPilotInterest ?? false,
      newPilotInterest: data.proposedPilotInterest,
      grantsCitizenship: false,
      grantsDistrictMembership: false,
    },
  });
  return getMyFoundingCitizenInterest(userId);
}
