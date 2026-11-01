import { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { PLANET_ID } from "@/lib/planet/contracts";
import {
  landDistrictIdSchema, landAreaInput, landPlanInput, LAND_PLANNING_NOTICE,
  overlap,
} from "@/lib/civilization/land-planning-contract";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";

type Db = Prisma.TransactionClient | typeof prisma;

async function requirePlanner(userId: string, districtId: string, db: Db = prisma) {
  const [district, grant] = await Promise.all([
    db.foundingDistrict.findUnique({ where: { id: districtId },
      include: { country: { select: { planetId: true, status: true } } } }),
    db.foundingLandPlanningGrant.findUnique({ where: { userId_districtId: { userId, districtId } } }),
  ]);
  if (!district || district.country.planetId !== PLANET_ID || district.country.status === "ARCHIVED") {
    throw new NotFoundError("Fictional district unavailable.");
  }
  if (!grant?.isActive) {
    throw new AuthorizationError("An independent district land-planning grant is required.");
  }
  return district;
}

export async function listMyLandPlans(userId: string) {
  const grants = await prisma.foundingLandPlanningGrant.findMany({
    where: { userId, isActive: true,
      district: { country: { planetId: PLANET_ID, status: { not: "ARCHIVED" } } } },
    select: { district: { select: { id: true, name: true,
      landPlan: { select: { revision: true, status: true } } } } }, take: 50,
  });
  return { availableDistricts: grants.map((g) => g.district),
    notice: LAND_PLANNING_NOTICE, realLandActivated: false };
}

export async function getDistrictLandPlan(userId: string, rawDistrictId: string) {
  const districtId = parseOrThrow(landDistrictIdSchema, rawDistrictId);
  const district = await requirePlanner(userId, districtId);
  const plan = await prisma.foundingLandPlan.findUnique({
    where: { districtId },
    include: { areas: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  const protectedArea = plan?.areas.filter((a) => a.kind === "PROTECTED")
    .reduce((n, a) => n + a.width * a.height, 0) ?? 0;
  return {
    district: { id: district.id, name: district.name },
    plan: plan ? {
      id: plan.id, revision: plan.revision, status: plan.status,
      areas: plan.areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind,
        zone: a.zone, x: a.x, y: a.y, width: a.width, height: a.height })),
    } : null,
    protectedPercent: protectedArea / 1_000_000,
    notice: LAND_PLANNING_NOTICE, realLandActivated: false, constructionAllowed: false,
  };
}

export async function createDistrictLandPlan(userId: string, raw: unknown) {
  const { districtId } = parseOrThrow(landPlanInput, raw);
  await requirePlanner(userId, districtId);
  try {
    return await prisma.$transaction(async (tx) => {
      await requirePlanner(userId, districtId, tx);
      const plan = await tx.foundingLandPlan.create({
        data: { districtId, createdByUserId: userId, status: "SCHEMATIC_DRAFT" },
      });
      await recordAudit({
        action: "land.plan_draft_created", actorUserId: userId,
        entityType: "FoundingLandPlan", entityId: plan.id, metadata: { districtId },
      }, tx);
      return { planId: plan.id, status: plan.status, revision: 0, realLandActivated: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("This district already has a schematic land plan.");
    }
    throw error;
  }
}

export async function addDraftLandArea(userId: string, raw: unknown) {
  const data = parseOrThrow(landAreaInput, raw);
  await requirePlanner(userId, data.districtId);
  return prisma.$transaction(async (tx) => {
    await requirePlanner(userId, data.districtId, tx);
    const plan = await tx.foundingLandPlan.findUnique({
      where: { districtId: data.districtId },
      include: { areas: true },
    });
    if (!plan || plan.status !== "SCHEMATIC_DRAFT") {
      throw new ConflictError("No editable schematic draft exists for this district.");
    }
    if (plan.areas.length >= 200) throw new ConflictError("Maximum 200 planning areas per schematic.");
    const collision = plan.areas.some((existing) => overlap(existing, data));
    if (collision) throw new ConflictError("Planning areas may not overlap, including protected corridors and reserves.");

    // Atomic revision compare-and-swap serializes concurrent writers so
    // their overlap checks cannot both succeed on stale area snapshots.
    const locked = await tx.foundingLandPlan.updateMany({
      where: { id: plan.id, revision: plan.revision, status: "SCHEMATIC_DRAFT" },
      data: { revision: { increment: 1 } },
    });
    if (locked.count !== 1) throw new ConflictError("Land plan changed. Refresh and try again.");
    const area = await tx.foundingLandArea.create({
      data: { planId: plan.id, name: data.name, kind: data.kind, zone: data.zone,
        x: data.x, y: data.y, width: data.width, height: data.height },
    });
    await recordAudit({
      action: "land.schematic_area_added", actorUserId: userId,
      entityType: "FoundingLandArea", entityId: area.id,
      metadata: { districtId: data.districtId, kind: data.kind, zone: data.zone },
    }, tx);
    return { areaId: area.id, planId: plan.id, revision: plan.revision + 1,
      realLandActivated: false, ownershipIssued: false, constructionAllowed: false };
  });
}
