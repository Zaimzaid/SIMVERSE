import { describe, expect, it } from "vitest";
import { avatarSchema, DEFAULT_PLAYER_AVATAR, parseStoredPlayerAvatar } from "./appearance";
describe("player avatar appearance", () => {
  it("uses a safe default for older or corrupt records", () => {
    expect(parseStoredPlayerAvatar(null)).toEqual(DEFAULT_PLAYER_AVATAR);
    expect(parseStoredPlayerAvatar("{invalid")).toEqual(DEFAULT_PLAYER_AVATAR);
  });
  it("saves supported values and rejects extra fields", () => {
    expect(parseStoredPlayerAvatar(JSON.stringify(DEFAULT_PLAYER_AVATAR))).toEqual(DEFAULT_PLAYER_AVATAR);
    expect(avatarSchema.safeParse({ ...DEFAULT_PLAYER_AVATAR, isAdmin: true }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...DEFAULT_PLAYER_AVATAR, height: 50 }).success).toBe(false);
  });
});
