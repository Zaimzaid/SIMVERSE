import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { selectMyProfession, createMyVirtualBusinessDraft } from "./player-economy-service";
import { updateMyPlayerIdentity } from "./player-identity-service";
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

async function qualifiedUser(professionCode: "COMMERCE" | "AGRICULTURE" = "COMMERCE") {
  const registered = await owner();
  const id = registered.userId.slice(-8).toLowerCase();
  await updateMyPlayerIdentity(registered.userId, {
    username: "labplayer_" + id, displayName: "Lab Tester",
    avatarUrl: "", bannerUrl: "", creatorName: "", biography: "",
    profileVisibility: "PRIVATE", experienceMode: "BOTH", homeCountryId: "",
  });
  await selectMyProfession(registered.userId, { professionCode });
  return registered;
}
describe("Phase 2 workspace admission, virtual commerce and paid shifts", () => {
  it("requires deliberate workspace sharing, enforces membership and grants finite GFC", async () => {
    const townOwner = await owner();
    const second = await qualifiedUser();
    const town = await createEconomyLab(townOwner.userId, townOwner.workspaceId, { name: "Shared Greenfield" });
    await expect(getEconomyLab(second.userId, second.workspaceId, town.id))
      .rejects.toBeInstanceOf(NotFoundError);
    await prisma.workspaceMember.create({ data: {
      workspaceId: townOwner.workspaceId, userId: second.userId, role: "VIEWER",
    } });
    await expect(getEconomyLab(second.userId, townOwner.workspaceId, town.id))
      .rejects.toBeInstanceOf(NotFoundError);
    const shared = await mutateEconomyLab(townOwner.userId, townOwner.workspaceId, town.id,
      { kind: "SET_ACCESS", revision: 0, access: "WORKSPACE" });
    expect(shared.access).toBe("WORKSPACE");
    const joined = await mutateEconomyLab(second.userId, townOwner.workspaceId, town.id,
      { kind: "JOIN", revision: 1 });
    expect(joined.myAccount).toBe(115);
    expect(joined.totalSupply).toBe(13000);
    expect(joined.state.balances.treasury).toBe(3000 - 115);
    await expect(mutateEconomyLab(second.userId, townOwner.workspaceId, town.id,
      { kind: "JOIN", revision: 2 })).rejects.toHaveProperty("code", "VALIDATION_ERROR");
    await expect(mutateEconomyLab(second.userId, townOwner.workspaceId, town.id,
      { kind: "SET_TAX", revision: 2, taxBps: 0 })).rejects.toHaveProperty("code", "AUTHORIZATION_ERROR");
    const closed = await mutateEconomyLab(townOwner.userId, townOwner.workspaceId, town.id,
      { kind: "SET_ACCESS", revision: 2, access: "PRIVATE" });
    expect(closed.access).toBe("PRIVATE");
    await expect(getEconomyLab(second.userId, townOwner.workspaceId, town.id))
      .rejects.toBeInstanceOf(NotFoundError);
    expect((await getEconomyLab(townOwner.userId, townOwner.workspaceId, town.id)).totalSupply).toBe(13000);
  });

  it("requires an approved company for economic operation; records real in-game payments", async () => {
    const player = await qualifiedUser();
    const town = await createEconomyLab(player.userId, player.workspaceId, { name: "Commerce Town" });
    const draft = await createMyVirtualBusinessDraft(player.userId, {
      name: "Player Grocery Pilot", sector: "COMMERCE", description: "Demo grocery operations",
    });
    const joined = await mutateEconomyLab(player.userId, player.workspaceId, town.id,
      { kind: "JOIN", revision: 0 });
    await expect(mutateEconomyLab(player.userId, player.workspaceId, town.id,
      { kind: "OPEN_SHOP", revision: 1, businessId: draft.business.id }))
      .rejects.toHaveProperty("code", "AUTHORIZATION_ERROR");
    // Test fixture models independent Phase 6 reviewer approval; production never self-approves.
    await prisma.playerVirtualBusiness.update({
      where: { id: draft.business.id }, data: { status: "APPROVED" },
    });
    const opened = await mutateEconomyLab(player.userId, player.workspaceId, town.id,
      { kind: "OPEN_SHOP", revision: 1, businessId: draft.business.id });
    expect(opened.myAccount).toBe(85);
    const funded = await mutateEconomyLab(player.userId, player.workspaceId, town.id,
      { kind: "INVEST", revision: 2, businessId: draft.business.id, amount: 20 });
    const restocked = await mutateEconomyLab(player.userId, player.workspaceId, town.id,
      { kind: "BUY_STOCK", revision: 3, businessId: draft.business.id, units: 3 });
    expect(restocked.state.companies?.[0]?.stock).toBe(3);
    expect(restocked.totalSupply).toBe(13000);
    expect(funded.totalSupply).toBe(joined.totalSupply);
    await expect(mutateEconomyLab(player.userId, player.workspaceId, town.id,
      { kind: "INVEST", revision: 3, businessId: draft.business.id, amount: 20 }))
      .rejects.toBeInstanceOf(ConflictError);
    const details = await getEconomyLab(player.userId, player.workspaceId, town.id);
    expect(details.recent.some(t => t.kind === "PLAYER_WHOLESALE")).toBe(true);
    expect(details.approvedBusinesses.some(b => b.id === draft.business.id)).toBe(true);
  });

  it("only pays accepted workers joined to this town, once per in-game day", async () => {
    const creator = await qualifiedUser();
    const employee = await qualifiedUser("AGRICULTURE");
    const lab = await createEconomyLab(creator.userId, creator.workspaceId, { name: "Employment Village" });
    await prisma.workspaceMember.create({ data: {
      workspaceId: creator.workspaceId, userId: employee.userId, role: "VIEWER",
    } });
    const draft = await createMyVirtualBusinessDraft(creator.userId, {
      name: "Employment Demo LLC", sector: "COMMERCE",
    });
    await prisma.playerVirtualBusiness.update({
      where: { id: draft.business.id }, data: { status: "APPROVED" },
    });
    const job = await prisma.playerVirtualJob.create({ data: {
      businessId: draft.business.id, title: "Field Worker",
      description: "Fictional agricultural and retail town work.", professionCode: "AGRICULTURE",
    } });
    const identity = await prisma.playerIdentity.findUniqueOrThrow({ where: { userId: employee.userId } });
    const application = await prisma.playerWorkApplication.create({ data: {
      jobId: job.id, applicantIdentityId: identity.id, statement: "Test accepted employment",
      status: "ACCEPTED",
    } });
    const employment = await prisma.playerVirtualEmployment.create({
      data: { applicationId: application.id, status: "ACTIVE" },
    });
    let revision = 0;
    let result = await mutateEconomyLab(creator.userId, creator.workspaceId, lab.id,
      { kind: "SET_ACCESS", revision: revision++, access: "WORKSPACE" });
    result = await mutateEconomyLab(creator.userId, creator.workspaceId, lab.id,
      { kind: "JOIN", revision: revision++ });
    result = await mutateEconomyLab(employee.userId, creator.workspaceId, lab.id,
      { kind: "JOIN", revision: revision++ });
    result = await mutateEconomyLab(creator.userId, creator.workspaceId, lab.id,
      { kind: "OPEN_SHOP", revision: revision++, businessId: draft.business.id });
    const before = result.state.balances["player:" + employee.userId] ?? 0;
    const paid = await mutateEconomyLab(employee.userId, creator.workspaceId, lab.id,
      { kind: "WORK_SHIFT", revision: revision++, employmentId: employment.id });
    expect(paid.state.balances["player:" + employee.userId]).toBe(before + 4);
    expect(paid.totalSupply).toBe(13000);
    await expect(mutateEconomyLab(employee.userId, creator.workspaceId, lab.id,
      { kind: "WORK_SHIFT", revision, employmentId: employment.id }))
      .rejects.toHaveProperty("code", "VALIDATION_ERROR");
    const other = await qualifiedUser();
    await prisma.workspaceMember.create({ data: { workspaceId: creator.workspaceId, userId: other.userId, role: "VIEWER" } });
    await expect(mutateEconomyLab(other.userId, creator.workspaceId, lab.id,
      { kind: "WORK_SHIFT", revision, employmentId: employment.id }))
      .rejects.toHaveProperty("code", "AUTHORIZATION_ERROR");
  });
});
