import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { PLANET_ID } from "@/lib/planet/contracts";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  addDraftLandArea, createDistrictLandPlan, getDistrictLandPlan, listMyLandPlans,
} from "./land-planning-service";

let counter = 0;
async function user(label: string) {
  const r = await registerUser({
    displayName: label,
    email: `land-${++counter}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  return r.user;
}
async function setup() {
  const planner = await user("Independent planner");
  const ordinary = await user("Ordinary citizen");
  await prisma.fictionalPlanet.create({
    data: { id: PLANET_ID, name: "Test fictional planet", radiusKm: 6371 },
  });
  // Intentionally DRAFT country and PLANNED district with NO approved Phase 2
  // boundaries. The only permitted output is a non-authoritative schematic.
  const country = await prisma.fictionalCountry.create({
    data: { planetId: PLANET_ID, name: "Valdora", slug: "valdora",
      status: "DRAFT", createdByUserId: planner.id },
  });
  const district = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "unverified", name: "Unverified district",
      status: "PLANNED", capacity: 0 },
  });
  await prisma.foundingLandPlanningGrant.create({
    data: { userId: planner.id, districtId: district.id, isActive: true },
  });
  return { planner, ordinary, district, country };
}
function area(districtId: string) {
  return { districtId, name: "Protected forest buffer",
    kind: "PROTECTED", zone: "ECOLOGICAL", x: 0, y: 0, width: 2000, height: 2400 };
}
beforeEach(async () => resetDb());

describe("Phase 7 independent schematic-only zoning", () => {
  it("shows an empty planner list by default and grants no actual parcels", async () => {
    const u = await user("Visitor");
    expect((await listMyLandPlans(u.id)).availableDistricts).toHaveLength(0);
    expect((await listMyLandPlans(u.id)).realLandActivated).toBe(false);
    expect(await prisma.foundingLandArea.count()).toBe(0);
  });

  it("blocks planners without an independent district grant including country creators", async () => {
    const { ordinary, district } = await setup();
    await expect(createDistrictLandPlan(ordinary.id, { districtId: district.id }))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(getDistrictLandPlan(ordinary.id, district.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    expect((await listMyLandPlans(ordinary.id)).availableDistricts).toHaveLength(0);
  });

  it("supports a nongeographic draft on an unapproved district but never activates land", async () => {
    const { planner, district } = await setup();
    const created = await createDistrictLandPlan(planner.id, { districtId: district.id });
    expect(created.status).toBe("SCHEMATIC_DRAFT");
    expect(created.realLandActivated).toBe(false);
    await expect(createDistrictLandPlan(planner.id, { districtId: district.id }))
      .rejects.toBeInstanceOf(ConflictError);
    const result = await addDraftLandArea(planner.id, area(district.id));
    expect(result.revision).toBe(1);
    expect(result.ownershipIssued).toBe(false);
    expect(result.constructionAllowed).toBe(false);
    const view = await getDistrictLandPlan(planner.id, district.id);
    expect(view.plan?.areas).toHaveLength(1);
    expect(view.protectedPercent).toBeCloseTo(4.8);
    expect(view.realLandActivated).toBe(false);
    expect(view.constructionAllowed).toBe(false);
    expect(await prisma.vascoinJournal.count()).toBe(0);
    expect(await prisma.foundingDistrictResidence.count()).toBe(0);
  });

  it("blocks overlap with a protected buffer and a public reserve, allows touching edges", async () => {
    const { planner, district } = await setup();
    await createDistrictLandPlan(planner.id, { districtId: district.id });
    await addDraftLandArea(planner.id, area(district.id));
    await expect(addDraftLandArea(planner.id, {
      districtId: district.id, name: "Market inside protected forest",
      kind: "DEVELOPMENT", zone: "COMMERCIAL",
      x: 1000, y: 1000, width: 1800, height: 1400,
    })).rejects.toBeInstanceOf(ConflictError);
    await addDraftLandArea(planner.id, {
      districtId: district.id, name: "Public square", kind: "PUBLIC_RESERVE", zone: "CIVIC",
      x: 2000, y: 0, width: 2500, height: 2400,
    });
    await expect(addDraftLandArea(planner.id, {
      districtId: district.id, name: "Housing on the civic square",
      kind: "DEVELOPMENT", zone: "RESIDENTIAL",
      x: 2300, y: 400, width: 1500, height: 1600,
    })).rejects.toBeInstanceOf(ConflictError);
    const view = await getDistrictLandPlan(planner.id, district.id);
    expect(view.plan?.areas).toHaveLength(2);
    expect(view.plan?.revision).toBe(2);
  });

  it("rejects out-of-bounds, bad protected zone combos, spoofed status and arbitrary owner", async () => {
    const { planner, district } = await setup();
    await createDistrictLandPlan(planner.id, { districtId: district.id });
    for (const payload of [
      { ...area(district.id), x: 9800 },
      { ...area(district.id), kind: "PROTECTED", zone: "COMMERCIAL" },
      { ...area(district.id), kind: "PUBLIC_RESERVE", zone: "RESIDENTIAL" },
      { ...area(district.id), width: 0 },
      { ...area(district.id), x: -1 },
      { ...area(district.id), name: "For sale", ownerUserId: planner.id },
      { ...area(district.id), status: "APPROVED" },
      { ...area(district.id), publish: true },
    ]) {
      await expect(addDraftLandArea(planner.id, payload)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await prisma.foundingLandArea.count()).toBe(0);
  });

  it("revocation blocks subsequent edits without deleting immutable schematic areas", async () => {
    const { planner, district } = await setup();
    await createDistrictLandPlan(planner.id, { districtId: district.id });
    await addDraftLandArea(planner.id, area(district.id));
    await prisma.foundingLandPlanningGrant.update({
      where: { userId_districtId: { userId: planner.id, districtId: district.id } },
      data: { isActive: false },
    });
    await expect(addDraftLandArea(planner.id, {
      ...area(district.id), name: "Unapproved extra area", x: 4000,
    })).rejects.toBeInstanceOf(AuthorizationError);
    expect((await listMyLandPlans(planner.id)).availableDistricts).toHaveLength(0);
    expect(await prisma.foundingLandArea.count()).toBe(1);
  });
});
