import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import type { WorkspaceRole } from "@/lib/permissions";
import { isValidSeed } from "@/lib/simulations/seed";
import { registerUser } from "@/server/services/auth-service";
import {
  archiveSimulation,
  createSimulation,
  deleteSimulation,
  duplicateSimulation,
  getSimulation,
  listSimulations,
  markSimulationDraft,
  markSimulationReady,
  restoreSimulation,
  updateSimulation,
  type SimulationView,
} from "@/server/services/simulation-service";
import { createProject } from "@/server/services/project-service";
import { createEntity } from "@/server/services/entity-service";
import { getWorkspaceStats } from "@/server/services/dashboard-service";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";

beforeEach(async () => {
  await resetDb();
});

let seq = 0;
async function makeUser() {
  seq += 1;
  return registerUser({
    displayName: `User ${seq}`,
    email: `user${seq}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

/** Add an existing user to a workspace with a given role (for permission tests). */
async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}

/** Create a project plus `count` entities in one workspace; returns their ids. */
async function makeProjectWithEntities(userId: string, workspaceId: string, count: number) {
  const project = await createProject(userId, workspaceId, { name: "Test Project" });
  const entityIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const entity = await createEntity(userId, workspaceId, { name: `Entity ${i}`, category: "object" });
    entityIds.push(entity.id);
  }
  return { projectId: project.id, entityIds };
}

/** Create a valid, ready-eligible battle simulation (2 participants). */
async function makeReadySimulation(userId: string, workspaceId: string): Promise<SimulationView> {
  const { projectId, entityIds } = await makeProjectWithEntities(userId, workspaceId, 2);
  return createSimulation(userId, workspaceId, {
    projectId,
    name: "Ready Battle",
    mode: "battle",
    participants: entityIds.map((entityId) => ({ entityId })),
  });
}

describe("createSimulation", () => {
  it("creates a DRAFT blueprint with versioned config, default presentation, a seed and ordered participants", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 2);

    const sim = await createSimulation(user.id, workspaceId, {
      projectId,
      name: "First Battle",
      mode: "battle",
      participants: entityIds.map((entityId) => ({ entityId })),
    });

    expect(sim.id).toBeTruthy();
    expect(sim.workspaceId).toBe(workspaceId);
    expect(sim.projectId).toBe(projectId);
    expect(sim.projectName).toBe("Test Project");
    expect(sim.status).toBe("DRAFT"); // always starts as DRAFT — never runnable
    expect(sim.mode).toBe("battle");
    expect(sim.modeLabel).toBe("Battle");

    // Versioned configuration with mode-agnostic defaults + battle placeholder default.
    expect(sim.configVersion).toBe(1);
    expect(sim.configuration.version).toBe(1);
    expect(sim.configuration.general).toMatchObject({
      speed: "normal",
      difficulty: "normal",
      roundLimit: null,
      randomEvents: true,
      allowTies: false,
    });
    expect(sim.configuration.mode).toEqual({ format: "free_for_all" });

    // Presentation stored separately, with defaults.
    expect(sim.presentation).toEqual({
      displayTitle: null,
      themeColor: null,
      showLabels: true,
      showLeaderboard: true,
    });

    // Seed is a well-formed label (metadata only — nothing executes it).
    expect(sim.seed).not.toBeNull();
    expect(isValidSeed(sim.seed ?? "")).toBe(true);

    // Participants keep array order via sequential positions.
    expect(sim.participants.map((p) => p.position)).toEqual([0, 1]);
    expect(sim.participants.map((p) => p.entityId)).toEqual(entityIds);
    expect(sim.participants[0]?.entity?.name).toBe("Entity 0");
  });

  it("normalizes provided configuration and presentation server-side", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 2);

    const sim = await createSimulation(user.id, workspaceId, {
      projectId,
      name: "Configured",
      mode: "battle",
      participants: entityIds.map((entityId) => ({ entityId })),
      configuration: {
        general: { speed: "fast", difficulty: "hard", roundLimit: 50, randomEvents: false, allowTies: true },
        mode: { format: "duel" },
      },
      presentation: { displayTitle: "Grand Duel", themeColor: "#22d3ee", showLabels: false },
    });

    expect(sim.configuration.general).toMatchObject({
      speed: "fast",
      difficulty: "hard",
      roundLimit: 50,
      randomEvents: false,
      allowTies: true,
    });
    expect(sim.configuration.mode).toEqual({ format: "duel" });
    expect(sim.presentation.displayTitle).toBe("Grand Duel");
    expect(sim.presentation.themeColor).toBe("#22D3EE"); // hex uppercased
    expect(sim.presentation.showLabels).toBe(false);
    expect(sim.presentation.showLeaderboard).toBe(true); // default preserved
  });

  it("accepts an explicit valid seed and normalizes the mode key", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 2);

    const sim = await createSimulation(user.id, workspaceId, {
      projectId,
      name: "Seeded",
      mode: "Battle", // not yet slugified
      seed: "SV-ABCD2345",
      participants: entityIds.map((entityId) => ({ entityId })),
    });

    expect(sim.seed).toBe("SV-ABCD2345");
    expect(sim.mode).toBe("battle");
  });

  it("collapses duplicate participants and reassigns sequential positions", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 2);
    const [first, second] = entityIds;

    const sim = await createSimulation(user.id, workspaceId, {
      projectId,
      name: "Deduped",
      mode: "battle",
      participants: [{ entityId: first! }, { entityId: second! }, { entityId: first! }],
    });

    expect(sim.participants).toHaveLength(2);
    expect(sim.participants.map((p) => p.entityId)).toEqual([first, second]);
    expect(sim.participants.map((p) => p.position)).toEqual([0, 1]);
  });

  it("rejects invalid mode-specific configuration (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId } = await makeProjectWithEntities(user.id, workspaceId, 0);

    await expect(
      createSimulation(user.id, workspaceId, {
        projectId,
        name: "Bad Config",
        mode: "battle",
        configuration: { mode: { format: "not_a_real_format" } },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a malformed seed (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId } = await makeProjectWithEntities(user.id, workspaceId, 0);

    await expect(
      createSimulation(user.id, workspaceId, {
        projectId,
        name: "Bad Seed",
        mode: "battle",
        seed: "NOT-A-SEED",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an empty name (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId } = await makeProjectWithEntities(user.id, workspaceId, 0);
    await expect(
      createSimulation(user.id, workspaceId, { projectId, name: "", mode: "battle" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a project that belongs to another workspace (ValidationError)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const { projectId } = await makeProjectWithEntities(a.user.id, a.workspaceId, 0);

    // b builds in their own workspace but points at a's project id → not available here.
    await expect(
      createSimulation(b.user.id, b.workspaceId, { projectId, name: "Cross", mode: "battle" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a participant entity from another workspace (ValidationError)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const { projectId } = await makeProjectWithEntities(a.user.id, a.workspaceId, 0);
    const foreign = await createEntity(b.user.id, b.workspaceId, { name: "Foreign", category: "object" });

    // A simulation can never reference an entity from another workspace.
    await expect(
      createSimulation(a.user.id, a.workspaceId, {
        projectId,
        name: "Cross Participant",
        mode: "battle",
        participants: [{ entityId: foreign.id }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("forbids a VIEWER from creating (AuthorizationError)", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const { projectId } = await makeProjectWithEntities(owner.user.id, owner.workspaceId, 0);

    await expect(
      createSimulation(viewer.user.id, owner.workspaceId, { projectId, name: "Nope", mode: "battle" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("records an audit entry", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId } = await makeProjectWithEntities(user.id, workspaceId, 0);
    await createSimulation(user.id, workspaceId, { projectId, name: "Audited", mode: "battle" });
    const actions = (await prisma.auditLog.findMany({ where: { workspaceId } })).map((a) => a.action);
    expect(actions).toContain("simulation.created");
  });
});

describe("workspace isolation & security", () => {
  it("does not return another workspace's simulation from getSimulation", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const sim = await makeReadySimulation(a.user.id, a.workspaceId);

    await expect(getSimulation(b.user.id, b.workspaceId, sim.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("prevents a non-member from accessing a simulation via the owning workspace id", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const sim = await makeReadySimulation(a.user.id, a.workspaceId);

    await expect(getSimulation(b.user.id, a.workspaceId, sim.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("prevents editing another workspace's simulation", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const sim = await makeReadySimulation(a.user.id, a.workspaceId);

    await expect(
      updateSimulation(b.user.id, b.workspaceId, sim.id, { name: "Hacked" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const fromDb = await prisma.simulation.findUnique({ where: { id: sim.id } });
    expect(fromDb?.name).toBe("Ready Battle");
  });

  it("list is scoped to the active workspace", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeReadySimulation(a.user.id, a.workspaceId);
    await makeReadySimulation(b.user.id, b.workspaceId);

    const listA = await listSimulations(a.user.id, a.workspaceId);
    expect(listA.items).toHaveLength(1);
    expect(listA.items[0]?.name).toBe("Ready Battle");
  });
});

describe("updateSimulation", () => {
  it("updates scalar fields", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);

    const updated = await updateSimulation(user.id, workspaceId, sim.id, {
      name: "Renamed",
      description: "Now described.",
    });
    expect(updated.name).toBe("Renamed");
    expect(updated.description).toBe("Now described.");
  });

  it("returns a READY blueprint to DRAFT when a validity-affecting field changes", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);
    const ready = await markSimulationReady(user.id, workspaceId, sim.id);
    expect(ready.status).toBe("READY");

    // A pure name change keeps READY (does not affect validity).
    const renamed = await updateSimulation(user.id, workspaceId, sim.id, { name: "Still Ready" });
    expect(renamed.status).toBe("READY");

    // Changing the configuration invalidates the prior READY check → back to DRAFT.
    const reconfigured = await updateSimulation(user.id, workspaceId, sim.id, {
      configuration: { general: { speed: "fast" } },
    });
    expect(reconfigured.status).toBe("DRAFT");
  });

  it("replaces participants", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);
    const replacement = await createEntity(user.id, workspaceId, { name: "Newcomer", category: "object" });

    const updated = await updateSimulation(user.id, workspaceId, sim.id, {
      participants: [{ entityId: replacement.id }],
    });
    expect(updated.participants).toHaveLength(1);
    expect(updated.participants[0]?.entityId).toBe(replacement.id);
  });

  it("resets mode-specific config to the new mode's defaults when the mode changes without a new config", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 2);
    const sim = await createSimulation(user.id, workspaceId, {
      projectId,
      name: "Switcher",
      mode: "battle",
      participants: entityIds.map((entityId) => ({ entityId })),
      configuration: { general: { speed: "fast" }, mode: { format: "duel" } },
    });

    const switched = await updateSimulation(user.id, workspaceId, sim.id, { mode: "race" });

    expect(switched.mode).toBe("race");
    // General settings are preserved…
    expect(switched.configuration.general.speed).toBe("fast");
    // …while the mode placeholder resets to race's default.
    expect(switched.configuration.mode).toMatchObject({ version: 1, mode: "SPRINT", distance: 1_000, laps: 1 });
  });
});

describe("duplicateSimulation", () => {
  it("copies config, presentation and participants with a NEW seed and DRAFT status", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await createSimulationWithPresentation(user.id, workspaceId);
    const ready = await markSimulationReady(user.id, workspaceId, sim.id);
    expect(ready.status).toBe("READY");

    const copy = await duplicateSimulation(user.id, workspaceId, sim.id);

    expect(copy.id).not.toBe(sim.id);
    expect(copy.name).toBe("Blueprint Copy");
    expect(copy.status).toBe("DRAFT"); // a copy is never born READY
    expect(copy.seed).not.toBe(sim.seed); // fresh seed
    expect(isValidSeed(copy.seed ?? "")).toBe(true);
    expect(copy.configuration).toEqual(sim.configuration);
    expect(copy.presentation).toEqual(sim.presentation);
    expect(copy.participants.map((p) => p.entityId)).toEqual(sim.participants.map((p) => p.entityId));
  });

  it("accepts an explicit new name", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);
    const copy = await duplicateSimulation(user.id, workspaceId, sim.id, { name: "Custom Name" });
    expect(copy.name).toBe("Custom Name");
  });

  async function createSimulationWithPresentation(userId: string, workspaceId: string) {
    const { projectId, entityIds } = await makeProjectWithEntities(userId, workspaceId, 2);
    return createSimulation(userId, workspaceId, {
      projectId,
      name: "Blueprint",
      mode: "battle",
      participants: entityIds.map((entityId) => ({ entityId })),
      presentation: { displayTitle: "Shown", themeColor: "#FF8800" },
    });
  }
});

describe("archive / restore", () => {
  it("archives a simulation and hides it from the default list", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);

    const archived = await archiveSimulation(user.id, workspaceId, sim.id);
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).not.toBeNull();

    const visible = await listSimulations(user.id, workspaceId);
    expect(visible.items).toHaveLength(0);
  });

  it("restores a complete blueprint back to READY", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);
    await archiveSimulation(user.id, workspaceId, sim.id);

    // A valid blueprint (name, project, available mode, ≥2 participants, valid seed)
    // is re-derived to READY on restore.
    const restored = await restoreSimulation(user.id, workspaceId, sim.id);
    expect(restored.status).toBe("READY");
    expect(restored.archivedAt).toBeNull();
  });

  it("restores an incomplete blueprint to DRAFT (not READY)", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId } = await makeProjectWithEntities(user.id, workspaceId, 0);
    // No participants → fails the READY check.
    const sim = await createSimulation(user.id, workspaceId, {
      projectId,
      name: "Incomplete",
      mode: "battle",
    });
    await archiveSimulation(user.id, workspaceId, sim.id);

    const restored = await restoreSimulation(user.id, workspaceId, sim.id);
    expect(restored.status).toBe("DRAFT");
  });
});

describe("deleteSimulation", () => {
  it("permanently deletes and cascades participant links but never the entities", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);
    const entityIds = sim.participants.map((p) => p.entityId);

    const result = await deleteSimulation(user.id, workspaceId, sim.id);
    expect(result.id).toBe(sim.id);

    expect(await prisma.simulation.findUnique({ where: { id: sim.id } })).toBeNull();
    expect(await prisma.simulationEntity.count({ where: { simulationId: sim.id } })).toBe(0);
    // The referenced entities survive.
    for (const entityId of entityIds) {
      expect(await prisma.entity.findUnique({ where: { id: entityId } })).not.toBeNull();
    }
  });

  it("forbids a CREATOR (no simulation.delete) from deleting", async () => {
    const owner = await makeUser();
    const creator = await makeUser();
    await addMember(owner.workspaceId, creator.user.id, "CREATOR");
    const sim = await makeReadySimulation(owner.user.id, owner.workspaceId);

    await expect(
      deleteSimulation(creator.user.id, owner.workspaceId, sim.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("markSimulationReady / markSimulationDraft (READY validation)", () => {
  it("marks a complete, valid blueprint READY", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);
    const ready = await markSimulationReady(user.id, workspaceId, sim.id);
    expect(ready.status).toBe("READY");

    const actions = (await prisma.auditLog.findMany({ where: { workspaceId } })).map((a) => a.action);
    expect(actions).toContain("simulation.ready");
  });

  it("refuses to mark READY when below the mode's minimum participants (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 1);
    // Battle needs 2; supply only 1.
    const sim = await createSimulation(user.id, workspaceId, {
      projectId,
      name: "Too Few",
      mode: "battle",
      participants: [{ entityId: entityIds[0]! }],
    });

    await expect(markSimulationReady(user.id, workspaceId, sim.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
    // Status is unchanged — it stays a DRAFT.
    const after = await getSimulation(user.id, workspaceId, sim.id);
    expect(after.status).toBe("DRAFT");
  });

  it("returns a READY blueprint to DRAFT via markSimulationDraft", async () => {
    const { user, workspaceId } = await makeUser();
    const sim = await makeReadySimulation(user.id, workspaceId);
    await markSimulationReady(user.id, workspaceId, sim.id);

    const draft = await markSimulationDraft(user.id, workspaceId, sim.id);
    expect(draft.status).toBe("DRAFT");
  });
});

describe("list: filter / mode / project / status / search / sort / paginate", () => {
  it("filters by mode and by project", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId: projectA, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 2);
    const projectB = (await createProject(user.id, workspaceId, { name: "Project B" })).id;

    await createSimulation(user.id, workspaceId, {
      projectId: projectA,
      name: "A Battle",
      mode: "battle",
      participants: entityIds.map((entityId) => ({ entityId })),
    });
    await createSimulation(user.id, workspaceId, {
      projectId: projectB,
      name: "B Race",
      mode: "race",
      participants: entityIds.map((entityId) => ({ entityId })),
    });

    const battles = await listSimulations(user.id, workspaceId, { mode: "battle" });
    expect(battles.items.map((s) => s.name)).toEqual(["A Battle"]);

    const inB = await listSimulations(user.id, workspaceId, { projectId: projectB });
    expect(inB.items.map((s) => s.name)).toEqual(["B Race"]);
  });

  it("hides archived by default, filters by explicit status, and includes them with ALL", async () => {
    const { user, workspaceId } = await makeUser();
    const active = await makeReadySimulation(user.id, workspaceId);
    const archived = await makeReadySimulation(user.id, workspaceId);
    await archiveSimulation(user.id, workspaceId, archived.id);

    const byDefault = await listSimulations(user.id, workspaceId);
    expect(byDefault.items.map((s) => s.id)).toEqual([active.id]);

    const onlyArchived = await listSimulations(user.id, workspaceId, { status: "ARCHIVED" });
    expect(onlyArchived.items.map((s) => s.id)).toEqual([archived.id]);

    const all = await listSimulations(user.id, workspaceId, { status: "ALL" });
    expect(all.items).toHaveLength(2);
  });

  it("searches by name and sorts by name", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId, entityIds } = await makeProjectWithEntities(user.id, workspaceId, 2);
    const participants = entityIds.map((entityId) => ({ entityId }));
    await createSimulation(user.id, workspaceId, { projectId, name: "Falcon Duel", mode: "battle", participants });
    await createSimulation(user.id, workspaceId, { projectId, name: "Tiger Duel", mode: "battle", participants });
    await createSimulation(user.id, workspaceId, { projectId, name: "Falcon Sprint", mode: "race", participants });

    const found = await listSimulations(user.id, workspaceId, { search: "falcon" });
    expect(found.items.map((s) => s.name).sort()).toEqual(["Falcon Duel", "Falcon Sprint"]);

    const asc = await listSimulations(user.id, workspaceId, { sort: "name_asc" });
    expect(asc.items.map((s) => s.name)).toEqual(["Falcon Duel", "Falcon Sprint", "Tiger Duel"]);
  });

  it("paginates", async () => {
    const { user, workspaceId } = await makeUser();
    const { projectId } = await makeProjectWithEntities(user.id, workspaceId, 0);
    for (let i = 0; i < 5; i += 1) {
      await createSimulation(user.id, workspaceId, { projectId, name: `S${i}`, mode: "battle" });
    }
    const page1 = await listSimulations(user.id, workspaceId, { pageSize: 2, page: 1 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.pageCount).toBe(3);
  });
});

describe("dashboard simulation count", () => {
  it("counts non-archived simulations (DRAFT + READY), excluding archived", async () => {
    const { user, workspaceId } = await makeUser();
    const draft = await makeReadySimulation(user.id, workspaceId); // DRAFT until marked
    const ready = await makeReadySimulation(user.id, workspaceId);
    await markSimulationReady(user.id, workspaceId, ready.id);
    const archived = await makeReadySimulation(user.id, workspaceId);
    await archiveSimulation(user.id, workspaceId, archived.id);

    const stats = await getWorkspaceStats(user.id, workspaceId);
    // draft (DRAFT) + ready (READY) counted; archived excluded.
    expect(stats.simulations).toBe(2);
    expect(draft.status).toBe("DRAFT");
  });
});
