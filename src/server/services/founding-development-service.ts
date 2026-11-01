import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { PLANET_ID } from "@/lib/planet/contracts";
import {
  candidateAreaSchema, developmentDistrictSchema, developmentDisclaimer,
  DEVELOPMENT_MAX_PUBLIC_UPDATES_PER_DAY, publishPlanningUpdateSchema,
  recordFeasibilitySchema, startFeasibilitySchema,
} from "@/lib/civilization/development-contract";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";

type Db = Prisma.TransactionClient | typeof prisma;
const startOfUtcDay = () => {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

async function requireStaff(userId: string, districtId: string, db: Db = prisma) {
  const [district, grant] = await Promise.all([
    db.foundingDistrict.findUnique({
      where: { id: districtId },
      include: { country: { select: { planetId: true, status: true } } },
    }),
    db.foundingDevelopmentStaffGrant.findUnique({
      where: { userId_districtId: { userId, districtId } },
    }),
  ]);
  if (!district || district.country.planetId !== PLANET_ID || district.country.status === "ARCHIVED")
    throw new NotFoundError("District not found.");
  if (!grant?.isActive)
    throw new AuthorizationError("An independently provisioned district development staff grant is required.");
  return district;
}

async function requireResident(userId: string, districtId: string, db: Db = prisma) {
  const [home, citizen, district] = await Promise.all([
    db.foundingDistrictResidence.findUnique({ where: { userId } }),
    db.foundingPrimaryCitizenship.findUnique({ where: { userId } }),
    db.foundingDistrict.findUnique({ where: { id: districtId },
      include: { country: { select: { planetId: true, status: true, publishedVersionId: true } } },
    }),
  ]);
  if (!district || district.country.planetId !== PLANET_ID ||
    !district.verifiedGeoVersionId || !district.activatedAt ||
    district.status !== "ACTIVE" || district.country.status !== "PUBLISHED" ||
    !district.country.publishedVersionId || !home || home.districtId !== districtId ||
    !citizen || citizen.status !== "ACTIVE" || citizen.countryId !== district.countryId)
    throw new AuthorizationError("Only approved current district residents may view district project progress.");
  return district;
}

async function caseForStaff(userId: string, caseId: string, db: Db) {
  const found = await db.foundingDevelopmentCase.findUnique({
    where: { id: caseId },
    include: { proposal: { select: { authorUserId: true, status: true } } },
  });
  if (!found) throw new NotFoundError("Development case not found.");
  await requireStaff(userId, found.districtId, db);
  return found;
}

export async function listMyDevelopmentStaffDistricts(userId: string) {
  const grants = await prisma.foundingDevelopmentStaffGrant.findMany({
    where: { userId, isActive: true, district: {
      country: { planetId: PLANET_ID, status: { not: "ARCHIVED" } },
    } },
    select: { district: { select: { id: true, name: true } } }, take: 50,
  });
  return { districts: grants.map((g) => g.district), constructionEnabled: false as const };
}

export async function getMyDistrictDevelopmentBoard(userId: string) {
  const home = await prisma.foundingDistrictResidence.findUnique({ where: { userId } });
  if (!home) return { district: null, cases: [], notice: developmentDisclaimer };
  try {
    const district = await requireResident(userId, home.districtId);
    const cases = await prisma.foundingDevelopmentCase.findMany({
      where: { districtId: district.id, proposal: { status: "SHORTLISTED_FOR_FEASIBILITY" } },
      select: {
        id: true, status: true, createdAt: true, updatedAt: true,
        proposal: { select: { title: true, category: true } },
        publicUpdates: { select: { id: true, kind: true, summary: true, createdAt: true },
          orderBy: { createdAt: "desc" }, take: 15 },
      },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return {
      district: { id: district.id, name: district.name },
      cases: cases.map((c) => ({
        id: c.id, title: c.proposal.title, category: c.proposal.category,
        status: c.status, createdAt: c.createdAt,
        updates: c.publicUpdates,
        budgetAllocated: false as const, siteApproved: false as const, constructed: false as const,
      })),
      notice: developmentDisclaimer,
    };
  } catch (e) {
    if (e instanceof AuthorizationError || e instanceof NotFoundError)
      return { district: null, cases: [], notice: developmentDisclaimer };
    throw e;
  }
}

export async function getStaffDevelopmentQueue(userId: string, rawDistrictId: string) {
  const districtId = parseOrThrow(developmentDistrictSchema, rawDistrictId);
  const district = await requireStaff(userId, districtId);
  const [proposals, cases, areas, treasury] = await Promise.all([
    prisma.districtAssemblyProposal.findMany({
      where: { districtId, status: "SHORTLISTED_FOR_FEASIBILITY", developmentCase: null },
      select: { id: true, title: true, description: true, category: true, authorUserId: true },
      take: 50, orderBy: { createdAt: "desc" },
    }),
    prisma.foundingDevelopmentCase.findMany({
      where: { districtId },
      select: {
        id: true, proposalId: true, status: true, reviewSummary: true,
        indicativeCostVC: true, candidateSchematicAreaId: true, revision: true,
        proposal: { select: { title: true, authorUserId: true, status: true } },
        publicUpdates: { select: { id: true, summary: true, kind: true, createdAt: true },
          take: 15, orderBy: { createdAt: "desc" } },
      },
      take: 50, orderBy: { createdAt: "desc" },
    }),
    prisma.foundingLandArea.findMany({
      where: { plan: { districtId, status: "SCHEMATIC_DRAFT" }, kind: "DEVELOPMENT" },
      select: { id: true, name: true, zone: true },
      take: 200,
    }),
    prisma.vascoinAccount.findUnique({
      where: { districtId },
      select: { balance: true },
    }),
  ]);
  return {
    district: { id: district.id, name: district.name },
    proposals, cases, schematicCandidateAreas: areas,
    virtualDistrictTreasuryVC: treasury?.balance ?? 0,
    treasurySpendAllowed: false as const, constructionEnabled: false as const,
    notice: developmentDisclaimer,
  };
}

/** Staff intake is allowed only after an independently moderated shortlist. */
export async function startDevelopmentFeasibility(userId: string, input: unknown) {
  const { proposalId } = parseOrThrow(startFeasibilitySchema, input);
  try {
    return await prisma.$transaction(async (tx) => {
      const proposal = await tx.districtAssemblyProposal.findUnique({ where: { id: proposalId } });
      if (!proposal || proposal.status !== "SHORTLISTED_FOR_FEASIBILITY")
        throw new ConflictError("Only independently shortlisted citizen proposals may enter feasibility review.");
      await requireStaff(userId, proposal.districtId, tx);
      if (proposal.authorUserId === userId)
        throw new AuthorizationError("A citizen cannot open a staff case for their own proposal.");
      const created = await tx.foundingDevelopmentCase.create({
        data: {
          proposalId: proposal.id, districtId: proposal.districtId,
          createdByUserId: userId, status: "FEASIBILITY_REVIEW",
        },
      });
      await recordAudit({
        action: "development.feasibility_started", actorUserId: userId,
        entityType: "FoundingDevelopmentCase", entityId: created.id,
        metadata: { districtId: proposal.districtId, proposalId: proposal.id },
      }, tx);
      return { caseId: created.id, status: created.status,
        budgetAllocated: false as const, constructionAuthorized: false as const };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ConflictError("This proposal already has a staff feasibility case.");
    throw e;
  }
}

export async function reviewDevelopmentFeasibility(userId: string, input: unknown) {
  const data = parseOrThrow(recordFeasibilitySchema, input);
  return prisma.$transaction(async (tx) => {
    const found = await caseForStaff(userId, data.caseId, tx);
    if (found.proposal.status !== "SHORTLISTED_FOR_FEASIBILITY")
      throw new ConflictError("Proposal is no longer shortlisted.");
    if (found.createdByUserId === userId || found.proposal.authorUserId === userId)
      throw new AuthorizationError("An independent staff reviewer is required; no self-review.");
    if (!["FEASIBILITY_REVIEW", "NEEDS_REVISION"].includes(found.status))
      throw new ConflictError("This case is no longer in active review.");
    const changed = await tx.foundingDevelopmentCase.updateMany({
      where: { id: found.id, revision: found.revision, status: found.status },
      data: {
        status: data.decision, reviewSummary: data.summary,
        indicativeCostVC: data.indicativeCostVC, reviewedByUserId: userId,
        reviewedAt: new Date(), revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictError("Another reviewer changed this case.");
    await recordAudit({
      action: "development.feasibility_reviewed", actorUserId: userId,
      entityType: "FoundingDevelopmentCase", entityId: found.id,
      metadata: { districtId: found.districtId, decision: data.decision },
    }, tx);
    return { caseId: found.id, status: data.decision, indicativeCostVC: data.indicativeCostVC,
      budgetAllocated: false as const, actualSiteApproved: false as const,
      constructionAuthorized: false as const };
  });
}

/** A drawn schematic is a discussion aid and NEVER a real parcel reservation. */
export async function setSchematicProjectCandidate(userId: string, input: unknown) {
  const { caseId, areaId } = parseOrThrow(candidateAreaSchema, input);
  return prisma.$transaction(async (tx) => {
    const found = await caseForStaff(userId, caseId, tx);
    if (found.status !== "FEASIBLE_CONCEPT" ||
      found.proposal.status !== "SHORTLISTED_FOR_FEASIBILITY")
      throw new ConflictError("Only a feasible shortlisted concept may select a schematic candidate.");
    if (found.proposal.authorUserId === userId)
      throw new AuthorizationError("The proposal author cannot assign a schematic candidate.");
    const area = await tx.foundingLandArea.findUnique({
      where: { id: areaId }, include: { plan: { select: { districtId: true, status: true } } },
    });
    if (!area || area.kind !== "DEVELOPMENT" || area.plan.districtId !== found.districtId ||
      area.plan.status !== "SCHEMATIC_DRAFT")
      throw new ConflictError("Only a development area from this district's schematic draft can be suggested.");
    const changed = await tx.foundingDevelopmentCase.updateMany({
      where: { id: found.id, revision: found.revision, status: "FEASIBLE_CONCEPT" },
      data: { candidateSchematicAreaId: area.id, revision: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictError("This case changed during candidate selection.");
    await recordAudit({
      action: "development.schematic_candidate_selected", actorUserId: userId,
      entityType: "FoundingDevelopmentCase", entityId: found.id,
      metadata: { districtId: found.districtId, schematicAreaId: area.id },
    }, tx);
    return { caseId: found.id, schematicAreaId: area.id,
      realSiteReserved: false as const, ownershipIssued: false as const, constructionAuthorized: false as const };
  });
}

export async function publishDevelopmentPlanningUpdate(userId: string, input: unknown) {
  const data = parseOrThrow(publishPlanningUpdateSchema, input);
  return prisma.$transaction(async (tx) => {
    const found = await caseForStaff(userId, data.caseId, tx);
    if (found.proposal.status !== "SHORTLISTED_FOR_FEASIBILITY")
      throw new ConflictError("This community proposal is no longer eligible for updates.");
    if (found.proposal.authorUserId === userId)
      throw new AuthorizationError("The proposal author cannot publish official staff updates.");
    const count = await tx.foundingDevelopmentUpdate.count({
      where: { caseId: found.id, createdAt: { gte: startOfUtcDay() } },
    });
    if (count >= DEVELOPMENT_MAX_PUBLIC_UPDATES_PER_DAY)
      throw new ConflictError("Daily planning update limit reached.");
    const update = await tx.foundingDevelopmentUpdate.create({
      data: { caseId: found.id, authorUserId: userId,
        kind: data.kind, summary: data.summary },
    });
    await recordAudit({
      action: "development.planning_update_published", actorUserId: userId,
      entityType: "FoundingDevelopmentUpdate", entityId: update.id,
      metadata: { districtId: found.districtId, caseId: found.id, kind: data.kind },
    }, tx);
    return { updateId: update.id, status: "PUBLISHED_PLANNING_NOTE" as const,
      buildingConstructed: false as const, budgetAllocated: false as const };
  });
}
