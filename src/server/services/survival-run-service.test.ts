import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { EXPERIENCE_PRESETS } from "@/lib/experiences/presets";
import { survivalResultSchema } from "@/lib/modules/survival/schemas";
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
  return registerUser({
    displayName: `Survival User ${sequence}`,
    email: `survival-${sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
}

async function scenario(options: {
  count?: number; bindings?: boolean; mode?: "LAST_STANDING" | "ENDURANCE";
  variability?: number; hazardFrequency?: number;
} = {}) {
  const owner = await account();
  const project = await createProject(owner.user.id, owner.workspaceId, { name: "Survival Project" });
  const stats = await Promise.all([
    "Endurance", "Resilience", "Resource Efficiency", "Adaptability", "Awareness", "Luck",
  ].map((name) => createAttributeDefinition(owner.user.id, owner.workspaceId, {
    name, dataType: "NUMBER", minimum: 0, maximum: 100,
  })));
  const entities = [];
  for (let index = 0; index < (options.count ?? 2); index += 1) {
    entities.push(await createEntity(owner.user.id, owner.workspaceId, {
      name: `Survivor ${index + 1}`, category: index % 2 ? "robot" : "creature",
      attributes: stats.map((definition, statIndex) => ({
        attributeDefinitionId: definition.id,
        value: statIndex === 0 ? (index === 0 ? 95 : 20 + index) : 50,
      })),
    }));
  }
  let worldId: string | undefined;
  let experienceProfileId: string | undefined;
  if (options.bindings) {
    const worldPreset = WORLD_PRESETS[0]!;
    const world = await createWorld(owner.user.id, owner.workspaceId, {
      name: "Survival Environment", description: "Presentation-only environment.",
      category: worldPreset.category, status: "DRAFT", tags: worldPreset.tags,
      biome: worldPreset.biome, visibility: "WORKSPACE", blueprint: structuredClone(worldPreset.blueprint),
      assetAssociations: [], entityAssociations: [], changeNote: "Initial",
    });
    const preset = EXPERIENCE_PRESETS.find((item) => item.id === "simverse-cinematic-survival-v1")!;
    const experience = await createExperienceProfile(owner.user.id, owner.workspaceId, {
      name: "Survival Direction", description: "Survival presentation only.", status: "DRAFT",
      tags: preset.tags, definition: structuredClone(preset.definition), changeNote: "Initial",
    });
    worldId = world.id;
    experienceProfileId = experience.id;
  }
  const simulation = await createSimulation(owner.user.id, owner.workspaceId, {
    projectId: project.id, name: "Authoritative Survival", mode: "survival", seed: "SV-SURV0001",
    participants: entities.map((entity) => ({ entityId: entity.id })),
    configuration: { mode: {
      version: 1,
      mode: options.mode ?? "LAST_STANDING",
      maxTicks: 30,
      baseConditionDrain: 10_000,
      hazardFrequency: options.hazardFrequency ?? 0,
      hazardIntensity: options.hazardFrequency ? 35 : 0,
      variability: options.variability ?? 0,
      eliminationThreshold: 0,
      resources: {
        initialEnergy: 100_000, initialSupplies: 100_000,
        baseEnergyDrain: 300, baseSuppliesDrain: 160, depletionConditionPenalty: 500,
      },
      recovery: { amount: 0, intervalTicks: 10, energyCost: 0, suppliesCost: 0 },
      statMapping: {
        endurance: "endurance", resilience: "resilience", resourceEfficiency: "resource_efficiency",
        adaptability: "adaptability", awareness: "awareness", luck: "luck",
      },
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

describe("Survival production Run integration", () => {
  it("creates and completes Survival using frozen participant stats and immutable optional bindings", async () => {
    const source = await scenario({ count: 4, bindings: true });
    const run = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    expect(run).toMatchObject({ moduleId: "survival", moduleVersion: "survival-v1", status: "CREATED" });
    expect(run.inputSnapshot.participants[0]?.attributes.find((attribute) => attribute.key === "endurance")?.value).toBe("95");
    expect(run.inputSnapshot.world).toMatchObject({ worldId: source.worldId, version: 1 });
    expect(run.inputSnapshot.experienceProfile).toMatchObject({ experienceProfileId: source.experienceProfileId, version: 1 });
    expect(run.inputSnapshot.experienceProfile?.definition.simulationModeCompatibility).toContain("survival");
    const frozenInput = JSON.stringify(run.inputSnapshot);
    await updateEntity(source.owner.user.id, source.owner.workspaceId, source.entities[0]!.id, {
      attributes: source.stats.map((definition) => ({ attributeDefinitionId: definition.id, value: 0 })),
    });
    await prisma.simulation.update({
      where: { id: source.simulation.id },
      data: { worldId: null, worldVersion: null, experienceProfileId: null, experienceProfileVersion: null },
    });
    await startSimulationRun(source.owner.user.id, source.owner.workspaceId, run.id);
    const completed = await executeUntilComplete(source.owner.user.id, source.owner.workspaceId, run.id);
    expect(completed.status).toBe("COMPLETED");
    expect(JSON.stringify(completed.inputSnapshot)).toBe(frozenInput);
    const result = survivalResultSchema.parse(completed.result?.modulePayload);
    expect(result.participants.find((entry) => entry.runParticipantId === completed.participants[0]!.runParticipantId)?.profile.endurance).toBe(95);
    const events = await allEvents(source.owner.user.id, source.owner.workspaceId, run.id);
    expect(events[0]?.type).toBe("survival.started");
    expect(events.at(-1)?.type).toBe("survival.completed");
    expect(events.filter((event) => event.type === "survival.completed")).toHaveLength(1);
    expect(events.every((event, index) => event.sequence === index + 1)).toBe(true);
  }, 30_000);

  it("preserves state, RNG, hazards, events and result across pause and resume", async () => {
    const source = await scenario({ count: 4, mode: "ENDURANCE", variability: 80, hazardFrequency: 75 });
    const direct = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    const interrupted = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    await startSimulationRun(source.owner.user.id, source.owner.workspaceId, direct.id);
    const completed = await executeUntilComplete(source.owner.user.id, source.owner.workspaceId, direct.id);
    await startSimulationRun(source.owner.user.id, source.owner.workspaceId, interrupted.id);
    await advanceSimulationRun(source.owner.user.id, source.owner.workspaceId, interrupted.id, 7);
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

  it("enforces workspace boundaries and Survival Experience compatibility", async () => {
    const source = await scenario();
    const foreign = await scenario({ bindings: true });
    const battlePreset = EXPERIENCE_PRESETS.find((item) => item.id === "simverse-cinematic-battle-v1")!;
    const incompatible = await createExperienceProfile(source.owner.user.id, source.owner.workspaceId, {
      name: "Battle-only Direction", status: "DRAFT", tags: battlePreset.tags,
      definition: structuredClone(battlePreset.definition), changeNote: "Initial",
    });
    await expect(createSimulation(source.owner.user.id, source.owner.workspaceId, {
      projectId: source.project.id, name: "Foreign Survivor", mode: "survival",
      participants: [{ entityId: source.entities[0]!.id }, { entityId: foreign.entities[0]!.id }],
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(createSimulation(source.owner.user.id, source.owner.workspaceId, {
      projectId: source.project.id, name: "Incompatible Direction", mode: "survival",
      participants: source.entities.map((entity) => ({ entityId: entity.id })),
      experienceProfileId: incompatible.id, experienceProfileVersion: 1,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(createSimulation(source.owner.user.id, source.owner.workspaceId, {
      projectId: source.project.id, name: "Foreign Direction", mode: "survival",
      participants: source.entities.map((entity) => ({ entityId: entity.id })),
      experienceProfileId: foreign.experienceProfileId, experienceProfileVersion: 1,
    })).rejects.toBeInstanceOf(ValidationError);
    const run = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
    await expect(getSimulationRun(foreign.owner.user.id, foreign.owner.workspaceId, run.id))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps validated two-participant Survival results into existing Round Robin scoring", async () => {
    const source = await scenario({ count: 2 });
    const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, {
      name: "Survival League", projectId: source.project.id, simulationTemplateId: source.simulation.id,
      format: "ROUND_ROBIN", participants: source.entities.map((entity, index) => ({ entityId: entity.id, seed: index + 1 })),
      seedingMethod: "MANUAL", randomSeed: "SV-SURVTOUR", tiePolicy: "NO_TIES_ALLOWED",
      winPoints: 3, tiePoints: 1, lossPoints: 0, tiebreakers: ["POINTS", "WINS", "HEAD_TO_HEAD"],
    });
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id);
    await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id);
    const completed = await runTournamentMatch(source.owner.user.id, source.owner.workspaceId, tournament.id, structured.matches[0]!.id);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.matches[0]?.result).toMatchObject({ sourceModule: "survival", sourceModuleVersion: "survival-v1" });
    expect(completed.standings.map((standing) => standing.played)).toEqual([1, 1]);
  }, 30_000);
});
