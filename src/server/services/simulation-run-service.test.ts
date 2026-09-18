import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { EngineModuleRegistry, productionEngineRegistry } from "@/lib/engine/registry";
import { registerUser } from "./auth-service";
import { createAttributeDefinition } from "./attribute-service";
import { createEntity, deleteEntity, updateEntity } from "./entity-service";
import { createProject, deleteProject } from "./project-service";
import { createSimulation, deleteSimulation, markSimulationReady } from "./simulation-service";
import {
  advanceSimulationRun, cancelSimulationRun, createSimulationRun,
  executeUntilComplete, getSimulationRun, listSimulationRunActions,
  listSimulationRunEvents, listSimulationRuns, pauseSimulationRun,
  resumeSimulationRun, startSimulationRun,
} from "./simulation-run-service";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { deterministicTestModule, deterministicTestRegistry } from "../../../test/fixtures/deterministic-engine-module";

beforeEach(async () => { await resetDb(); });

let sequence = 0;
async function makeUser() {
  sequence += 1;
  return registerUser({
    displayName: `Run User ${sequence}`,
    email: `run-${sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
}

async function makeScenario(mode = "test-sequence") {
  const { user, workspaceId } = await makeUser();
  const speed = await createAttributeDefinition(user.id, workspaceId, {
    name: "Speed", dataType: "NUMBER", minimum: 0, maximum: 100,
  });
  const first = await createEntity(user.id, workspaceId, {
    name: "Entity One", category: "object", shortName: "One", primaryColor: "#112233",
    metadata: { origin: "test" }, attributes: [{ attributeDefinitionId: speed.id, value: 72 }],
  });
  const second = await createEntity(user.id, workspaceId, { name: "Entity Two", category: "object" });
  const project = await createProject(user.id, workspaceId, { name: "Run Project" });
  const simulation = await createSimulation(user.id, workspaceId, {
    projectId: project.id, name: "Generic Run", mode, seed: "SV-ABCD2345",
    participants: [{ entityId: first.id, role: "primary", overrides: { label: "alpha" } }, { entityId: second.id }],
  });
  await markSimulationReady(user.id, workspaceId, simulation.id);
  return { user, workspaceId, speed, first, second, project, simulation };
}

async function makeRun() {
  const scenario = await makeScenario();
  const run = await createSimulationRun(scenario.user.id, scenario.workspaceId, scenario.simulation.id, deterministicTestRegistry);
  return { ...scenario, run };
}

describe("SimulationRun snapshots and source safety", () => {
  it("atomically snapshots ordered participants, attributes, config, seed and versions", async () => {
    const { user, workspaceId, simulation, first, run } = await makeRun();
    expect(run.status).toBe("CREATED");
    expect(run.simulationId).toBe(simulation.id);
    expect(run.coreEngineVersion).toBe("core-v0.1");
    expect(run.rngAlgorithmVersion).toBe("mulberry32-v1");
    expect(run.moduleId).toBe("test-sequence");
    expect(run.moduleVersion).toBe("1");
    expect(run.inputSnapshotVersion).toBe(1);
    expect(run.stateVersion).toBe(1);
    expect(run.resolvedSeed).toBe("SV-ABCD2345");
    expect(run.inputSnapshot.simulationName).toBe("Generic Run");
    expect(run.inputSnapshot.configVersion).toBe(1);
    expect(run.participants).toHaveLength(2);
    expect(run.participants.map((participant) => participant.position)).toEqual([0, 1]);
    expect(run.participants[0]?.sourceEntityId).toBe(first.id);
    expect(run.participants[0]?.role).toBe("primary");
    expect(run.participants[0]?.overrides).toEqual({ label: "alpha" });
    expect(run.participants[0]?.attributes[0]).toMatchObject({ key: "speed", value: "72", minimum: 0, maximum: 100 });
    expect(run.participants[0]?.metadata).toEqual({ origin: "test" });
    expect((await listSimulationRuns(user.id, workspaceId, simulation.id)).items[0]?.id).toBe(run.id);
    const stored = await prisma.simulationRun.findUniqueOrThrow({ where: { id: run.id }, include: { participants: true } });
    expect(stored.participants).toHaveLength(2);
    expect(stored.configurationSnapshot).toBeTruthy();
    expect(stored.presentationSnapshot).toBeTruthy();
  });

  it("retains historical Entity values and execution after live edits and deletion", async () => {
    const { user, workspaceId, first, speed, run } = await makeRun();
    await updateEntity(user.id, workspaceId, first.id, {
      attributes: [{ attributeDefinitionId: speed.id, value: 95 }],
    });
    expect((await getSimulationRun(user.id, workspaceId, run.id)).participants[0]?.attributes[0]?.value).toBe("72");
    await deleteEntity(user.id, workspaceId, first.id);
    await startSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry);
    const completed = await executeUntilComplete(user.id, workspaceId, run.id, 10, deterministicTestRegistry);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.participants[0]?.attributes[0]?.value).toBe("72");
    expect(completed.result?.resultType).toBe("test.summary");
  });

  it("blocks deletion of source Simulation and Project in services and at the FK", async () => {
    const { user, workspaceId, simulation, project, run } = await makeRun();
    await expect(deleteSimulation(user.id, workspaceId, simulation.id)).rejects.toBeInstanceOf(ConflictError);
    await expect(deleteProject(user.id, workspaceId, project.id)).rejects.toBeInstanceOf(ConflictError);
    await expect(prisma.simulation.delete({ where: { id: simulation.id } })).rejects.toThrow();
    await expect(prisma.project.delete({ where: { id: project.id } })).rejects.toThrow();
    expect((await getSimulationRun(user.id, workspaceId, run.id)).id).toBe(run.id);
  });

  it("rejects unavailable production modes with no Run or participant row created", async () => {
    const { user, workspaceId, simulation } = await makeScenario("race");
    expect(productionEngineRegistry.canExecute("battle")).toBe(true);
    expect(productionEngineRegistry.canExecute("race")).toBe(false);
    expect(productionEngineRegistry.canExecute("test-sequence")).toBe(false);
    await expect(createSimulationRun(user.id, workspaceId, simulation.id)).rejects.toThrow(
      "Execution module for mode 'race' is not available yet.",
    );
    expect(await prisma.simulationRun.count()).toBe(0);
    expect(await prisma.simulationRunParticipant.count()).toBe(0);
  });
});

describe("SimulationRun lifecycle and deterministic persistence", () => {
  it("enforces legal transitions, pauses without advancing time, and rejects illegal transitions", async () => {
    const { user, workspaceId, run } = await makeRun();
    await expect(pauseSimulationRun(user.id, workspaceId, run.id)).rejects.toBeInstanceOf(ConflictError);
    await startSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry);
    await expect(startSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry)).rejects.toBeInstanceOf(ConflictError);
    const oneTick = await advanceSimulationRun(user.id, workspaceId, run.id, 1, deterministicTestRegistry);
    expect(oneTick.currentTick).toBe(1);
    expect(oneTick.elapsedSimulationMs).toBe(100);
    const paused = await pauseSimulationRun(user.id, workspaceId, run.id);
    expect(paused.status).toBe("PAUSED");
    await expect(advanceSimulationRun(user.id, workspaceId, run.id, 1, deterministicTestRegistry)).rejects.toBeInstanceOf(ConflictError);
    expect((await getSimulationRun(user.id, workspaceId, run.id)).elapsedSimulationMs).toBe(100);
    await resumeSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry);
    await expect(resumeSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry)).rejects.toBeInstanceOf(ConflictError);
    const complete = await executeUntilComplete(user.id, workspaceId, run.id, 10, deterministicTestRegistry);
    expect(complete.status).toBe("COMPLETED");
    expect(complete.currentTick).toBe(3);
    expect(complete.elapsedSimulationMs).toBe(300);
    await expect(startSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry)).rejects.toBeInstanceOf(ConflictError);
    await expect(cancelSimulationRun(user.id, workspaceId, run.id)).rejects.toBeInstanceOf(ConflictError);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: run.id }, orderBy: { createdAt: "asc" } })).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining([
      "simulation_run.created", "simulation_run.started", "simulation_run.paused",
      "simulation_run.resumed", "simulation_run.completed",
    ]));
  });

  it("has equivalent result, state and event payloads after pause, serialization and resume", async () => {
    const { user, workspaceId, simulation, run: first } = await makeRun();
    const second = await createSimulationRun(user.id, workspaceId, simulation.id, deterministicTestRegistry);
    await startSimulationRun(user.id, workspaceId, first.id, deterministicTestRegistry);
    const continuous = await executeUntilComplete(user.id, workspaceId, first.id, 10, deterministicTestRegistry);
    await startSimulationRun(user.id, workspaceId, second.id, deterministicTestRegistry);
    await advanceSimulationRun(user.id, workspaceId, second.id, 1, deterministicTestRegistry);
    await pauseSimulationRun(user.id, workspaceId, second.id);
    const pausedState = (await prisma.simulationRun.findUniqueOrThrow({ where: { id: second.id } })).state;
    expect(JSON.parse(pausedState)).toMatchObject({ tick: 1, elapsedSimulationMs: 100 });
    await resumeSimulationRun(user.id, workspaceId, second.id, deterministicTestRegistry);
    const resumed = await executeUntilComplete(user.id, workspaceId, second.id, 10, deterministicTestRegistry);
    expect(resumed.status).toBe("COMPLETED");
    expect(resumed.state.moduleState).toEqual(continuous.state.moduleState);
    expect(resumed.state.rng).toEqual(continuous.state.rng);
    expect(resumed.result).toEqual(continuous.result);
    const normalizeEvents = async (runId: string) =>
      (await listSimulationRunEvents(user.id, workspaceId, runId)).items.map(
        ({ sequence, tick, simulatedTimeMs, type, payload }) => ({ sequence, tick, simulatedTimeMs, type, payload }),
      );
    expect(await normalizeEvents(second.id)).toEqual(await normalizeEvents(first.id));
  });

  it("stores monotonic actions/events with stable participant references and cursor pagination", async () => {
    const { user, workspaceId, run } = await makeRun();
    await startSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry);
    await executeUntilComplete(user.id, workspaceId, run.id, 10, deterministicTestRegistry);
    const firstPage = await listSimulationRunEvents(user.id, workspaceId, run.id, 0, 1);
    expect(firstPage.items.map((event) => event.sequence)).toEqual([1]);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.items[0]?.actorRunParticipantId).toBe(run.participants[0]?.runParticipantId);
    expect(firstPage.items[0]?.simulatedTimeMs).toBe(100);
    const later = await listSimulationRunEvents(user.id, workspaceId, run.id, firstPage.nextAfterSequence, 2);
    expect(later.items.map((event) => event.sequence)).toEqual([2, 3]);
    expect(later.hasMore).toBe(false);
    const actions = await listSimulationRunActions(user.id, workspaceId, run.id, 0, 2);
    expect(actions.items.map((action) => action.sequence)).toEqual([1, 2]);
    expect(actions.hasMore).toBe(true);
  });

  it("retains prior state/events and a safe failure when a module throws", async () => {
    const registry = new EngineModuleRegistry([{
      ...deterministicTestModule,
      planActions(context, state) {
        if (context.tick === 2) throw new Error("private module stack detail");
        return deterministicTestModule.planActions(context, state);
      },
    }]);
    const { user, workspaceId, simulation } = await makeScenario();
    const run = await createSimulationRun(user.id, workspaceId, simulation.id, registry);
    await startSimulationRun(user.id, workspaceId, run.id, registry);
    await advanceSimulationRun(user.id, workspaceId, run.id, 1, registry);
    const failed = await advanceSimulationRun(user.id, workspaceId, run.id, 1, registry);
    expect(failed.status).toBe("FAILED");
    expect(failed.currentTick).toBe(1);
    expect(failed.eventCount).toBe(1);
    expect(failed.failureCode).toBe("MODULE_EXECUTION_FAILED");
    expect(failed.failureMessage).not.toContain("private module stack detail");
    expect((await listSimulationRunEvents(user.id, workspaceId, run.id)).items).toHaveLength(1);
    await expect(resumeSimulationRun(user.id, workspaceId, run.id, registry)).rejects.toBeInstanceOf(ConflictError);
  });

  it("fails safely and atomically when module output exceeds the persisted payload limit", async () => {
    const oversizedPayloadSchema = z.object({ sample: z.number().int(), padding: z.string() }).strict();
    const registry = new EngineModuleRegistry([{
      ...deterministicTestModule,
      actionPayloads: { "test.sample": { version: 1, schema: oversizedPayloadSchema } },
      planActions(context) {
        return [{ type: "test.sample", payloadVersion: 1,
          payload: { sample: context.rng.nextUint32(), padding: "x".repeat(100_000) } }];
      },
      evaluateRules(context, state, action) {
        const { sample } = oversizedPayloadSchema.parse(action.payload);
        return deterministicTestModule.evaluateRules(context, state, { ...action, payload: { sample } });
      },
    }]);
    const { user, workspaceId, simulation } = await makeScenario();
    const run = await createSimulationRun(user.id, workspaceId, simulation.id, registry);
    await startSimulationRun(user.id, workspaceId, run.id, registry);
    const failed = await advanceSimulationRun(user.id, workspaceId, run.id, 1, registry);
    expect(failed.status).toBe("FAILED");
    expect(failed.failureCode).toBe("INVALID_MODULE_OUTPUT");
    expect(failed.currentTick).toBe(0);
    expect(failed.actionCount).toBe(0);
    expect(failed.eventCount).toBe(0);
  });

  it("rejects two simultaneous starts and permits cancellation from nonterminal states", async () => {
    const { user, workspaceId, run } = await makeRun();
    const starts = await Promise.allSettled([
      startSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry),
      startSimulationRun(user.id, workspaceId, run.id, deterministicTestRegistry),
    ]);
    expect(starts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(starts.filter((result) => result.status === "rejected")).toHaveLength(1);
    const cancelled = await cancelSimulationRun(user.id, workspaceId, run.id);
    expect(cancelled.status).toBe("CANCELLED");
    await expect(pauseSimulationRun(user.id, workspaceId, run.id)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("SimulationRun authorization", () => {
  it("enforces simulation.run for mutation while allowing permitted run views", async () => {
    const { user, workspaceId, simulation, run } = await makeRun();
    const viewer = await makeUser();
    const operator = await makeUser();
    await prisma.workspaceMember.createMany({ data: [
      { workspaceId, userId: viewer.user.id, role: "VIEWER" },
      { workspaceId, userId: operator.user.id, role: "OPERATOR" },
    ] });
    expect((await getSimulationRun(viewer.user.id, workspaceId, run.id)).id).toBe(run.id);
    await expect(createSimulationRun(viewer.user.id, workspaceId, simulation.id, deterministicTestRegistry))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(startSimulationRun(viewer.user.id, workspaceId, run.id, deterministicTestRegistry))
      .rejects.toBeInstanceOf(AuthorizationError);
    const operatorRun = await createSimulationRun(operator.user.id, workspaceId, simulation.id, deterministicTestRegistry);
    expect(operatorRun.id).toBeTruthy();
    await startSimulationRun(operator.user.id, workspaceId, operatorRun.id, deterministicTestRegistry);
    expect((await getSimulationRun(user.id, workspaceId, operatorRun.id)).status).toBe("RUNNING");
  });

  it("hides foreign workspace runs across read and every lifecycle operation", async () => {
    const { user, workspaceId, run } = await makeRun();
    const foreign = await makeUser();
    const foreignId = foreign.user.id;
    const foreignWorkspace = foreign.workspaceId;
    await expect(getSimulationRun(foreignId, foreignWorkspace, run.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listSimulationRunEvents(foreignId, foreignWorkspace, run.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(startSimulationRun(foreignId, foreignWorkspace, run.id, deterministicTestRegistry)).rejects.toBeInstanceOf(NotFoundError);
    await expect(pauseSimulationRun(foreignId, foreignWorkspace, run.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(resumeSimulationRun(foreignId, foreignWorkspace, run.id, deterministicTestRegistry)).rejects.toBeInstanceOf(NotFoundError);
    await expect(cancelSimulationRun(foreignId, foreignWorkspace, run.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(advanceSimulationRun(foreignId, foreignWorkspace, run.id, 1, deterministicTestRegistry)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getSimulationRun(user.id, workspaceId, run.id)).status).toBe("CREATED");
  });
});
