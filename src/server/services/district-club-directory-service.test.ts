import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createFictionalCountryDraft, publishFictionalCountry } from "./fictional-planet-service";
import { requestFriend } from "./social-service";
import { joinOrTransferFoundingDistrict } from "./founding-residence-service";
import {
  getMyDistrictClubDirectory, saveMyDistrictClubDirectoryPreference,
} from "./district-club-service";

let seq = 0;
async function member(label: string) {
  const registered = await registerUser({
    displayName: label,
    email: "club-directory-" + (++seq) + "-" + Date.now() + "@example.com",
    password: "Password123", confirmPassword: "Password123",
  });
  return registered.user;
}

async function makeWorld() {
  const user = await registerUser({
    displayName: "Club directory steward",
    email: "club-directory-steward-" + (++seq) + "-" + Date.now() + "@example.com",
    password: "Password123", confirmPassword: "Password123",
  });
  await prisma.fictionalPlanetSteward.create({
    data: { userId: user.user.id, isActive: true, canPublish: true },
  });
  const draft = await createFictionalCountryDraft(user.user.id, user.workspaceId, {
    name: "Valdora", color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[
      [0, 0], [5, 0], [5, 5], [0, 5], [0, 0],
    ]] },
  });
  const country = await publishFictionalCountry(user.user.id, user.workspaceId, draft.id);
  const first = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "a", name: "First Club",
      status: "ACTIVE", capacity: 100, activatedAt: new Date(),
      verifiedGeoVersionId: "fixture-approved-a" },
  });
  const second = await prisma.foundingDistrict.create({
    data: { countryId: country.id, slug: "b", name: "Second Club",
      status: "ACTIVE", capacity: 100, activatedAt: new Date(),
      verifiedGeoVersionId: "fixture-approved-b" },
  });
  return { country, first, second };
}

async function resident(countryId: string, districtId: string, label: string) {
  const user = await member(label);
  const application = await prisma.foundingCitizenshipApplication.create({
    data: { userId: user.id, countryId, submittedNationSlug: "valdora",
      status: "APPROVED", intakePolicyVersion: 1 },
  });
  await prisma.foundingPrimaryCitizenship.create({
    data: { userId: user.id, countryId, applicationId: application.id, status: "ACTIVE" },
  });
  await prisma.foundingDistrictResidence.create({ data: { userId: user.id, districtId } });
  return user;
}

beforeEach(async () => resetDb());

describe("K4.1 private opt-in District Club neighbor directory", () => {
  it("defaults hidden and grants no directory access based on country preference alone", async () => {
    const unassigned = await member("Unassigned");
    await expect(getMyDistrictClubDirectory(unassigned.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(saveMyDistrictClubDirectoryPreference(unassigned.id, {
      visible: true, intro: "I like games!",
    })).rejects.toBeInstanceOf(AuthorizationError);
    expect(await prisma.districtClubDirectoryPreference.count()).toBe(0);

    const { country, first } = await makeWorld();
    const alice = await resident(country.id, first.id, "Alice");
    const directory = await getMyDistrictClubDirectory(alice.id);
    expect(directory.mine).toEqual({ visible: false, intro: "" });
    expect(directory.neighbors).toEqual([]);
    expect(await prisma.districtClubDirectoryPreference.count()).toBe(0);
  });

  it("shows only opted-in neighbors from the same district, not private emails or IDs", async () => {
    const { country, first, second } = await makeWorld();
    const alice = await resident(country.id, first.id, "Alice");
    const bob = await resident(country.id, first.id, "Bob");
    const other = await resident(country.id, second.id, "Other");
    await saveMyDistrictClubDirectoryPreference(alice.id, {
      visible: true, intro: "I enjoy chess and community games.",
    });
    await saveMyDistrictClubDirectoryPreference(other.id, {
      visible: true, intro: "Different district.",
    });

    const bobView = await getMyDistrictClubDirectory(bob.id);
    expect(bobView.mine.visible).toBe(false);
    expect(bobView.neighbors).toHaveLength(1);
    expect(bobView.neighbors[0]).toEqual({
      displayName: "Alice",
      intro: "I enjoy chess and community games.",
      publicUsername: null,
      friendTargetUserId: null,
    });
    expect(JSON.stringify(bobView)).not.toContain(alice.email);
    expect(JSON.stringify(bobView.neighbors)).not.toContain(alice.id);
    expect((await getMyDistrictClubDirectory(other.id)).neighbors).toEqual([]);
    expect(await prisma.vascoinJournal.count()).toBe(0);
  });

  it("allows explicit opt-out to clear the stored intro and removes the listing immediately", async () => {
    const { country, first } = await makeWorld();
    const alice = await resident(country.id, first.id, "Alice");
    const bob = await resident(country.id, first.id, "Bob");
    await saveMyDistrictClubDirectoryPreference(alice.id, {
      visible: true, intro: "Let's make friends.",
    });
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(1);
    const result = await saveMyDistrictClubDirectoryPreference(alice.id, {
      visible: false, intro: "Should not persist",
    });
    expect(result).toEqual({ visible: false, intro: "" });
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(0);
    expect((await prisma.districtClubDirectoryPreference.findUnique({
      where: { userId: alice.id },
    }))?.intro).toBe("");
    expect(await prisma.auditLog.count({
      where: { actorUserId: alice.id, action: "club.directory_preference_changed" },
    })).toBe(2);
  });

  it("never republishes old consent when a citizen changes home district", async () => {
    const { country, first, second } = await makeWorld();
    const alice = await resident(country.id, first.id, "Alice");
    const bob = await resident(country.id, first.id, "Bob");
    const carol = await resident(country.id, second.id, "Carol");
    await saveMyDistrictClubDirectoryPreference(alice.id, {
      visible: true, intro: "Hello from the first district",
    });
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(1);
    // This test uses the real transfer service, not a direct DB override.
    await prisma.foundingDistrictResidence.update({
      where: { userId: alice.id },
      data: { lastTransferAt: new Date(Date.now() - 31 * 86400000) },
    });
    await prisma.foundingDistrict.update({ where: { id: first.id }, data: { occupied: 1 } });
    await joinOrTransferFoundingDistrict(alice.id, second.id);
    expect((await prisma.districtClubDirectoryPreference.findUnique({
      where: { userId: alice.id },
    }))?.isVisible).toBe(false);
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(0);
    expect((await getMyDistrictClubDirectory(carol.id)).neighbors).toHaveLength(0);
    expect((await getMyDistrictClubDirectory(alice.id)).mine.visible).toBe(false);
    await saveMyDistrictClubDirectoryPreference(alice.id, {
      visible: true, intro: "I choose to join my new district's directory",
    });
    expect((await getMyDistrictClubDirectory(carol.id)).neighbors).toHaveLength(1);
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(0);
  });

  it("hides directory members from users blocked in either direction", async () => {
    const { country, first } = await makeWorld();
    const alice = await resident(country.id, first.id, "Alice");
    const bob = await resident(country.id, first.id, "Bob");
    await saveMyDistrictClubDirectoryPreference(alice.id, { visible: true, intro: "" });
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(1);
    await prisma.socialBlock.create({ data: { blockerId: bob.id, blockedId: alice.id } });
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(0);
    await prisma.socialBlock.delete({
      where: { blockerId_blockedId: { blockerId: bob.id, blockedId: alice.id } },
    });
    await prisma.socialBlock.create({ data: { blockerId: alice.id, blockedId: bob.id } });
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors).toHaveLength(0);
  });

  it("offers friend requests only if the opted-in neighbor also has a public profile", async () => {
    const { country, first } = await makeWorld();
    const alice = await resident(country.id, first.id, "Alice");
    const bob = await resident(country.id, first.id, "Bob");
    await saveMyDistrictClubDirectoryPreference(alice.id, { visible: true, intro: "Say hello!" });
    expect((await getMyDistrictClubDirectory(bob.id)).neighbors[0]?.friendTargetUserId).toBeNull();
    await prisma.playerIdentity.update({
      where: { userId: alice.id },
      data: { username: "clubalice", profileVisibility: "PUBLIC" },
    });
    const peer = (await getMyDistrictClubDirectory(bob.id)).neighbors[0];
    expect(peer?.publicUsername).toBe("clubalice");
    expect(peer?.friendTargetUserId).toBe(alice.id);
    await requestFriend(bob.id, { userId: peer!.friendTargetUserId });
    expect(await prisma.socialFriendship.count()).toBe(1);
  });

  it("validates consent and intro and permits opt-out after residence revocation", async () => {
    const { country, first } = await makeWorld();
    const alice = await resident(country.id, first.id, "Alice");
    for (const payload of [
      { visible: "true" }, { visible: true, intro: "x".repeat(181) },
      { visible: true, intro: "", userId: "another" }, {},
    ]) {
      await expect(saveMyDistrictClubDirectoryPreference(alice.id, payload))
        .rejects.toBeInstanceOf(ValidationError);
    }
    await saveMyDistrictClubDirectoryPreference(alice.id, {
      visible: true, intro: "Can be cleared later",
    });
    await prisma.foundingPrimaryCitizenship.update({
      where: { userId: alice.id }, data: { status: "REVOKED" },
    });
    await expect(getMyDistrictClubDirectory(alice.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(saveMyDistrictClubDirectoryPreference(alice.id, {
      visible: true, intro: "Unauthorized",
    })).rejects.toBeInstanceOf(AuthorizationError);
    await saveMyDistrictClubDirectoryPreference(alice.id, { visible: false });
    expect((await prisma.districtClubDirectoryPreference.findUnique({
      where: { userId: alice.id },
    }))?.isVisible).toBe(false);
  });
});
