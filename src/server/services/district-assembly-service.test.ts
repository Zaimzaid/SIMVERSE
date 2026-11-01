import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import {
  listMyAssemblyDistricts, getDistrictAssembly, submitDistrictProposal,
  postDistrictComment, castDistrictVote, moderateDistrictProposal,
  moderateDistrictComment, createDistrictNotice, reportDistrictContent,
  getDistrictModerationQueue, resolveDistrictReport,
} from "./district-assembly-service";

let sequence = 0;
async function member(label: string) {
  sequence++;
  const result = await registerUser({
    displayName: label,
    email: `assembly-${sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  return result.user;
}
async function makeCountry() {
  const steward = await registerUser({
    displayName: "Assembly steward",
    email: `assembly-steward-${++sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  await prisma.fictionalPlanetSteward.create({
    data: { userId: steward.user.id, isActive: true, canPublish: true },
  });
  const draft = await createFictionalCountryDraft(steward.user.id, steward.workspaceId, {
    name: "Arandia", color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[
      [10, 0], [15, 0], [15, 5], [10, 5], [10, 0],
    ]] },
  });
  return publishFictionalCountry(steward.user.id, steward.workspaceId, draft.id);
}
async function setup() {
  const country = await makeCountry();
  const district = await prisma.foundingDistrict.create({
    data: {
      countryId: country.id, slug: "pilot", name: "Pilot District",
      status: "ACTIVE", capacity: 20,
      activatedAt: new Date(),
      verifiedGeoVersionId: "test-fixture-reviewed-geometry",
    },
  });
  const moderator = await member("Moderator");
  await prisma.districtAssemblyModeratorGrant.create({
    data: { userId: moderator.id, districtId: district.id, isActive: true },
  });
  return { country, district, moderator };
}
async function citizen(countryId: string, districtId: string, label: string, oldEnough = false) {
  const user = await member(label);
  const app = await prisma.foundingCitizenshipApplication.create({
    data: { userId: user.id, countryId, submittedNationSlug: "arandia", intakePolicyVersion: 1, status: "APPROVED" },
  });
  await prisma.foundingPrimaryCitizenship.create({
    data: { userId: user.id, countryId, applicationId: app.id, status: "ACTIVE" },
  });
  await prisma.foundingDistrictResidence.create({
    data: {
      userId: user.id, districtId,
      startedAt: new Date(Date.now() - (oldEnough ? 16 : 1) * 86_400_000),
    },
  });
  return user;
}
function proposalData(districtId: string) {
  return { districtId, title: "Create a safe public sports court",
    description: "Our district needs an accessible recreational space for youth and families.",
    category: "RECREATION" };
}
beforeEach(async () => resetDb());

describe("Phase 4 private district assembly and no-privilege defaults", () => {
  it("has no accessible assembly for an unassigned citizen", async () => {
    const user = await member("Not a resident");
    expect((await listMyAssemblyDistricts(user.id)).districts).toEqual([]);
    await expect(getDistrictAssembly(user.id, "made-up-district")).rejects.toBeInstanceOf(ConflictError);
  });

  it("requires active reviewed geography, primary nationality and matching residence", async () => {
    const { country, district } = await setup();
    const outsider = await member("Visitor");
    await expect(submitDistrictProposal(outsider.id, proposalData(district.id)))
      .rejects.toBeInstanceOf(AuthorizationError);
    const resident = await citizen(country.id, district.id, "Resident");
    await prisma.foundingDistrict.update({ where: { id: district.id }, data: { verifiedGeoVersionId: null } });
    await expect(submitDistrictProposal(resident.id, proposalData(district.id)))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.districtAssemblyProposal.count()).toBe(0);
  });

  it("keeps proposals private pending independent moderation and prevents self-review", async () => {
    const { country, district, moderator } = await setup();
    const alice = await citizen(country.id, district.id, "Alice");
    const bob = await citizen(country.id, district.id, "Bob");
    const created = await submitDistrictProposal(alice.id, proposalData(district.id));
    expect(created.status).toBe("PENDING_MODERATION");
    expect(created.developmentApproved).toBe(false);
    expect((await getDistrictAssembly(bob.id, district.id)).proposals).toHaveLength(0);
    expect((await getDistrictModerationQueue(moderator.id, district.id)).proposals).toHaveLength(1);
    await expect(moderateDistrictProposal(alice.id, {
      proposalId: created.id, action: "OPEN", reason: "",
    })).rejects.toBeInstanceOf(AuthorizationError);
    const open = await moderateDistrictProposal(moderator.id, {
      proposalId: created.id, action: "OPEN", reason: "",
    });
    expect(open.status).toBe("OPEN");
    expect(open.built).toBe(false);
    expect((await getDistrictAssembly(bob.id, district.id)).proposals).toHaveLength(1);
  });

  it("requires moderators to publish comments and does not allow new residents to vote", async () => {
    const { country, district, moderator } = await setup();
    const alice = await citizen(country.id, district.id, "Alice", true);
    const bob = await citizen(country.id, district.id, "Bob", false);
    const proposal = await submitDistrictProposal(alice.id, proposalData(district.id));
    await moderateDistrictProposal(moderator.id, { proposalId: proposal.id, action: "OPEN", reason: "" });
    await expect(castDistrictVote(bob.id, { proposalId: proposal.id, choice: "SUPPORT" }))
      .rejects.toBeInstanceOf(AuthorizationError);
    const comment = await postDistrictComment(bob.id, {
      proposalId: proposal.id, body: "Can it include space for outdoor games?",
    });
    expect(comment.status).toBe("PENDING_MODERATION");
    expect((await getDistrictAssembly(alice.id, district.id)).proposals[0]?.comments).toHaveLength(0);
    await moderateDistrictComment(moderator.id, { commentId: comment.id, action: "SHOW" });
    expect((await getDistrictAssembly(alice.id, district.id)).proposals[0]?.comments).toHaveLength(1);
    expect((await castDistrictVote(alice.id, {
      proposalId: proposal.id, choice: "SUPPORT",
    })).bindingDevelopmentDecision).toBe(false);
    await expect(castDistrictVote(alice.id, { proposalId: proposal.id, choice: "OPPOSE" }))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.districtAssemblyVote.count()).toBe(1);
  });

  it("shortlists only a majority-supported idea and never builds or authorizes spending", async () => {
    const { country, district, moderator } = await setup();
    const author = await citizen(country.id, district.id, "Author", true);
    const proposal = await submitDistrictProposal(author.id, proposalData(district.id));
    await moderateDistrictProposal(moderator.id, { proposalId: proposal.id, action: "OPEN", reason: "" });
    await expect(moderateDistrictProposal(moderator.id, { proposalId: proposal.id, action: "SHORTLIST", reason: "" }))
      .rejects.toBeInstanceOf(ConflictError);
    const voters = [author,
      await citizen(country.id, district.id, "Voter one", true),
      await citizen(country.id, district.id, "Voter two", true)];
    for (const v of voters) await castDistrictVote(v.id, { proposalId: proposal.id, choice: "SUPPORT" });
    const result = await moderateDistrictProposal(moderator.id, {
      proposalId: proposal.id, action: "SHORTLIST", reason: "Forward for future feasibility assessment",
    });
    expect(result.status).toBe("SHORTLISTED_FOR_FEASIBILITY");
    expect(result.built).toBe(false);
    expect(result.fundingAuthorized).toBe(false);
    await expect(castDistrictVote(author.id, { proposalId: proposal.id, choice: "SUPPORT" }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("restricts notices, respects meeting times, reports content and hides reported comments", async () => {
    const { country, district, moderator } = await setup();
    const author = await citizen(country.id, district.id, "Author");
    const resident = await citizen(country.id, district.id, "Resident");
    const proposal = await submitDistrictProposal(author.id, proposalData(district.id));
    await expect(createDistrictNotice(author.id, {
      districtId: district.id, kind: "ANNOUNCEMENT", title: "Public update",
      body: "No meeting has been arranged yet.", scheduledFor: null,
    })).rejects.toBeInstanceOf(AuthorizationError);
    await createDistrictNotice(moderator.id, {
      districtId: district.id, kind: "ANNOUNCEMENT", title: "Public update",
      body: "The district assembly is open to approved residents.", scheduledFor: null,
    });
    await expect(createDistrictNotice(moderator.id, {
      districtId: district.id, kind: "MEETING", title: "Meeting preview",
      body: "This meeting time is invalid.", scheduledFor: new Date(Date.now() - 60_000).toISOString(),
    })).rejects.toBeInstanceOf(ValidationError);
    await moderateDistrictProposal(moderator.id, { proposalId: proposal.id, action: "OPEN", reason: "" });
    const comment = await postDistrictComment(author.id, {
      proposalId: proposal.id, body: "A comment that should be reviewed.",
    });
    await moderateDistrictComment(moderator.id, { commentId: comment.id, action: "SHOW" });
    const report = await reportDistrictContent(resident.id, {
      proposalId: proposal.id, commentId: comment.id, reason: "This comment contains inappropriate information.",
    });
    expect(report.status).toBe("OPEN");
    expect((await getDistrictModerationQueue(moderator.id, district.id)).reports).toHaveLength(1);
    await resolveDistrictReport(moderator.id, { reportId: report.reportId, action: "HIDE_COMMENT" });
    expect((await getDistrictAssembly(resident.id, district.id)).proposals[0]?.comments).toHaveLength(0);
    expect((await getDistrictAssembly(resident.id, district.id)).notices).toHaveLength(1);
  });

  it("limits repetitive proposals and rejects forged proposal category / unapproved construction", async () => {
    const { country, district } = await setup();
    const author = await citizen(country.id, district.id, "Author");
    await expect(submitDistrictProposal(author.id, {
      ...proposalData(district.id), ownerId: author.id,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(submitDistrictProposal(author.id, {
      ...proposalData(district.id), category: "BUILD_IT_NOW",
    })).rejects.toBeInstanceOf(ValidationError);
    for (let i = 0; i < 3; i++) await submitDistrictProposal(author.id, {
      ...proposalData(district.id), title: `District sports court version ${i}`,
    });
    await expect(submitDistrictProposal(author.id, proposalData(district.id)))
      .rejects.toBeInstanceOf(ConflictError);
  });
});
