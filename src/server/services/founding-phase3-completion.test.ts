import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import { saveMyFoundingCitizenshipDraft } from "./founding-citizenship-draft-service";
import { submitMyFoundingCitizenshipApplication } from "./founding-citizenship-intake-service";
import { endorseFoundingCitizenship, getMyFoundingPrimaryCitizenship } from "./founding-citizenship-issuance-service";
import {
  beginFoundingVisit, endFoundingVisit, getMyFoundingCivicStatus,
  joinOrTransferFoundingDistrict, listJoinableFoundingDistricts,
} from "./founding-residence-service";

let seq = 0;
async function member(name = "Citizen") {
  const v = await registerUser({
    displayName: name, email: `phase3-${++seq}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  await prisma.playerIdentity.update({ where: { userId: v.user.id }, data: { username: `phase3user${seq}` } });
  return v;
}
async function publish(name: string, longitude: number) {
  const steward = await member("Planet steward");
  await prisma.fictionalPlanetSteward.create({ data: { userId: steward.user.id, isActive: true, canPublish: true } });
  const draft = await createFictionalCountryDraft(steward.user.id, steward.workspaceId, {
    name, color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[
      [longitude, 0], [longitude + 5, 0], [longitude + 5, 5], [longitude, 5], [longitude, 0],
    ]] },
  });
  return publishFictionalCountry(steward.user.id, steward.workspaceId, draft.id);
}
async function prepareApplicant(countryName = "Valdora") {
  const applicant = await member("Applicant");
  const country = await publish(countryName, 0);
  await prisma.foundingCitizenshipIntake.create({ data: { countryId: country.id, isOpen: true, policyVersion: 1 } });
  await saveMyFoundingCitizenshipDraft(applicant.user.id, { targetNationSlug: countryName.toLowerCase(), motivation: "I want to contribute." });
  const application = await submitMyFoundingCitizenshipApplication(applicant.user.id);
  return { applicant, country, application };
}
async function grant(userId: string, countryId: string) {
  await prisma.foundingCitizenshipReviewerGrant.create({ data: { userId, countryId, isActive: true } });
}

beforeEach(async () => resetDb());

describe("Phase 3B.2 primary fictional citizenship gates", () => {
  it("fails closed until two separately granted, nonapplicant reviewers and explicit issuance policy", async () => {
    const { applicant, country, application } = await prepareApplicant();
    const r1 = await member("Reviewer 1");
    const r2 = await member("Reviewer 2");
    await grant(r1.user.id, country.id);
    await grant(r2.user.id, country.id);
    await expect(endorseFoundingCitizenship(r1.user.id, application.id)).rejects.toBeInstanceOf(ConflictError);
    await prisma.foundingCitizenshipIssuanceGate.create({
      data: { countryId: country.id, enabled: true, policyVersion: 1 },
    });
    await expect(endorseFoundingCitizenship(applicant.user.id, application.id)).rejects.toBeInstanceOf(AuthorizationError);
    const first = await endorseFoundingCitizenship(r1.user.id, application.id);
    expect(first.status).toBe("PENDING_REVIEW");
    expect(first.citizenshipGranted).toBe(false);
    expect(await prisma.foundingPrimaryCitizenship.count()).toBe(0);
    await expect(endorseFoundingCitizenship(r1.user.id, application.id)).rejects.toBeInstanceOf(ConflictError);
    const final = await endorseFoundingCitizenship(r2.user.id, application.id);
    expect(final.status).toBe("APPROVED");
    expect(final.citizenshipGranted).toBe(true);
    const citizen = await getMyFoundingPrimaryCitizenship(applicant.user.id);
    expect(citizen.simversePrimaryNationality?.countryName).toBe("Valdora");
    expect(await prisma.foundingPrimaryCitizenship.count()).toBe(1);
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
    await expect(endorseFoundingCitizenship(r2.user.id, application.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects inactive reviewer grant and mismatched issuance policy version", async () => {
    const { country, application } = await prepareApplicant();
    const r = await member("Reviewer");
    await prisma.foundingCitizenshipIssuanceGate.create({
      data: { countryId: country.id, enabled: true, policyVersion: 2 },
    });
    await grant(r.user.id, country.id);
    await expect(endorseFoundingCitizenship(r.user.id, application.id)).rejects.toBeInstanceOf(ConflictError);
    await prisma.foundingCitizenshipIssuanceGate.update({ where: { countryId: country.id }, data: { policyVersion: 1 } });
    await prisma.foundingCitizenshipReviewerGrant.update({
      where: { userId_countryId: { userId: r.user.id, countryId: country.id } },
      data: { isActive: false },
    });
    await expect(endorseFoundingCitizenship(r.user.id, application.id)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await prisma.foundingPrimaryCitizenship.count()).toBe(0);
  });
});

describe("Phase 3C/3D residence, transfer and temporary travel", () => {
  async function setUpCitizenAndDistricts() {
    const citizen = await member("Resident");
    const country = await publish("Valdora", 0);
    // Fixture creates a controlled, pre-verified citizenship and geo activation
    // in a DISPOSABLE test database; no app offers a public bypass.
    const app = await prisma.foundingCitizenshipApplication.create({
      data: { userId: citizen.user.id, countryId: country.id, submittedNationSlug: "valdora",
        intakePolicyVersion: 1, status: "APPROVED" },
    });
    await prisma.foundingPrimaryCitizenship.create({
      data: { userId: citizen.user.id, countryId: country.id, applicationId: app.id, status: "ACTIVE" },
    });
    const a = await prisma.foundingDistrict.create({
      data: { countryId: country.id, slug: "north", name: "North", status: "ACTIVE",
        verifiedGeoVersionId: "reviewed-geo-version-north", activatedAt: new Date(), capacity: 1 },
    });
    const b = await prisma.foundingDistrict.create({
      data: { countryId: country.id, slug: "south", name: "South", status: "ACTIVE",
        verifiedGeoVersionId: "reviewed-geo-version-south", activatedAt: new Date(), capacity: 2 },
    });
    return { citizen, country, a, b };
  }

  it("starts closed with no published geographic districts", async () => {
    const u = await member();
    expect((await listJoinableFoundingDistricts(u.user.id)).districts).toEqual([]);
    const civic = await getMyFoundingCivicStatus(u.user.id);
    expect(civic.residence).toBeNull();
    expect(civic.eligibleToVote).toBe(false);
    expect(civic.ballotDistrictId).toBeNull();
  });

  it("enforces one home, atomic capacity, a 30-day transfer gap and a 14-day ballot tenure", async () => {
    const { citizen, a, b } = await setUpCitizenAndDistricts();
    const initial = await joinOrTransferFoundingDistrict(citizen.user.id, a.id);
    expect(initial.districtId).toBe(a.id);
    expect((await getMyFoundingCivicStatus(citizen.user.id)).eligibleToVote).toBe(false);
    const other = await member("Neighbor");
    const applicant = await prisma.foundingCitizenshipApplication.create({
      data: { userId: other.user.id, countryId: a.countryId, submittedNationSlug: "valdora",
        intakePolicyVersion: 1, status: "APPROVED" },
    });
    await prisma.foundingPrimaryCitizenship.create({
      data: { userId: other.user.id, countryId: a.countryId, applicationId: applicant.id, status: "ACTIVE" },
    });
    await expect(joinOrTransferFoundingDistrict(other.user.id, a.id)).rejects.toBeInstanceOf(ConflictError);
    await expect(joinOrTransferFoundingDistrict(citizen.user.id, b.id)).rejects.toBeInstanceOf(ConflictError);
    await prisma.foundingDistrictResidence.update({
      where: { userId: citizen.user.id },
      data: { lastTransferAt: new Date(Date.now() - 35 * 86_400_000),
        startedAt: new Date(Date.now() - 35 * 86_400_000) },
    });
    expect((await getMyFoundingCivicStatus(citizen.user.id)).ballotDistrictId).toBe(a.id);
    await joinOrTransferFoundingDistrict(citizen.user.id, b.id);
    const after = await getMyFoundingCivicStatus(citizen.user.id);
    expect(after.ballotDistrictId).toBeNull();
    expect(after.eligibleToVote).toBe(false);
    expect(await prisma.foundingDistrictResidence.count({ where: { userId: citizen.user.id } })).toBe(1);
    expect((await prisma.foundingDistrict.findUnique({ where: { id: a.id } }))?.occupied).toBe(0);
    expect((await prisma.foundingDistrict.findUnique({ where: { id: b.id } }))?.occupied).toBe(1);
  });

  it("never grants residence or votes merely from an unreviewed district name", async () => {
    const { citizen, country } = await setUpCitizenAndDistricts();
    const unapproved = await prisma.foundingDistrict.create({
      data: { countryId: country.id, slug: "unverified", name: "Unverified", status: "ACTIVE",
        activatedAt: new Date(), capacity: 500 },
    });
    await expect(joinOrTransferFoundingDistrict(citizen.user.id, unapproved.id)).rejects.toBeInstanceOf(ConflictError);
    expect((await getMyFoundingCivicStatus(citizen.user.id)).ballotDistrictId).toBeNull();
  });

  it("allows temporary visits to published countries without changing primary citizenship or ballot district", async () => {
    const { citizen, a } = await setUpCitizenAndDistricts();
    await joinOrTransferFoundingDistrict(citizen.user.id, a.id);
    const another = await publish("Novara", 25);
    const result = await beginFoundingVisit(citizen.user.id, another.id);
    expect(result.changedResidence).toBe(false);
    expect(result.changedCitizenship).toBe(false);
    const during = await getMyFoundingCivicStatus(citizen.user.id);
    expect(during.visit?.countryName).toBe("Novara");
    expect(during.primaryNationality?.countryName).toBe("Valdora");
    expect(during.residence?.districtId).toBe(a.id);
    expect(during.ballotDistrictId).toBeNull();
    await endFoundingVisit(citizen.user.id);
    expect((await getMyFoundingCivicStatus(citizen.user.id)).visit).toBeNull();
  });
});
