import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("Sup3rSecret");
    expect(hash).not.toContain("Sup3rSecret");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Sup3rSecret", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Sup3rSecret");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword("anything", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const a = await hashPassword("identical1");
    const b = await hashPassword("identical1");
    expect(a).not.toBe(b);
  });
});
