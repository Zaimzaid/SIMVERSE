import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { updateMyPlayerIdentity } from "./player-identity-service";
import {
  createMyVirtualBusinessDraft, getMyEconomicIdentity, selectMyProfession,
} from "./player-economy-service";

let sequence = 0;
async function player(withUsername = true) {
  sequence++;
  const result = await registerUser({
    displayName: "Economy Player",
    email: `economy-${sequence}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  if (withUsername) await updateMyPlayerIdentity(result.user.id, {
    username: `economy_user_${sequence}`, displayName: "Economy Player",
    avatarUrl: "", bannerUrl: "", creatorName: "", biography: "",
    profileVisibility: "PRIVATE", experienceMode: "BOTH", homeCountryId: "",
  });
  return result.user;
}
beforeEach(async () => { await resetDb(); });

describe("SIMVERSE Phase 5 career and fictional wallet", () => {
  it("awards exactly one server-controlled starting grant in a ledger transaction", async () => {
    const owner = await player();
    const before = await getMyEconomicIdentity(owner.id);
    expect(before.wallet.balance).toBe(0);
    expect(before.profession).toBeNull();

    const after = await selectMyProfession(owner.id, { professionCode: "AGRICULTURE" });
    expect(after.profession?.professionCode).toBe("AGRICULTURE");
    expect(after.wallet.balance).toBe(850);
    expect(after.wallet.currency).toBe("SVC");
    expect(after.wallet.entries).toHaveLength(1);
    expect(after.wallet.entries[0]?.amount).toBe(850);
    expect(after.wallet.entries[0]?.balanceAfter).toBe(850);
    const identity = await prisma.playerIdentity.findUniqueOrThrow({ where: { userId: owner.id } });
    expect(await prisma.playerWalletEntry.count({
      where: { eventKey: `STARTER:${identity.id}` },
    })).toBe(1);

    await expect(selectMyProfession(owner.id, { professionCode: "ENGINEERING" }))
      .rejects.toBeInstanceOf(ConflictError);
    await expect(selectMyProfession(owner.id, { professionCode: "AGRICULTURE" }))
      .rejects.toBeInstanceOf(ConflictError);
    expect((await getMyEconomicIdentity(owner.id)).wallet.balance).toBe(850);
    expect(await prisma.playerWalletEntry.count()).toBe(1);
  });

  it("blocks direct money printing and requires a SIMVERSE username", async () => {
    const owner = await player(false);
    await expect(selectMyProfession(owner.id, { professionCode: "ENGINEERING" }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(selectMyProfession(owner.id, {
      professionCode: "ENGINEERING", startingCredits: 999999,
    })).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.playerVirtualWallet.count()).toBe(0);
    expect(await prisma.playerCareerProfile.count()).toBe(0);
  });

  it("keeps another player's wallet, career and private company drafts isolated", async () => {
    const first = await player();
    const second = await player();
    await selectMyProfession(first.id, { professionCode: "COMMERCE" });
    const created = await createMyVirtualBusinessDraft(first.id, {
      name: "Marina Enterprises", sector: "COMMERCE",
      description: "Virtual commerce simulation prototype.",
    });
    expect(created.business.status).toBe("DRAFT");
    const firstData = await getMyEconomicIdentity(first.id);
    const secondData = await getMyEconomicIdentity(second.id);
    expect(firstData.businesses.map((b) => b.name)).toEqual(["Marina Enterprises"]);
    expect(firstData.wallet.balance).toBe(750);
    expect(secondData.businesses).toEqual([]);
    expect(secondData.wallet.balance).toBe(0);
    expect(JSON.stringify(secondData)).not.toContain("Marina Enterprises");
    expect(JSON.stringify(firstData)).not.toContain("passwordHash");
    expect(JSON.stringify(firstData)).not.toContain("email");
    const publicProfile = await prisma.playerIdentity.findUniqueOrThrow({ where: { userId: first.id } });
    expect(publicProfile.profileVisibility).toBe("PRIVATE");
  });

  it("does not create companies until a career is selected; duplicates are denied", async () => {
    const first = await player();
    const second = await player();
    await expect(createMyVirtualBusinessDraft(first.id, {
      name: "Virtual Farm Co", sector: "AGRICULTURE",
    })).rejects.toBeInstanceOf(ValidationError);
    await selectMyProfession(first.id, { professionCode: "AGRICULTURE" });
    await selectMyProfession(second.id, { professionCode: "CREATIVE" });
    await createMyVirtualBusinessDraft(first.id, { name: "Virtual Farm Co", sector: "AGRICULTURE" });
    await expect(createMyVirtualBusinessDraft(second.id, {
      name: " virtual  farm co ", sector: "AGRICULTURE",
    })).rejects.toBeInstanceOf(ConflictError);
    await expect(createMyVirtualBusinessDraft(first.id, {
      name: "Unauthorised Co", sector: "HEALTH", status: "LICENSED",
    })).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.playerVirtualBusiness.count()).toBe(1);
  });
});
