import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  deleteMyFoundingCitizenshipDraft, getMyFoundingCitizenshipDraft,
  saveMyFoundingCitizenshipDraft,
} from "./founding-citizenship-draft-service";

let sequence = 0;
async function createTestCitizen(label: string) {
  const email = `${label}-citizen-draft-${++sequence}@example.com`;
  return (await registerUser({
    displayName: "Test Citizen",
    email,
    password: "Password123",
    confirmPassword: "Password123",
  })).user;
}

beforeEach(async () => resetDb());

describe("Phase 3B founding citizenship preparation", () => {
  it("starts empty; saves only a draft without creating official citizenship", async () => {
    const user = await createTestCitizen("draft");
    expect(await getMyFoundingCitizenshipDraft(user.id)).toBeNull();
    const saved = await saveMyFoundingCitizenshipDraft(user.id, {
      targetNationSlug: "valdora",
      motivation: "I want to participate in the founding community.",
    });
    expect(saved.status).toBe("DRAFT_ONLY");
    expect(saved.targetNationName).toBe("Valdora");
    expect(saved.submitted).toBe(false);
    expect(saved.approved).toBe(false);
    expect(saved.reviewerAssigned).toBe(false);
    expect(saved.citizenshipGranted).toBe(false);
    expect(await prisma.foundingCitizenshipDraft.count()).toBe(1);
    expect(await prisma.fictionalCountry.count()).toBe(0);
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect(await prisma.playerDocumentApplication.count()).toBe(0);
    expect(await prisma.playerVirtualDocument.count()).toBe(0);
  });

  it("can change or delete one private application draft independently of nationality preference", async () => {
    const user = await createTestCitizen("change");
    await prisma.foundingCitizenInterest.create({
      data: { userId: user.id, preferredNationSlug: "arandia", proposedPilotInterest: true },
    });
    await saveMyFoundingCitizenshipDraft(user.id, { targetNationSlug: "arandia", motivation: "First" });
    const changed = await saveMyFoundingCitizenshipDraft(user.id, { targetNationSlug: "terranova", motivation: "Second" });
    expect(changed.targetNationName).toBe("Terranova");
    expect(await prisma.foundingCitizenshipDraft.count()).toBe(1);
    expect((await prisma.foundingCitizenInterest.findUnique({ where: { userId: user.id } }))?.preferredNationSlug).toBe("arandia");
    await deleteMyFoundingCitizenshipDraft(user.id);
    expect(await getMyFoundingCitizenshipDraft(user.id)).toBeNull();
    expect(await prisma.foundingCitizenInterest.count()).toBe(1);
  });

  it("rejects made-up nations, overlong text and forged approval fields", async () => {
    const user = await createTestCitizen("invalid");
    for (const payload of [
      { targetNationSlug: "nigeria", motivation: "" },
      { targetNationSlug: "VALDORA", motivation: "" },
      { targetNationSlug: "valdora", motivation: "x".repeat(751) },
      { targetNationSlug: "valdora", motivation: "", status: "APPROVED" },
      { targetNationSlug: "valdora", motivation: "", userId: "foreign-account" },
      { targetNationSlug: "valdora", motivation: "", countryId: "some-country-id" },
      { targetNationSlug: "valdora", motivation: "", reviewerAssigned: true },
    ]) {
      await expect(saveMyFoundingCitizenshipDraft(user.id, payload)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await prisma.foundingCitizenshipDraft.count()).toBe(0);
  });

  it("does not expose or modify another user's draft", async () => {
    const a = await createTestCitizen("alpha");
    const b = await createTestCitizen("beta");
    await saveMyFoundingCitizenshipDraft(a.id, { targetNationSlug: "eldoria", motivation: "My own private reason" });
    await saveMyFoundingCitizenshipDraft(b.id, { targetNationSlug: "marovia", motivation: "Different reason" });
    expect((await getMyFoundingCitizenshipDraft(a.id))?.targetNationSlug).toBe("eldoria");
    expect((await getMyFoundingCitizenshipDraft(b.id))?.targetNationSlug).toBe("marovia");
    await deleteMyFoundingCitizenshipDraft(a.id);
    expect((await getMyFoundingCitizenshipDraft(b.id))?.motivation).toBe("Different reason");
    expect(await prisma.auditLog.count({
      where: { actorUserId: b.id, action: "user.founding_citizenship_draft_saved" },
    })).toBe(1);
  });
});
