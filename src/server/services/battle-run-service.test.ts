import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { battleResultSchema } from "@/lib/modules/battle/schemas";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAttributeDefinition } from "./attribute-service";
import { createEntity, deleteEntity, updateEntity, upsertEntityVisualProfile } from "./entity-service";
import { DEFAULT_VISUAL_PROFILE } from "@/lib/visuals/profile";
import { createProject, deleteProject } from "./project-service";
import { createSimulation, deleteSimulation, markSimulationReady } from "./simulation-service";
import {
  advanceSimulationRun, createSimulationRun, executeUntilComplete, getSimulationRun,
  listSimulationRunActions, listSimulationRunEvents, pauseSimulationRun,
  resumeSimulationRun, startSimulationRun,
} from "./simulation-run-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function user() {
  sequence += 1;
  return registerUser({ displayName: `Battle User ${sequence}`, email: `battle-${sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123" });
}

async function scenario(options: { format?: string; count?: number; limit?: number; categories?: string[] } = {}) {
  const account = await user();
  const { workspaceId } = account;
  const ownerId = account.user.id;
  const strength = await createAttributeDefinition(ownerId, workspaceId, {
    name: "Strength", dataType: "NUMBER", minimum: 0, maximum: 100,
  });
  const entities = [];
  for (let index = 0; index < (options.count ?? 2); index += 1) {
    entities.push(await createEntity(ownerId, workspaceId, {
      name: `Fighter ${index}`, category: options.categories?.[index] ?? "object",
      attributes: [{ attributeDefinitionId: strength.id, value: index === 0 ? 100 : 25 }],
    }));
  }
  const project = await createProject(ownerId, workspaceId, { name: "Battle Test Project" });
  const simulation = await createSimulation(ownerId, workspaceId, {
    projectId: project.id, name: "Real Battle", mode: "battle", seed: "SV-ABCD2345",
    participants: entities.map((entity) => ({ entityId: entity.id })),
    configuration: {
      general: { roundLimit: options.limit ?? 120 },
      mode: { format: options.format ?? "duel" },
    },
  });
  await markSimulationReady(ownerId, workspaceId, simulation.id);
  return { ownerId, workspaceId, strength, entities, project, simulation };
}

async function events(ownerId: string, workspaceId: string, runId: string) {
  const result = [];
  let after = 0;
  for (;;) {
    const page = await listSimulationRunEvents(ownerId, workspaceId, runId, after, 100);
    result.push(...page.items);
    if (!page.hasMore) return result;
    after = page.nextAfterSequence;
  }
}

describe("Battle production run service", () => {
  it("freezes versioned Entity visual identity while older snapshot fields remain optional", async () => {
    const { ownerId, workspaceId, entities, simulation } = await scenario();
    await upsertEntityVisualProfile(ownerId, workspaceId, entities[0]!.id, {
      ...DEFAULT_VISUAL_PROFILE,
      sourceType: "MODEL_3D",
      modelUrl: "/models/simverse-sentinel.gltf",
      archetype: "QUADRUPED",
      animationProfile: { IDLE: "idle", ATTACK_PRIMARY: "attack_1" },
    });
    const run = await createSimulationRun(ownerId, workspaceId, simulation.id);
    expect(run.participants[0]?.visualProfileVersion).toBe(1);
    expect(run.participants[0]?.visualProfile).toMatchObject({
      modelUrl: "/models/simverse-sentinel.gltf", archetype: "QUADRUPED", profileRevision: 1,
    });
    await upsertEntityVisualProfile(ownerId, workspaceId, entities[0]!.id, {
      ...DEFAULT_VISUAL_PROFILE,
      sourceType: "MODEL_3D",
      modelUrl: "/models/replacement.glb",
      archetype: "ROBOT",
      animationProfile: {},
    });
    const historical = await getSimulationRun(ownerId, workspaceId, run.id);
    expect(historical.participants[0]?.visualProfile).toMatchObject({
      modelUrl: "/models/simverse-sentinel.gltf", archetype: "QUADRUPED", profileRevision: 1,
    });
  });

  it("creates and completes a real duel with frozen stats, persisted actions/events/result and audit", async () => {
    const { ownerId, workspaceId, strength, entities, project, simulation } = await scenario();
    const run = await createSimulationRun(ownerId, workspaceId, simulation.id);
    expect(run.moduleId).toBe("battle");
    expect(run.moduleVersion).toBe("battle-v1");
    expect(run.participants[0]?.attributes[0]).toMatchObject({ key: "strength", value: "100" });
    await updateEntity(ownerId, workspaceId, entities[0]!.id, {
      attributes: [{ attributeDefinitionId: strength.id, value: 1 }],
    });
    await deleteEntity(ownerId, workspaceId, entities[0]!.id);
    await startSimulationRun(ownerId, workspaceId, run.id);
    const finished = await executeUntilComplete(ownerId, workspaceId, run.id, 160);
    expect(finished.status).toBe("COMPLETED");
    expect(finished.currentTick).toBeGreaterThan(1);
    expect(finished.participants[0]?.attributes[0]?.value).toBe("100");
    const result = battleResultSchema.parse(finished.result?.modulePayload);
    expect(result.participantMetrics[0]?.profile.strength).toBe(100);
    expect(result.ranking).toHaveLength(2);
    expect(finished.actionCount).toBe(finished.currentTick);
    const history = await events(ownerId, workspaceId, run.id);
    expect(history.at(-1)?.type).toBe("battle.completed");
    expect(history.some((event) => event.type === "battle.damage")).toBe(true);
    expect(history.every((event, index) => event.sequence === index + 1)).toBe(true);
    expect((await listSimulationRunActions(ownerId, workspaceId, run.id)).items[0]?.type).toMatch(/^battle\./);
    const audit = (await prisma.auditLog.findMany({ where: { entityId: run.id } })).map((row) => row.action);
    expect(audit).toEqual(expect.arrayContaining(["simulation_run.created", "simulation_run.started", "simulation_run.completed"]));
    await expect(deleteSimulation(ownerId, workspaceId, simulation.id)).rejects.toThrow();
    await expect(deleteProject(ownerId, workspaceId, project.id)).rejects.toThrow();
  }, 30_000);

  it("executes mixed-category free-for-all and never acts after elimination", async () => {
    const { ownerId, workspaceId, simulation } = await scenario({ format: "free_for_all", count: 3,
      categories: ["country", "robot", "fantasy_character"] });
    const run = await createSimulationRun(ownerId, workspaceId, simulation.id);
    await startSimulationRun(ownerId, workspaceId, run.id);
    const finished = await executeUntilComplete(ownerId, workspaceId, run.id, 160);
    expect(finished.status).toBe("COMPLETED");
    const result = battleResultSchema.parse(finished.result?.modulePayload);
    expect(result.format).toBe("free_for_all");
    expect(result.ranking).toHaveLength(3);
    const history = await events(ownerId, workspaceId, run.id);
    const elimination = history.find((event) => event.type === "battle.eliminated");
    expect(elimination).toBeDefined();
    const actions = (await listSimulationRunActions(ownerId, workspaceId, run.id, 0, 100)).items;
    expect(actions.filter((action) => action.tick > elimination!.tick).every(
      (action) => action.actorRunParticipantId !== elimination!.targetRunParticipantId,
    )).toBe(true);
  }, 30_000);

  it("rejects team execution and malformed duel cardinality without creating a run", async () => {
    const team = await scenario({ format: "team" });
    await expect(createSimulationRun(team.ownerId, team.workspaceId, team.simulation.id))
      .rejects.toThrow("Team Battle execution is not supported yet.");
    expect(await prisma.simulationRun.count({ where: { workspaceId: team.workspaceId } })).toBe(0);
    const duel = await scenario({ format: "duel", count: 3 });
    await expect(createSimulationRun(duel.ownerId, duel.workspaceId, duel.simulation.id))
      .rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.simulationRun.count({ where: { workspaceId: duel.workspaceId } })).toBe(0);
  });

  it("preserves exact Battle continuation through pause and resume", async () => {
    const { ownerId, workspaceId, simulation } = await scenario({ limit: 35 });
    const direct = await createSimulationRun(ownerId, workspaceId, simulation.id);
    const interrupted = await createSimulationRun(ownerId, workspaceId, simulation.id);
    await startSimulationRun(ownerId, workspaceId, direct.id);
    const completed = await executeUntilComplete(ownerId, workspaceId, direct.id, 160);
    await startSimulationRun(ownerId, workspaceId, interrupted.id);
    await advanceSimulationRun(ownerId, workspaceId, interrupted.id, 2);
    await pauseSimulationRun(ownerId, workspaceId, interrupted.id);
    await resumeSimulationRun(ownerId, workspaceId, interrupted.id);
    const resumed = await executeUntilComplete(ownerId, workspaceId, interrupted.id, 160);
    expect(resumed.status).toBe("COMPLETED");
    // Distinct persisted runs generate distinct run-participant IDs. Compare their
    // position-mapped history to isolate execution mechanics from those IDs.
    const canonical = (run: typeof resumed, value: unknown) => {
      let serialized = JSON.stringify(value);
      run.participants.forEach((participant, index) => {
        serialized = serialized.replaceAll(participant.runParticipantId, `participant-${index}`);
      });
      return JSON.parse(serialized) as unknown;
    };
    expect(canonical(resumed, resumed.result)).toEqual(canonical(completed, completed.result));
    expect(canonical(resumed, resumed.state)).toEqual(canonical(completed, completed.state));
    const comparable = async (run: typeof resumed) => (await events(ownerId, workspaceId, run.id)).map(
      ({ id: _id, ...event }) => event,
    );
    expect(canonical(resumed, await comparable(resumed))).toEqual(canonical(completed, await comparable(completed)));
  }, 30_000);

  it("enforces run permission and hides foreign workspace runs", async () => {
    const { ownerId, workspaceId, simulation } = await scenario();
    const run = await createSimulationRun(ownerId, workspaceId, simulation.id);
    const viewer = await user();
    const foreign = await user();
    await prisma.workspaceMember.create({ data: { workspaceId, userId: viewer.user.id, role: "VIEWER" } });
    expect((await getSimulationRun(viewer.user.id, workspaceId, run.id)).id).toBe(run.id);
    await expect(createSimulationRun(viewer.user.id, workspaceId, simulation.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(startSimulationRun(viewer.user.id, workspaceId, run.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getSimulationRun(foreign.user.id, foreign.workspaceId, run.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(startSimulationRun(foreign.user.id, foreign.workspaceId, run.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
