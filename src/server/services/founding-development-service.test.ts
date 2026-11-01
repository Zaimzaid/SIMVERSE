import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import {
  getMyDistrictDevelopmentBoard, getStaffDevelopmentQueue,
  listMyDevelopmentStaffDistricts, publishDevelopmentPlanningUpdate,
  reviewDevelopmentFeasibility, setSchematicProjectCandidate,
  startDevelopmentFeasibility,
} from "./founding-development-service";

let seq = 0;
async function user(name = "Citizen") {
  const result = await registerUser({
    displayName: name, email: `p8-${++seq}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  return result;
}

async function fixture() {
  const steward = await user("Planet steward");
  await prisma.fictionalPlanetSteward.create({
    data: { userId: steward.user.id, isActive: true, canPublish: true },
  });
  const draft = await createFictionalCountryDraft(steward.user.id, steward.workspaceId, {
    name: "Valdora", color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[
      [0, 0], [4, 0], [4, 4], [0, 4], [0, 0],
    ]] },
  });
  const country = await publishFictionalCountry(steward.user.id, steward.workspaceId, draft.id);
  const district = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "proposed-test-district", name: "Test District",
      status: "ACTIVE", verifiedGeoVersionId: "only-disposable-test-data",
      activatedAt: new Date(), capacity: 20 },
  });
  const citizen = await user("Proposal author");
  const outsider = await user("Not resident");
  const caseCreator = await user("Staff case manager");
  const reviewer = await user("Independent reviewer");
  await prisma.foundingDevelopmentStaffGrant.createMany({
    data: [{ userId: caseCreator.user.id, districtId: district.id, isActive: true },
      { userId: reviewer.user.id, districtId: district.id, isActive: true }],
  });
  const application = await prisma.foundingCitizenshipApplication.create({
    data: { userId: citizen.user.id, countryId: country.id, submittedNationSlug: "valdora",
      intakePolicyVersion: 1, status: "APPROVED" },
  });
  await prisma.foundingPrimaryCitizenship.create({
    data: { userId: citizen.user.id, countryId: country.id, applicationId: application.id },
  });
  await prisma.foundingDistrictResidence.create({
    data: { userId: citizen.user.id, districtId: district.id },
  });
  const proposal = await prisma.districtAssemblyProposal.create({
    data: {
      districtId: district.id, authorUserId: citizen.user.id,
      title: "Neighborhood public sports court",
      description: "A shared recreation area to bring people together safely.",
      category: "RECREATION", status: "SHORTLISTED_FOR_FEASIBILITY",
    },
  });
  return { country, district, citizen, outsider, caseCreator, reviewer, proposal };
}
const planOnly = (caseId: string) => ({
  caseId, decision: "FEASIBLE_CONCEPT",
  summary: "Potentially workable as a concept, pending versioned district maps and staff planning approval.",
  indicativeCostVC: 1200,
});

beforeEach(async () => resetDb());

describe("Phase 8 staff feasibility with no real geography, funding or construction", () => {
  it("is closed to ordinary users and grants no projects without shortlist", async () => {
    const account = await user("No world");
    const board = await getMyDistrictDevelopmentBoard(account.user.id);
    expect(board.district).toBeNull();
    expect(board.cases).toEqual([]);
    expect((await listMyDevelopmentStaffDistricts(account.user.id)).districts).toEqual([]);
    expect(await prisma.foundingDevelopmentCase.count()).toBe(0);
    expect(await prisma.vascoinJournal.count()).toBe(0);
  });

  it("requires independent staff grants; forbids proposal-author self intake and duplicates", async () => {
    const f = await fixture();
    expect((await getStaffDevelopmentQueue(f.caseCreator.user.id, f.district.id)).proposals).toHaveLength(1);
    await expect(getStaffDevelopmentQueue(f.outsider.user.id, f.district.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(startDevelopmentFeasibility(f.outsider.user.id, { proposalId: f.proposal.id }))
      .rejects.toBeInstanceOf(AuthorizationError);
    await prisma.foundingDevelopmentStaffGrant.create({
      data: { userId: f.citizen.user.id, districtId: f.district.id, isActive: true },
    });
    await expect(startDevelopmentFeasibility(f.citizen.user.id, { proposalId: f.proposal.id }))
      .rejects.toBeInstanceOf(AuthorizationError);
    const created = await startDevelopmentFeasibility(f.caseCreator.user.id, { proposalId: f.proposal.id });
    expect(created.status).toBe("FEASIBILITY_REVIEW");
    expect(created.budgetAllocated).toBe(false);
    expect(created.constructionAuthorized).toBe(false);
    await expect(startDevelopmentFeasibility(f.caseCreator.user.id, { proposalId: f.proposal.id }))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.foundingDevelopmentCase.count()).toBe(1);
  });

  it("only independently appointed reviewers can assess; never grants construction or spends VC", async () => {
    const f = await fixture();
    const started = await startDevelopmentFeasibility(f.caseCreator.user.id, { proposalId: f.proposal.id });
    await expect(reviewDevelopmentFeasibility(f.caseCreator.user.id, planOnly(started.caseId)))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(reviewDevelopmentFeasibility(f.outsider.user.id, planOnly(started.caseId)))
      .rejects.toBeInstanceOf(AuthorizationError);
    const reviewed = await reviewDevelopmentFeasibility(f.reviewer.user.id, planOnly(started.caseId));
    expect(reviewed.status).toBe("FEASIBLE_CONCEPT");
    expect(reviewed.actualSiteApproved).toBe(false);
    expect(reviewed.budgetAllocated).toBe(false);
    expect(reviewed.constructionAuthorized).toBe(false);
    await expect(reviewDevelopmentFeasibility(f.reviewer.user.id, planOnly(started.caseId)))
      .rejects.toBeInstanceOf(ConflictError);
    const view = await getStaffDevelopmentQueue(f.reviewer.user.id, f.district.id);
    expect(view.cases[0]?.indicativeCostVC).toBe(1200);
    expect(view.treasurySpendAllowed).toBe(false);
    expect(view.constructionEnabled).toBe(false);
    expect(await prisma.vascoinJournal.count()).toBe(0);
    expect(await prisma.vascoinAccount.count()).toBe(0);
    expect(await prisma.foundingLandArea.count()).toBe(0);
  });

  it("allows only development-class schematic areas in the same district as a nonbinding candidate", async () => {
    const f = await fixture();
    const started = await startDevelopmentFeasibility(f.caseCreator.user.id, { proposalId: f.proposal.id });
    await reviewDevelopmentFeasibility(f.reviewer.user.id, planOnly(started.caseId));
    const plan = await prisma.foundingLandPlan.create({
      data: { districtId: f.district.id, createdByUserId: f.caseCreator.user.id,
        status: "SCHEMATIC_DRAFT" },
    });
    const protectedArea = await prisma.foundingLandArea.create({
      data: { planId: plan.id, name: "Protected forest", kind: "PROTECTED",
        zone: "ECOLOGICAL", x: 0, y: 0, width: 1500, height: 1500 },
    });
    const development = await prisma.foundingLandArea.create({
      data: { planId: plan.id, name: "Possible recreational area", kind: "DEVELOPMENT",
        zone: "MIXED_USE", x: 2000, y: 2000, width: 1500, height: 1500 },
    });
    await expect(setSchematicProjectCandidate(f.reviewer.user.id, {
      caseId: started.caseId, areaId: protectedArea.id,
    })).rejects.toBeInstanceOf(ConflictError);
    const selected = await setSchematicProjectCandidate(f.reviewer.user.id, {
      caseId: started.caseId, areaId: development.id,
    });
    expect(selected.realSiteReserved).toBe(false);
    expect(selected.ownershipIssued).toBe(false);
    expect(selected.constructionAuthorized).toBe(false);
    const recorded = await prisma.foundingDevelopmentCase.findUnique({ where: { id: started.caseId } });
    expect(recorded?.candidateSchematicAreaId).toBe(development.id);
    expect(await prisma.vascoinJournal.count()).toBe(0);
  });

  it("prevents selecting an area from a different district and rejects forged approval", async () => {
    const f = await fixture();
    const started = await startDevelopmentFeasibility(f.caseCreator.user.id, { proposalId: f.proposal.id });
    await reviewDevelopmentFeasibility(f.reviewer.user.id, planOnly(started.caseId));
    const other = await prisma.foundingDistrict.create({
      data: { countryId: f.country.id, slug: "different-district", name: "Different",
        status: "PLANNED" },
    });
    const plan = await prisma.foundingLandPlan.create({
      data: { districtId: other.id, createdByUserId: f.caseCreator.user.id },
    });
    const area = await prisma.foundingLandArea.create({
      data: { planId: plan.id, name: "Different district commercial", kind: "DEVELOPMENT",
        zone: "COMMERCIAL", x: 0, y: 0, width: 2000, height: 2000 },
    });
    await expect(setSchematicProjectCandidate(f.reviewer.user.id, {
      caseId: started.caseId, areaId: area.id,
    })).rejects.toBeInstanceOf(ConflictError);
    await expect(reviewDevelopmentFeasibility(f.reviewer.user.id, {
      ...planOnly(started.caseId), decision: "APPROVED",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(startDevelopmentFeasibility(f.caseCreator.user.id, {
      proposalId: f.proposal.id, issueConstructionPermit: true,
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("limits planning notices and isolates public progress to a real current district resident", async () => {
    const f = await fixture();
    const started = await startDevelopmentFeasibility(f.caseCreator.user.id, { proposalId: f.proposal.id });
    const text = "Awaiting a verified geographic planning baseline before any site can be accepted.";
    for (let i = 0; i < 5; i++) {
      const created = await publishDevelopmentPlanningUpdate(f.reviewer.user.id, {
        caseId: started.caseId, kind: "GEO_DEPENDENCY", summary: text,
      });
      expect(created.buildingConstructed).toBe(false);
      expect(created.budgetAllocated).toBe(false);
    }
    await expect(publishDevelopmentPlanningUpdate(f.reviewer.user.id, {
      caseId: started.caseId, kind: "HOLD", summary: text,
    })).rejects.toBeInstanceOf(ConflictError);
    const citizenBoard = await getMyDistrictDevelopmentBoard(f.citizen.user.id);
    expect(citizenBoard.district?.id).toBe(f.district.id);
    expect(citizenBoard.cases).toHaveLength(1);
    expect(citizenBoard.cases[0]?.updates).toHaveLength(5);
    expect(citizenBoard.cases[0]?.siteApproved).toBe(false);
    const outsideBoard = await getMyDistrictDevelopmentBoard(f.outsider.user.id);
    expect(outsideBoard.district).toBeNull();
    expect(outsideBoard.cases).toEqual([]);
    await prisma.foundingDistrict.update({ where: { id: f.district.id }, data: { status: "PLANNED" } });
    expect((await getMyDistrictDevelopmentBoard(f.citizen.user.id)).cases).toEqual([]);
  });

  it("blocks opening unshortlisted or hidden community proposals even when staff is authorized", async () => {
    const f = await fixture();
    await prisma.districtAssemblyProposal.update({
      where: { id: f.proposal.id }, data: { status: "HIDDEN" },
    });
    await expect(startDevelopmentFeasibility(f.caseCreator.user.id, { proposalId: f.proposal.id }))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.foundingDevelopmentCase.count()).toBe(0);
  });
});
