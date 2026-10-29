import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { DEFAULT_PLAYER_AVATAR } from "@/lib/player-avatar/appearance";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { getMyPlayerAvatar, saveMyPlayerAvatar } from "./player-avatar-service";

beforeEach(async () => { await resetDb(); });

const newAccount = (email: string) => registerUser({
  displayName: "Avatar Tester", email,
  password: "Password123", confirmPassword: "Password123",
});

describe("account-owned SIMVERSE avatar persistence", () => {
  it("starts with an account-scoped default and saves a durable appearance", async () => {
    const { user } = await newAccount("avatar-a@example.com");
    expect(await getMyPlayerAvatar(user.id)).toEqual(DEFAULT_PLAYER_AVATAR);
    const custom = { ...DEFAULT_PLAYER_AVATAR, outfit: "#ffbb22", hairstyle: "CURLY" as const, height: 1.15 };
    expect(await saveMyPlayerAvatar(user.id, custom)).toEqual(custom);
    expect(await getMyPlayerAvatar(user.id)).toEqual(custom);
    const stored = await prisma.playerIdentity.findUniqueOrThrow({ where: { userId: user.id } });
    expect(JSON.parse(stored.avatarAppearanceJson!)).toEqual(custom);
    expect(await prisma.auditLog.count({
      where: { actorUserId: user.id, action: "user.player_avatar_updated" },
    })).toBe(1);
  });

  it("does not update another player's appearance", async () => {
    const first = await newAccount("avatar-one@example.com");
    const second = await newAccount("avatar-two@example.com");
    await saveMyPlayerAvatar(first.user.id, { ...DEFAULT_PLAYER_AVATAR, hair: "#ffaa33" });
    expect(await getMyPlayerAvatar(second.user.id)).toEqual(DEFAULT_PLAYER_AVATAR);
    expect((await getMyPlayerAvatar(first.user.id)).hair).toBe("#ffaa33");
  });

  it("rejects unauthorized fields and invalid character dimensions without mutation", async () => {
    const { user } = await newAccount("avatar-rejection@example.com");
    await expect(saveMyPlayerAvatar(user.id, { ...DEFAULT_PLAYER_AVATAR, isAdmin: true }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(saveMyPlayerAvatar(user.id, { ...DEFAULT_PLAYER_AVATAR, height: 10 }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(await getMyPlayerAvatar(user.id)).toEqual(DEFAULT_PLAYER_AVATAR);
    const stored = await prisma.playerIdentity.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stored.avatarAppearanceJson).toBeNull();
  });
});
