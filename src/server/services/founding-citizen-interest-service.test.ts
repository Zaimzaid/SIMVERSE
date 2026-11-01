import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  getMyFoundingCitizenInterest,
  saveMyFoundingCitizenInterest,
} from "./founding-citizen-interest-service";
import { FOUNDING_NATION_NAMES } from "@/lib/civilization/phase3-contract";

let seq = 0;
async function register(label: string) {
  seq++;
  const result = await registerUser({
    displayName: "Founding Citizen",
    email: `${label}-interest-${seq}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
  return result.user;
}

beforeEach(async () => resetDb());

describe("Phase 3 founding nation preferences — not citizenship", () => {
  it("is private, defaults to unselected, and exposes all ten agreed names", async () => {
    const user = await register("empty");
    const value = await getMyFoundingCitizenInterest(user.id);
    expect(value.status).toBe("PREFERENCE_ONLY");
    expect(value.availableNations.map((n) => n.name)).toEqual([
      "Valdora", "Arandia", "Novara", "Dravonia", "Marovia",
      "Solandia", "Vestria", "Altavia", "Eldoria", "Terranova",
    ]);
    expect(FOUNDING_NATION_NAMES).toHaveLength(10);
    expect(value.preferredNationSlug).toBeNull();
    expect(value.proposedPilotInterest).toBe(false);
    expect(value.activeDistrictMembership).toBe(false);
    expect(value.nationalityGranted).toBe(false);
    expect(value.residenceGranted).toBe(false);
    expect(await prisma.foundingCitizenInterest.count()).toBe(0);
  });

  it("persists a preference and the separate proposed pilot interest without any citizenship or document grant", async () => {
    const user = await register("pilot");
    const after = await saveMyFoundingCitizenInterest(user.id, {
      preferredNationSlug: "valdora",
      proposedPilotInterest: true,
    });
    expect(after.preferredNationName).toBe("Valdora");
    expect(after.proposedPilotInterest).toBe(true);
    expect(after.activeDistrictMembership).toBe(false);
    expect(await prisma.foundingCitizenInterest.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect(await prisma.playerDocumentApplication.count()).toBe(0);
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
    expect(await prisma.fictionalCountry.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { actorUserId: user.id, action: "user.founding_nation_interest_updated" } })).toBe(1);
  });

  it("can change/clear a preference without changing the pilot interest or creating multiple rows", async () => {
    const user = await register("change");
    await saveMyFoundingCitizenInterest(user.id, { preferredNationSlug: "arandia", proposedPilotInterest: true });
    await saveMyFoundingCitizenInterest(user.id, { preferredNationSlug: "terranova", proposedPilotInterest: true });
    const cleared = await saveMyFoundingCitizenInterest(user.id, { preferredNationSlug: null, proposedPilotInterest: false });
    expect(cleared.preferredNationSlug).toBeNull();
    expect(cleared.proposedPilotInterest).toBe(false);
    expect(await prisma.foundingCitizenInterest.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { actorUserId: user.id, action: "user.founding_nation_interest_updated" } })).toBe(3);
  });

  it("rejects invented nationalities and privilege or foreign-user injection", async () => {
    const user = await register("bad");
    for (const payload of [
      { preferredNationSlug: "nigeria", proposedPilotInterest: true },
      { preferredNationSlug: "VALDORA", proposedPilotInterest: true },
      { preferredNationSlug: "valdora", proposedPilotInterest: true, citizenshipStatus: "ACTIVE" },
      { preferredNationSlug: "valdora", proposedPilotInterest: true, districtMembershipStatus: "ACTIVE" },
      { preferredNationSlug: "valdora", proposedPilotInterest: true, userId: "someone-else" },
      { preferredNationSlug: "valdora", proposedPilotInterest: "yes" },
    ]) {
      await expect(saveMyFoundingCitizenInterest(user.id, payload)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await prisma.foundingCitizenInterest.count()).toBe(0);
  });

  it("isolates users and preserves unrelated existing identity fields", async () => {
    const userA = await register("user-a");
    const userB = await register("user-b");
    const beforeIdentity = await prisma.playerIdentity.findUnique({ where: { userId: userA.id } });
    await saveMyFoundingCitizenInterest(userA.id, { preferredNationSlug: "eldoria", proposedPilotInterest: true });
    await saveMyFoundingCitizenInterest(userB.id, { preferredNationSlug: "novara", proposedPilotInterest: false });
    const a = await getMyFoundingCitizenInterest(userA.id);
    const b = await getMyFoundingCitizenInterest(userB.id);
    expect(a.preferredNationSlug).toBe("eldoria");
    expect(b.preferredNationSlug).toBe("novara");
    expect(a.proposedPilotInterest).toBe(true);
    expect(b.proposedPilotInterest).toBe(false);
    const afterIdentity = await prisma.playerIdentity.findUnique({ where: { userId: userA.id } });
    expect(afterIdentity?.simverseId).toBe(beforeIdentity?.simverseId);
    expect(afterIdentity?.homeCountryId).toBe(beforeIdentity?.homeCountryId);
    expect(await prisma.playerCitizenship.count()).toBe(0);
  });
});
