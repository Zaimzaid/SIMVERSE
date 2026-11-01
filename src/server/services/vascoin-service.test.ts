import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import {
  claimDailyVascoin, contributeVascoinToMyDistrict,
  getMyVascoinOverview, verifyVascoinLedger,
} from "./vascoin-service";
import {
  VASCOIN_POLICY_ID, VASCOIN_ISSUER_ACCOUNT_ID, VASCOIN_SUPPLY_CEILING,
} from "@/lib/civilization/vascoin-contract";

let sequence = 0;
async function member(label = "Citizen") {
  const record = await registerUser({
    displayName: label,
    email: `vc-${++sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  return record;
}
async function policy(dailyClaimsEnabled = false, contributionsEnabled = false) {
  await prisma.vascoinPolicy.create({
    data: { id: VASCOIN_POLICY_ID, dailyClaimsEnabled, contributionsEnabled },
  });
}
async function approvedDistrictAndResident() {
  const steward = await member("Steward");
  await prisma.fictionalPlanetSteward.create({
    data: { userId: steward.user.id, isActive: true, canPublish: true },
  });
  const draft = await createFictionalCountryDraft(steward.user.id, steward.workspaceId, {
    name: "Valdora", color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[
      [0, 0], [5, 0], [5, 5], [0, 5], [0, 0],
    ]] },
  });
  const country = await publishFictionalCountry(steward.user.id, steward.workspaceId, draft.id);
  const district = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "test-district", name: "Test District",
      status: "ACTIVE", verifiedGeoVersionId: "reviewed-test-geography-only",
      activatedAt: new Date(), capacity: 50 },
  });
  const citizen = await member("Resident");
  const app = await prisma.foundingCitizenshipApplication.create({
    data: { userId: citizen.user.id, countryId: country.id, submittedNationSlug: "valdora",
      status: "APPROVED", intakePolicyVersion: 1 },
  });
  await prisma.foundingPrimaryCitizenship.create({
    data: { userId: citizen.user.id, countryId: country.id,
      applicationId: app.id, status: "ACTIVE" },
  });
  await prisma.foundingDistrictResidence.create({
    data: { userId: citizen.user.id, districtId: district.id },
  });
  return { citizen, country, district };
}
beforeEach(async () => resetDb());

describe("Phase 6 nonredeemable Vascoin double-entry pilot", () => {
  it("starts at zero and fails closed with no issuance policy", async () => {
    const user = await member();
    const overview = await getMyVascoinOverview(user.user.id);
    expect(overview.balance).toBe(0);
    expect(overview.claimedToday).toBe(false);
    expect(overview.dailyClaimsEnabled).toBe(false);
    expect(overview.districtContributionsEnabled).toBe(false);
    expect(overview.redeemable).toBe(false);
    expect(overview.separateFromSVCAndGFC).toBe(true);
    await expect(claimDailyVascoin(user.user.id)).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.vascoinAccount.count()).toBe(0);
    expect(await prisma.vascoinJournal.count()).toBe(0);
    expect((await verifyVascoinLedger()).valid).toBe(true);
  });

  it("only issues one fixed 10 VC credit per server UTC day", async () => {
    await policy(true, false);
    const u = await member();
    const result = await claimDailyVascoin(u.user.id);
    expect(result.amount).toBe(10);
    expect(result.balance).toBe(10);
    await expect(claimDailyVascoin(u.user.id)).rejects.toBeInstanceOf(ConflictError);
    const overview = await getMyVascoinOverview(u.user.id);
    expect(overview.claimedToday).toBe(true);
    expect(overview.balance).toBe(10);
    expect(overview.recentEntries).toHaveLength(1);
    expect(overview.recentEntries[0]?.direction).toBe("IN");
    const system = await prisma.vascoinAccount.findUnique({ where: { id: VASCOIN_ISSUER_ACCOUNT_ID } });
    expect(system?.balance).toBe(-10);
    expect((await verifyVascoinLedger()).valid).toBe(true);
    const other = await member("Another user");
    expect((await getMyVascoinOverview(other.user.id)).balance).toBe(0);
    expect(await prisma.playerWalletEntry.count()).toBe(0);
    expect(await prisma.economyLabTransfer.count()).toBe(0);
  });

  it("applies a hard lifetime supply ceiling across citizens", async () => {
    await policy(true, false);
    const u = await member();
    await prisma.vascoinPolicy.update({
      where: { id: VASCOIN_POLICY_ID }, data: { totalIssued: VASCOIN_SUPPLY_CEILING - 5 },
    });
    await expect(claimDailyVascoin(u.user.id)).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.vascoinJournal.count()).toBe(0);
    expect(await prisma.vascoinAccount.count()).toBe(0);
  });

  it("rejects contributions without independent operator activation and geography", async () => {
    await policy(true, false);
    const u = await member();
    await claimDailyVascoin(u.user.id);
    const payload = { amount: 5, requestId: "17fa8df0-802b-4806-b7b4-fc1c8e5870fd" };
    await expect(contributeVascoinToMyDistrict(u.user.id, payload)).rejects.toBeInstanceOf(ConflictError);
    await prisma.vascoinPolicy.update({
      where: { id: VASCOIN_POLICY_ID }, data: { contributionsEnabled: true },
    });
    await expect(contributeVascoinToMyDistrict(u.user.id, payload)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await prisma.vascoinJournal.count()).toBe(1);
    expect(await prisma.vascoinAccount.count({ where: { kind: "DISTRICT" } })).toBe(0);
  });

  it("transfers only owned, positive integer VC to the current approved district, maintaining balanced postings", async () => {
    await policy(true, true);
    const { citizen, district } = await approvedDistrictAndResident();
    await claimDailyVascoin(citizen.user.id);
    const payload = { amount: 6, requestId: "a8d1836b-d4dd-4cf8-a14a-31b7b2dbcf97" };
    const receipt = await contributeVascoinToMyDistrict(citizen.user.id, payload);
    expect(receipt.walletBalance).toBe(4);
    expect(receipt.treasuryBalance).toBe(6);
    expect(receipt.constructionAuthorized).toBe(false);
    expect(receipt.redeemable).toBe(false);
    const home = await getMyVascoinOverview(citizen.user.id);
    expect(home.balance).toBe(4);
    expect(home.district?.id).toBe(district.id);
    expect(home.district?.treasuryBalance).toBe(6);
    expect(home.recentEntries[0]?.direction).toBe("OUT");
    await expect(contributeVascoinToMyDistrict(citizen.user.id, payload)).rejects.toBeInstanceOf(ConflictError);
    await expect(contributeVascoinToMyDistrict(citizen.user.id,
      { amount: 100, requestId: "9a51a10a-1e23-4f2e-8fa0-18f6473f7bb6" })).rejects.toBeInstanceOf(ConflictError);
    expect((await verifyVascoinLedger()).valid).toBe(true);
    expect(await prisma.vascoinJournal.count()).toBe(2);
    expect(await prisma.playerWalletEntry.count()).toBe(0);
    expect(await prisma.economyLabTransfer.count()).toBe(0);
  });

  it("strictly rejects currency injection, arbitrary destinations, negatives, fractional amounts and forged fields", async () => {
    await policy(true, true);
    const { citizen } = await approvedDistrictAndResident();
    for (const payload of [
      { amount: -1, requestId: crypto.randomUUID() },
      { amount: 2.5, requestId: crypto.randomUUID() },
      { amount: 999999, requestId: crypto.randomUUID() },
      { amount: 1, requestId: "not-a-uuid" },
      { amount: 1, requestId: crypto.randomUUID(), currency: "GFC" },
      { amount: 1, requestId: crypto.randomUUID(), recipientUserId: "another-account" },
      { amount: 1, requestId: crypto.randomUUID(), districtId: "arbitrary-district" },
      { amount: 1, requestId: crypto.randomUUID(), redeemAsNaira: true },
    ]) {
      await expect(contributeVascoinToMyDistrict(citizen.user.id, payload))
        .rejects.toBeInstanceOf(ValidationError);
    }
    expect(await prisma.vascoinJournal.count()).toBe(0);
  });

  it("restricts repeated contributions to three per UTC day even with sufficient balance", async () => {
    await policy(true, true);
    const { citizen } = await approvedDistrictAndResident();
    // Advance only the PRIVATE server service test clock, not API clients.
    for (let day = 0; day < 4; day++) {
      await claimDailyVascoin(citizen.user.id, new Date(Date.now() - day * 86_400_000));
    }
    for (let i = 0; i < 3; i++) {
      await contributeVascoinToMyDistrict(citizen.user.id,
        { amount: 1, requestId: crypto.randomUUID() });
    }
    await expect(contributeVascoinToMyDistrict(citizen.user.id,
      { amount: 1, requestId: crypto.randomUUID() })).rejects.toBeInstanceOf(ConflictError);
    expect((await verifyVascoinLedger()).valid).toBe(true);
  });
});
