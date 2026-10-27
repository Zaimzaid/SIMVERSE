import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createEconomyLab, getEconomyLab, listEconomyLabs, mutateEconomyLab } from "./economy-lab-service";

let sequence = 0;
async function owner() {
  sequence++;
  const result = await registerUser({
    displayName: "Lab Tester", email: "economylab-" + sequence + "@example.com",
    password: "Password123", confirmPassword: "Password123",
  });
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { ownerId: result.user.id } });
  return { userId: result.user.id, workspaceId: workspace.id };
}
beforeEach(async () => { await resetDb(); });

describe("owner-scoped persistent Economy Lab", () => {
  it("persists initial allocations, wages, purchases and a conserved supply", async () => {
    const actor = await owner();
    const lab = await createEconomyLab(actor.userId, actor.workspaceId, { name: "Greenfield Town" });
    expect(lab.totalSupply).toBe(13000);
    expect(lab.state.citizens).toHaveLength(50);
    expect(await prisma.economyLabTransfer.count({ where: { labId: lab.id } })).toBe(56);
    const next = await mutateEconomyLab(actor.userId, actor.workspaceId, lab.id,
      { kind: "ADVANCE", revision: 0 });
    expect(next.state.day).toBe(1);
    expect(next.totalSupply).toBe(13000);
    const loaded = await getEconomyLab(actor.userId, actor.workspaceId, lab.id);
    expect(loaded.recent.some((t) => t.kind === "WAGE")).toBe(true);
  });
  it("prevents outdated updates from duplicating transfers", async () => {
    const actor = await owner();
    const lab = await createEconomyLab(actor.userId, actor.workspaceId, { name: "Trial Town" });
    await mutateEconomyLab(actor.userId, actor.workspaceId, lab.id,
      { kind: "SET_TAX", revision: 0, taxBps: 2000 });
    await expect(mutateEconomyLab(actor.userId, actor.workspaceId, lab.id,
      { kind: "ADVANCE", revision: 0 })).rejects.toBeInstanceOf(ConflictError);
    expect((await getEconomyLab(actor.userId, actor.workspaceId, lab.id)).state.day).toBe(0);
    expect(await prisma.economyLabTransfer.count({ where: { labId: lab.id } })).toBe(56);
  });
  it("isolates users and rejects direct mint and forged economy actions", async () => {
    const first = await owner(), second = await owner();
    const lab = await createEconomyLab(first.userId, first.workspaceId, { name: "Private Town" });
    expect(await listEconomyLabs(second.userId, second.workspaceId)).toEqual([]);
    await expect(getEconomyLab(second.userId, second.workspaceId, lab.id))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(mutateEconomyLab(first.userId, first.workspaceId, lab.id,
      { kind: "ADVANCE", revision: 0, mintedCredits: 999999 }))
      .rejects.toHaveProperty("code", "VALIDATION_ERROR");
    await expect(mutateEconomyLab(first.userId, first.workspaceId, lab.id,
      { kind: "SET_TAX", revision: 0, taxBps: 3000 }))
      .rejects.toHaveProperty("code", "VALIDATION_ERROR");
    await expect(createEconomyLab(first.userId, first.workspaceId,
      { name: "Fake town", startingBalance: 9999 }))
      .rejects.toHaveProperty("code", "VALIDATION_ERROR");
  });
});
