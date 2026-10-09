import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { EXPERIENCE_PRESETS } from "@/lib/experiences/presets";
import { raceResultSchema } from "@/lib/modules/race/schemas";
import { WORLD_PRESETS } from "@/lib/worlds/presets";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAttributeDefinition } from "./attribute-service";
import { createEntity, updateEntity } from "./entity-service";
import { createExperienceProfile } from "./experience-profile-service";
import { createProject } from "./project-service";
import {
  advanceSimulationRun, createSimulationRun, executeUntilComplete, getSimulationRun,
  listSimulationRunEvents, pauseSimulationRun, resumeSimulationRun, startSimulationRun,
} from "./simulation-run-service";
import { createSimulation, markSimulationReady } from "./simulation-service";
import {
  createTournament, generateTournamentStructure, markTournamentReady,
  runTournamentMatch, startTournament,
} from "./tournament-service";
import { createWorld } from "./world-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function account() {
  sequence += 1;
  return registerUser({ displayName: `Race User ${sequence}`, email: `race-${sequence}-${Date.now()}@example.com`, password: "Password123", confirmPassword: "Password123" });
}

async function scenario(options: { count?: number; variability?: number; distance?: number; maxTicks?: number; bindings?: boolean } = {}) {
  const owner = await account();
  const project = await createProject(owner.user.id, owner.workspaceId, { name: "Race Project" });
  const stats = await Promise.all(["Speed", "Acceleration", "Handling", "Stamina", "Luck"].map((name) =>
    createAttributeDefinition(owner.user.id, owner.workspaceId, { name, dataType: "NUMBER", minimum: 0, maximum: 100 })));
  const entities = [];
  for (let index = 0; index < (options.count ?? 2); index += 1) {
    entities.push(await createEntity(owner.user.id, owner.workspaceId, {
      name: `Racer ${index + 1}`, category: index % 2 ? "creature" : "vehicle",
      attributes: stats.map((definition, statIndex) => ({
        attributeDefinitionId: definition.id,
        value: statIndex === 0 ? (index === 0 ? 95 : 20 + index) : 50,
      })),
    }));
  }
  let worldId: string | undefined;
  let experienceProfileId: string | undefined;
  if (options.bindings) {
    const worldPreset = WORLD_PRESETS[1]!;
    const world = await createWorld(owner.user.id, owner.workspaceId, {
      name: "Race Environment", description: "Presentation-only environment.", category: worldPreset.category,
      status: "DRAFT", tags: worldPreset.tags, biome: worldPreset.biome, visibility: "WORKSPACE",
      blueprint: structuredClone(worldPreset.blueprint), assetAssociations: [], entityAssociations: [], changeNote: "Initial",
    });
    const racePreset = EXPERIENCE_PRESETS.find((preset) => preset.id === "simverse-cinematic-race-v1")!;
    const experience = await createExperienceProfile(owner.user.id, owner.workspaceId, {
      name: "Race Direction", description: "Race presentation only.", status: "DRAFT", tags: racePreset.tags,
      definition: structuredClone(racePreset.definition), changeNote: "Initial",
    });
    worldId = world.id;
    experienceProfileId = experience.id;
  }
  const simulation = await createSimulation(owner.user.id, owner.workspaceId, {
    projectId: project.id, name: "Authoritative Race", mode: "race", seed: "SV-RACE0001",
    participants: entities.map((entity) => ({ entityId: entity.id })),
    configuration: { mode: {
      version: 1, mode: "SPRINT", distance: options.distance ?? 200, distanceUnit: "METER", laps: 1,
      maxTicks: options.maxTicks ?? 500, variability: options.variability ?? 20, checkpoints: [25, 50, 75],
      statMapping: { speed: "speed", acceleration: "acceleration", handling: "handling", stamina: "stamina", luck: "luck" },
    } },
    worldId: worldId ?? null, worldVersion: worldId ? 1 : null,
    experienceProfileId: experienceProfileId ?? null, experienceProfileVersion: experienceProfileId ? 1 : null,
  });
  await markSimulationReady(owner.user.id, owner.workspaceId, simulation.id);
  return { owner, project, stats, entities, simulation, worldId, experienceProfileId };
}

async function allEvents(userId: string, workspaceId: string, runId: string) {
  const result = [];
  let after = 0;
  for (;;) {
    const page = await listSimulationRunEvents(userId, workspaceId, runId, after, 100);
    result.push(...page.items);
    if (!page.hasMore) return result;
    after = page.nextAfterSequence;
  }
}

function canonical(run: Awaited<ReturnType<typeof getSimulationRun>>, value: unknown) {
  let serialized = JSON.stringify(value);
  run.participants.forEach((participant, index) => {
    serialized = serialized.replaceAll(participant.runParticipantId, `participant-${index}`);
  });
  return JSON.parse(serialized) as unknown;
}

describe("Race production Run integration", () => {
  it("creates and completes a Race through normal Core persistence using only frozen participant stats", async () => {
    const source = await scenario({ count: 4 });
    const run = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    expect(run).toMatchObject({ moduleId: "race", moduleVersion: "race-v1", status: "CREATED" });
    expect(run.inputSnapshot.participants[0]?.attributes.find((attribute) => attribute.key === "speed")?.value).toBe("95");
    await updateEntity(source.owner.user.id, source.owner.workspaceId, source.entities[0]!.id, {
      attributes: source.stats.map((definition) => ({ attributeDefinitionId: definition.id, value: 0 })),
    });
    await startSimulationRun(source.owner.user.id, source.owner.workspaceId, run.id);
    const completed = await executeUntilComplete(source.owner.user.id, source.owner.workspaceId, run.id);
    expect(completed.status).toBe("COMPLETED");
    const result = raceResultSchema.parse(completed.result?.modulePayload);
    expect(result.participants.find((participant) => participant.runParticipantId === completed.participants[0]!.runParticipantId)?.profile.speed).toBe(95);
    const events = await allEvents(source.owner.user.id, source.owner.workspaceId, run.id);
    expect(events[0]?.type).toBe("race.started");
    expect(events.at(-1)?.type).toBe("race.completed");
    expect(events.some((event) => event.type === "race.checkpoint")).toBe(true);
    expect(events.every((event, index) => event.sequence === index + 1)).toBe(true);
  }, 30_000);

  it("preserves exact state, RNG, events and result across pause and resume", async () => {
    const source = await scenario({ count: 4, distance: 350, variability: 80 });
    const direct = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    const interrupted = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    await startSimulationRun(source.owner.user.id, source.owner.workspaceId, direct.id);
    const completed = await executeUntilComplete(source.owner.user.id, source.owner.workspaceId, direct.id);
    await startSimulationRun(source.owner.user.id, source.owner.workspaceId, interrupted.id);
    await advanceSimulationRun(source.owner.user.id, source.owner.workspaceId, interrupted.id, 3);
    await pauseSimulationRun(source.owner.user.id, source.owner.workspaceId, interrupted.id);
    await resumeSimulationRun(source.owner.user.id, source.owner.workspaceId, interrupted.id);
    const resumed = await executeUntilComplete(source.owner.user.id, source.owner.workspaceId, interrupted.id);
    expect(resumed.status).toBe("COMPLETED");
    expect(canonical(resumed, resumed.state)).toEqual(canonical(completed, completed.state));
    expect(canonical(resumed, resumed.result)).toEqual(canonical(completed, completed.result));
    const comparable = async (runId: string) => (await allEvents(source.owner.user.id, source.owner.workspaceId, runId))
      .map(({ id: _id, ...event }) => event);
    expect(canonical(resumed, await comparable(resumed.id)))
      .toEqual(canonical(completed, await comparable(completed.id)));
  }, 30_000);

  it("freezes optional World and Race Experience Profile versions without letting them affect mechanics", async () => {
    const source = await scenario({ bindings: true, variability: 0 });
    const run = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    expect(run.inputSnapshot.world).toMatchObject({ worldId: source.worldId, version: 1 });
    expect(run.inputSnapshot.experienceProfile).toMatchObject({ experienceProfileId: source.experienceProfileId, version: 1 });
    expect(run.inputSnapshot.experienceProfile?.definition.simulationModeCompatibility).toContain("race");
    const storedBefore = JSON.stringify(run.inputSnapshot);
    await prisma.simulation.update({ where: { id: source.simulation.id }, data: { worldId: null, worldVersion: null, experienceProfileId: null, experienceProfileVersion: null } });
    expect(JSON.stringify((await getSimulationRun(source.owner.user.id, source.owner.workspaceId, run.id)).inputSnapshot)).toBe(storedBefore);
  });

  it("rejects foreign participant and Experience references through existing workspace boundaries", async () => {
    const source = await scenario();
    const foreign = await scenario({ bindings: true });
    await expect(createSimulation(source.owner.user.id, source.owner.workspaceId, {
      projectId: source.project.id, name: "Foreign Racer", mode: "race",
      participants: [{ entityId: source.entities[0]!.id }, { entityId: foreign.entities[0]!.id }],
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(createSimulation(source.owner.user.id, source.owner.workspaceId, {
      projectId: source.project.id, name: "Foreign Direction", mode: "race",
      participants: source.entities.map((entity) => ({ entityId: entity.id })),
      experienceProfileId: foreign.experienceProfileId, experienceProfileVersion: 1,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(getSimulationRun(foreign.owner.user.id, foreign.owner.workspaceId,
      (await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id)).id))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("runs two-participant Race matches through existing Round Robin scoring without recalculation", async () => {
    const source = await scenario({ count: 2, variability: 0, distance: 100 });
    const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, {
      name: "Race League", projectId: source.project.id, simulationTemplateId: source.simulation.id,
      format: "ROUND_ROBIN", participants: source.entities.map((entity, index) => ({ entityId: entity.id, seed: index + 1 })),
      seedingMethod: "MANUAL", randomSeed: "SV-RACETOUR", tiePolicy: "NO_TIES_ALLOWED",
      winPoints: 3, tiePoints: 1, lossPoints: 0, tiebreakers: ["POINTS", "WINS", "HEAD_TO_HEAD"],
    });
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id);
    await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id);
    const completed = await runTournamentMatch(source.owner.user.id, source.owner.workspaceId, tournament.id, structured.matches[0]!.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.matches[0]?.result).toMatchObject({ sourceModule: "race", sourceModuleVersion: "race-v1" });
    expect(completed.standings.map((standing) => standing.played)).toEqual([1, 1]);
  }, 30_000);
});
