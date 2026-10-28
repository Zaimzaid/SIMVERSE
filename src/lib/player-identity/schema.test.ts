import { describe, expect, it } from "vitest";
import { playerIdentityUpdateSchema, usernameInput } from "./schema";

const valid = {
  username: "Sim_Creator",
  displayName: "SIMVERSE Creator",
  avatarUrl: "https://example.org/player.png",
  bannerUrl: "",
  creatorName: "Arc Studio",
  biography: "Exploring the SIMVERSE world.",
  profileVisibility: "PRIVATE",
  experienceMode: "BOTH",
  homeCountryId: "",
};

describe("SIMVERSE player identity Phase 1 validation", () => {
  it("normalizes usernames and enforces case-insensitive uniqueness format", () => {
    expect(usernameInput.parse("  Sim_Creator  ")).toBe("sim_creator");
    expect(usernameInput.parse("")).toBeNull();
    expect(usernameInput.safeParse("admin").success).toBe(false);
    expect(usernameInput.safeParse("123creators").success).toBe(false);
    expect(usernameInput.safeParse("ab").success).toBe(false);
    expect(usernameInput.safeParse("a".repeat(25)).success).toBe(false);
    expect(usernameInput.safeParse("hello-world").success).toBe(false);
  });

  it("requires deliberate private/public choice and validates creator mode", () => {
    const parsed = playerIdentityUpdateSchema.parse(valid);
    expect(parsed.username).toBe("sim_creator");
    expect(parsed.profileVisibility).toBe("PRIVATE");
    expect(parsed.homeCountryId).toBeNull();
    expect(parsed.bannerUrl).toBeNull();
    expect(playerIdentityUpdateSchema.safeParse({ ...valid, profileVisibility: "EVERYONE" }).success).toBe(false);
    expect(playerIdentityUpdateSchema.safeParse({ ...valid, experienceMode: "ADMIN" }).success).toBe(false);
  });

  it("refuses arbitrary admin, citizenship or passport grants in profile updates", () => {
    const payload = { ...valid, citizenship: "ACTIVE", isGovernmentOfficial: true };
    expect(playerIdentityUpdateSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects unsafe image URLs and oversized biography", () => {
    expect(playerIdentityUpdateSchema.safeParse({ ...valid, avatarUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(playerIdentityUpdateSchema.safeParse({ ...valid, bannerUrl: "http://example.org/a.png" }).success).toBe(false);
    expect(playerIdentityUpdateSchema.safeParse({ ...valid, biography: "a".repeat(501) }).success).toBe(false);
  });

  it("accepts sourced-country identifiers but not fake freeform country labels", () => {
    expect(playerIdentityUpdateSchema.safeParse({ ...valid, homeCountryId: "cnhv0yozx0001abc12wefbc37" }).success).toBe(true);
    expect(playerIdentityUpdateSchema.safeParse({ ...valid, homeCountryId: "Nigeria" }).success).toBe(false);
  });
});
