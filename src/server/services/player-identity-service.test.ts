import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { registerUser } from "./auth-service";
import {
  ensurePlayerIdentity,
  getMyPlayerIdentity,
  getPublicPlayerProfile,
  getViewablePlayerProfile,
  updateMyPlayerIdentity,
} from "./player-identity-service";
import { resetDb } from "../../../test/helpers/db";
import { requestFriend, respondFriend, blockPlayer, unblockPlayer } from "./social-service";

beforeEach(async () => { await resetDb(); });

const registration = (email: string) => ({
  displayName: "Visitor",
  email,
  password: "Password123",
  confirmPassword: "Password123",
});

function update(username: string, visibility: "PRIVATE" | "PUBLIC" = "PRIVATE") {
  return {
    username, displayName: "SIMVERSE Traveler", avatarUrl: "",
    bannerUrl: "", creatorName: "Arc Studio",
    biography: "Explorer and virtual creator",
    profileVisibility: visibility,
    experienceMode: "BOTH",
    homeCountryId: "",
  };
}

describe("Phase 1 player identity persistence and privacy", () => {
  it("creates exactly one permanent SIMVERSE ID on registration and legacy reads", async () => {
    const { user } = await registerUser(registration("visitor@example.com"));
    const first = await getMyPlayerIdentity(user.id);
    const second = await ensurePlayerIdentity(user.id);
    expect(first.simverseId).toMatch(/^SV-[0-9A-F]{24}$/);
    expect(second.simverseId).toBe(first.simverseId);
    expect(await prisma.playerIdentity.count({ where: { userId: user.id } })).toBe(1);
    expect(first.profileVisibility).toBe("PRIVATE");
    expect(first.citizenships).toEqual([]);
  });

  it("keeps private profiles undiscoverable, and only publishes sanitized fields", async () => {
    const { user } = await registerUser(registration("one@example.com"));
    await updateMyPlayerIdentity(user.id, update("Traveler_One"));
    expect(await getPublicPlayerProfile("traveler_one")).toBeNull();
    const result = await updateMyPlayerIdentity(user.id, update("Traveler_One", "PUBLIC"));
    const publicData = await getPublicPlayerProfile("TRAVELER_ONE");
    expect(publicData?.username).toBe("traveler_one");
    expect(publicData?.biography).toBe("Explorer and virtual creator");
    expect(publicData).not.toHaveProperty("email");
    expect(publicData).not.toHaveProperty("simverseId");
    expect(publicData).not.toHaveProperty("citizenships");
    expect(result.simverseId).toMatch(/^SV-/);
  });

  it("blocks duplicate usernames case insensitively at the database boundary", async () => {
    const a = await registerUser(registration("alpha@example.com"));
    const b = await registerUser(registration("beta@example.com"));
    await updateMyPlayerIdentity(a.user.id, update("unique_owner", "PUBLIC"));
    await expect(updateMyPlayerIdentity(b.user.id, update("UNIQUE_OWNER", "PUBLIC")))
      .rejects.toBeInstanceOf(ConflictError);
    expect((await getMyPlayerIdentity(b.user.id)).username).toBeNull();
  });

  it("never converts home-country selection into citizenship or passport rights", async () => {
    const { user } = await registerUser(registration("citizen@example.com"));
    await expect(updateMyPlayerIdentity(user.id, {
      ...update("citizen_one"),
      homeCountryId: "cnothinginvalid0000000000000",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateMyPlayerIdentity(user.id, {
      ...update("citizen_one"),
      citizenshipStatus: "ACTIVE",
      isGovernmentOfficial: true,
    })).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.playerCitizenship.count()).toBe(0);
    expect((await getMyPlayerIdentity(user.id)).homeCountryId).toBeNull();
  });

  it("updates player and account display name together", async () => {
    const { user } = await registerUser(registration("name@example.com"));
    const idBefore = (await getMyPlayerIdentity(user.id)).simverseId;
    const after = await updateMyPlayerIdentity(user.id, update("creator_user"));
    expect(after.displayName).toBe("SIMVERSE Traveler");
    expect(after.creatorName).toBe("Arc Studio");
    expect(after.experienceMode).toBe("BOTH");
    expect(after.simverseId).toBe(idBefore);
    const action = await prisma.auditLog.findFirst({ where: { actorUserId: user.id, action: "user.player_identity_updated" } });
    expect(action).not.toBeNull();
  });
  it("permits accepted friends to view a private profile without exposing sensitive identity fields", async () => {
    const a = (await registerUser(registration("private-a@example.com"))).user;
    const b = (await registerUser(registration("private-b@example.com"))).user;
    const outsider = (await registerUser(registration("private-outsider@example.com"))).user;

    await updateMyPlayerIdentity(a.id, update("hidden_friend", "PUBLIC"));
    await updateMyPlayerIdentity(b.id, update("friend_viewer", "PUBLIC"));
    const pending = await requestFriend(b.id, { userId: a.id });
    await updateMyPlayerIdentity(a.id, update("hidden_friend", "PRIVATE"));

    expect(await getPublicPlayerProfile("hidden_friend")).toBeNull();
    expect(await getViewablePlayerProfile("hidden_friend", b.id)).toBeNull();
    expect(await getViewablePlayerProfile("hidden_friend", outsider.id)).toBeNull();

    await respondFriend(a.id, pending.id, "ACCEPT");
    const friendView = await getViewablePlayerProfile("hidden_friend", b.id);
    expect(friendView).toMatchObject({ username: "hidden_friend", biography: "Explorer and virtual creator" });
    expect(friendView).not.toHaveProperty("email");
    expect(friendView).not.toHaveProperty("simverseId");
    expect(friendView).not.toHaveProperty("citizenships");
    expect(await getViewablePlayerProfile("hidden_friend", a.id)).not.toBeNull();
    expect(await getViewablePlayerProfile("hidden_friend", outsider.id)).toBeNull();

    await blockPlayer(a.id, { userId: b.id });
    expect(await getViewablePlayerProfile("hidden_friend", b.id)).toBeNull();
    await unblockPlayer(a.id, b.id);
    // Blocking revokes friendship; simply unblocking must not restore private access.
    expect(await getViewablePlayerProfile("hidden_friend", b.id)).toBeNull();
  });
  it("does not disclose a PUBLIC profile to a signed-in player who has been blocked", async () => {
    const a = (await registerUser(registration("public-owner@example.com"))).user;
    const b = (await registerUser(registration("blocked-viewer@example.com"))).user;
    await updateMyPlayerIdentity(a.id, update("public_owner", "PUBLIC"));
    expect(await getViewablePlayerProfile("public_owner", b.id)).not.toBeNull();
    await blockPlayer(a.id, { userId: b.id });
    expect(await getViewablePlayerProfile("public_owner", b.id)).toBeNull();
  });

});
