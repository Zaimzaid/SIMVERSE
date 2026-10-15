import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import type { WorkspaceRole } from "@/lib/permissions";
import { prisma } from "@/server/db/client";
import { registerUser } from "@/server/services/auth-service";
import { createEntity } from "@/server/services/entity-service";
import { createProject } from "@/server/services/project-service";
import { createSimulation } from "@/server/services/simulation-service";

/**
 * Shared seeding for Creator/Media tests: a real completed Battle/Race/Survival
 * Run with authoritative result + participant snapshots, built through the same
 * services the product uses.
 */

type ModuleId = "battle" | "race" | "survival";
let accountSequence = 0;
let runSequence = 0;

export async function newAccount(label = "Media User") {
  accountSequence += 1;
  return registerUser({
    displayName: `${label} ${accountSequence}`,
    email: `media-helper-${accountSequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

export async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}

function participantSnapshot(sourceEntityId: string, index: number, moduleId: string, ordinal: number): ParticipantSnapshotV1 {
  return {
    runParticipantId: `${moduleId}-p-${index + 1}-${ordinal}`,
    sourceEntityId,
    position: index,
    role: null,
    overrides: null,
    name: index === 0 ? "Historical Lion" : "Historical Falcon",
    shortName: null,
    description: null,
    category: index === 0 ? "creature" : "vehicle",
    status: "ACTIVE",
    imageUrl: null,
    primaryColor: index === 0 ? "#22D3EE" : "#8B5CF6",
    secondaryColor: null,
    metadata: null,
    tags: [],
    attributes: [],
  };
}

const battleProfile = { strength: 50, defense: 50, speed: 50, intelligence: 50, luck: 50 };
function battleMetric(id: string, position: number, winner: boolean) {
  return { runParticipantId: id, position, profile: battleProfile, health: winner ? 40 : 0, alive: winner,
    defending: false, eliminationTick: winner ? null : 4, damageDealt: winner ? 100 : 40,
    damageReceived: winner ? 40 : 100, attacksAttempted: 4, attacksLanded: 3, criticalHits: 1, dodges: 0, defends: 0 };
}

function authoritativeResult(moduleId: ModuleId, ids: string[]) {
  if (moduleId === "battle") return {
    version: 1, resultType: "battle.result", summary: "Historical Lion wins.", metrics: {}, modulePayloadVersion: 1,
    modulePayload: { version: 1, format: "duel", completionReason: "KNOCKOUT", winnerRunParticipantId: ids[0],
      tiedParticipantIds: [], ranking: ids, eliminationOrder: [ids[1]], totalTicks: 4, simulatedDurationMs: 400,
      participantMetrics: ids.map((id, index) => battleMetric(id, index, index === 0)) },
  };
  if (moduleId === "race") return {
    version: 1, resultType: "race.result", summary: "Historical Lion wins.", metrics: {}, modulePayloadVersion: 1,
    modulePayload: { version: 1, moduleId: "race", moduleVersion: "race-v1", mode: "SPRINT", distance: 100,
      distanceUnit: "METER", laps: 1, totalDistanceMilli: 100_000, completionReason: "ALL_FINISHED",
      winnerRunParticipantId: ids[0], tiedParticipantIds: [], ranking: ids.map((id, index) => ({ runParticipantId: id, rank: index + 1, tied: false })),
      participants: ids.map((id, index) => ({ runParticipantId: id, rank: index + 1, tied: false, finished: true,
        finishTimeMicros: 100_000 + index, distanceMilli: 100_000, lapsCompleted: 1,
        profile: { speed: 50, acceleration: 50, handling: 50, stamina: 50, luck: 50 } })),
      totalTicks: 5, simulatedDurationMs: 500 },
  };
  return {
    version: 1, resultType: "survival.result", summary: "Historical Lion survives.", metrics: {}, modulePayloadVersion: 1,
    modulePayload: { version: 1, moduleId: "survival", moduleVersion: "survival-v1", mode: "LAST_STANDING",
      completionReason: "LAST_STANDING", winnerRunParticipantId: ids[0], tiedParticipantIds: [],
      ranking: ids.map((id, index) => ({ runParticipantId: id, rank: index + 1, tied: false })),
      participants: ids.map((id, index) => ({ runParticipantId: id, rank: index + 1, tied: false,
        survived: index === 0, eliminationTick: index === 0 ? null : 5, eliminationTimeMs: index === 0 ? null : 500,
        eliminationCause: index === 0 ? null : "CONDITION", finalCondition: index === 0 ? 40_000 : 0,
        finalResources: { energy: 20_000, supplies: 10_000 }, survivalDurationMs: 500,
        profile: { endurance: 50, resilience: 50, resourceEfficiency: 50, adaptability: 50, awareness: 50, luck: 50 } })),
      totalTicks: 5, simulatedDurationMs: 500, hazardCount: 0 },
  };
}

export async function seedCompletedRun(owner: Awaited<ReturnType<typeof newAccount>>, moduleId: ModuleId = "battle") {
  runSequence += 1;
  const entities = await Promise.all([
    createEntity(owner.user.id, owner.workspaceId, { name: "Current Lion", category: "creature" }),
    createEntity(owner.user.id, owner.workspaceId, { name: "Current Falcon", category: "vehicle" }),
  ]);
  const project = await createProject(owner.user.id, owner.workspaceId, { name: `Export Project ${runSequence}-${moduleId}` });
  const name = `${moduleId[0]!.toUpperCase()}${moduleId.slice(1)} Export Source`;
  const simulation = await createSimulation(owner.user.id, owner.workspaceId, {
    projectId: project.id,
    name,
    mode: moduleId,
    seed: "SV-EXPORT01",
    participants: entities.map((entity) => ({ entityId: entity.id })),
  });
  const participants = entities.map((entity, index) => participantSnapshot(entity.id, index, moduleId, runSequence));
  const result = authoritativeResult(moduleId, participants.map((item) => item.runParticipantId));
  const inputSnapshot = {
    version: 1, simulationId: simulation.id, simulationName: name, mode: moduleId, configVersion: 1,
    configuration: { version: 1, general: { speed: "normal", roundLimit: null, randomEvents: true, allowTies: true, difficulty: "normal" }, mode: {} },
    presentation: { displayTitle: null, themeColor: null, showLabels: true, showLeaderboard: true },
    resolvedSeed: "SV-EXPORT01", participants, world: null, experienceProfile: null,
  };
  const run = await prisma.simulationRun.create({
    data: {
      workspaceId: owner.workspaceId, simulationId: simulation.id, status: "COMPLETED", mode: moduleId,
      resolvedSeed: "SV-EXPORT01", coreEngineVersion: "core-v0.1", moduleId, moduleVersion: `${moduleId}-v1`,
      rngAlgorithmVersion: "mulberry32-v1", configVersion: 1,
      configurationSnapshot: JSON.stringify(inputSnapshot.configuration),
      presentationSnapshot: JSON.stringify(inputSnapshot.presentation),
      inputSnapshotVersion: 1, inputSnapshot: JSON.stringify(inputSnapshot),
      stateVersion: 1, state: JSON.stringify({}), fixedStepMs: 100, currentTick: 5, elapsedSimulationMs: 500,
      lastEventSequence: 0, resultVersion: 1, result: JSON.stringify(result), createdById: owner.user.id,
      startedAt: new Date(), completedAt: new Date(),
      participants: { create: participants.map((participant) => ({
        id: participant.runParticipantId, sourceEntityId: participant.sourceEntityId, position: participant.position,
        role: participant.role, snapshotVersion: 1, snapshot: JSON.stringify(participant),
      })) },
    },
  });
  return { run, simulation, entities, participants };
}
