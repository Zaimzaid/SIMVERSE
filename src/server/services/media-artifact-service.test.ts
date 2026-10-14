import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import type { WorkspaceRole } from "@/lib/permissions";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createEntity, updateEntity } from "./entity-service";
import { createProject } from "./project-service";
import { createSimulation } from "./simulation-service";
import {
  archiveMediaArtifact,
  createMediaArtifactFromRun,
  createMediaArtifactVersion,
  getMediaArtifact,
  listCompletedMediaSources,
  listMediaArtifacts,
  restoreMediaArtifact,
} from "./media-artifact-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
let sourceSequence = 0;

async function account(label = "Media User") {
  sequence += 1;
  return registerUser({
    displayName: `${label} ${sequence}`,
    email: `media-${sequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}

function participantSnapshot(sourceEntityId: string, index: number, moduleId: string, sourceOrdinal: number): ParticipantSnapshotV1 {
  return {
    runParticipantId: `${moduleId}-participant-${index + 1}-${sourceOrdinal}`,
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
    damageReceived: winner ? 40 : 100, attacksAttempted: 4, attacksLanded: 3, criticalHits: 1,
    dodges: 0, defends: 0 };
}

function authoritativeResult(moduleId: "battle" | "race" | "survival", ids: string[]) {
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

async function seedRun(
  owner: Awaited<ReturnType<typeof account>>,
  moduleId: "battle" | "race" | "survival" = "battle",
  options: { status?: "RUNNING" | "COMPLETED"; storedModuleId?: string; storedModuleVersion?: string } = {},
) {
  sourceSequence += 1;
  const entities = await Promise.all([
    createEntity(owner.user.id, owner.workspaceId, { name: "Current Lion", category: "creature" }),
    createEntity(owner.user.id, owner.workspaceId, { name: "Current Falcon", category: "vehicle" }),
  ]);
  const project = await createProject(owner.user.id, owner.workspaceId, { name: `Media Project ${sourceSequence}-${moduleId}` });
  const simulation = await createSimulation(owner.user.id, owner.workspaceId, {
    projectId: project.id,
    name: `${moduleId[0]!.toUpperCase()}${moduleId.slice(1)} Story Source`,
    mode: moduleId,
    seed: "SV-MEDIA001",
    participants: entities.map((entity) => ({ entityId: entity.id })),
  });
  const participants = entities.map((entity, index) => participantSnapshot(entity.id, index, moduleId, sourceSequence));
  const status = options.status ?? "COMPLETED";
  const result = status === "COMPLETED" ? authoritativeResult(moduleId, participants.map((item) => item.runParticipantId)) : null;
  const inputSnapshot = {
    version: 1,
    simulationId: simulation.id,
    simulationName: `${moduleId[0]!.toUpperCase()}${moduleId.slice(1)} Story Source`,
    mode: moduleId,
    configVersion: 1,
    configuration: { version: 1, general: { speed: "normal", roundLimit: null, randomEvents: true, allowTies: true, difficulty: "normal" }, mode: {} },
    presentation: { displayTitle: null, themeColor: null, showLabels: true, showLeaderboard: true },
    resolvedSeed: "SV-MEDIA001",
    participants,
    world: null,
    experienceProfile: null,
  };
  const storedModuleId = options.storedModuleId ?? moduleId;
  const storedModuleVersion = options.storedModuleVersion ?? `${moduleId}-v1`;
  const run = await prisma.simulationRun.create({
    data: {
      workspaceId: owner.workspaceId,
      simulationId: simulation.id,
      status,
      mode: moduleId,
      resolvedSeed: "SV-MEDIA001",
      coreEngineVersion: "core-v0.1",
      moduleId: storedModuleId,
      moduleVersion: storedModuleVersion,
      rngAlgorithmVersion: "mulberry32-v1",
      configVersion: 1,
      configurationSnapshot: JSON.stringify(inputSnapshot.configuration),
      presentationSnapshot: JSON.stringify(inputSnapshot.presentation),
      inputSnapshotVersion: 1,
      inputSnapshot: JSON.stringify(inputSnapshot),
      stateVersion: 1,
      state: JSON.stringify({}),
      fixedStepMs: 100,
      currentTick: 5,
      elapsedSimulationMs: 500,
      lastEventSequence: 0,
      resultVersion: 1,
      result: result ? JSON.stringify(result) : null,
      createdById: owner.user.id,
      startedAt: new Date(),
      completedAt: status === "COMPLETED" ? new Date() : null,
      participants: { create: participants.map((participant) => ({
        id: participant.runParticipantId,
        sourceEntityId: participant.sourceEntityId,
        position: participant.position,
        role: participant.role,
        snapshotVersion: 1,
        snapshot: JSON.stringify(participant),
      })) },
    },
  });
  return { run, simulation, entities, participants };
}

function editInput(artifact: Awaited<ReturnType<typeof createMediaArtifactFromRun>>, title = "Edited Story") {
  return {
    title,
    subtitle: "A creator-written subtitle",
    description: "Presentation copy only.",
    aspectRatio: "PORTRAIT_9_16",
    status: "READY",
    scenes: artifact.version.storyboard.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      caption: `${scene.caption} Edited.`,
      enabled: scene.enabled,
    })),
  };
}

describe("Creator/Media artifact creation", () => {
  it.each(["battle", "race", "survival"] as const)("creates a validated %s storyboard version 1", async (moduleId) => {
    const owner = await account();
    const source = await seedRun(owner, moduleId);
    const artifact = await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, {
      runId: source.run.id,
      aspectRatio: "LANDSCAPE_16_9",
    });
    expect(artifact).toMatchObject({ type: "STORYBOARD", status: "DRAFT", currentVersion: 1, sourceRunId: source.run.id });
    expect(artifact.version.storyboard.source).toMatchObject({ runId: source.run.id, moduleId, moduleVersion: `${moduleId}-v1` });
    expect(artifact.version.storyboard.summary.winnerParticipantRefs).toEqual([source.participants[0]!.runParticipantId]);
    expect(artifact.version.storyboard.scenes.some((scene) => scene.kind === "RESULT")).toBe(true);
  });

  it("allows multiple deliberate artifacts from one Run and lists supported completed sources", async () => {
    const owner = await account(); const source = await seedRun(owner, "battle");
    await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id });
    await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id, aspectRatio: "SQUARE_1_1" });
    expect((await listMediaArtifacts(owner.user.id, owner.workspaceId)).total).toBe(2);
    expect((await listCompletedMediaSources(owner.user.id, owner.workspaceId))[0]).toMatchObject({ runId: source.run.id, artifactCount: 2 });
  });
});

describe("Creator/Media source integrity and isolation", () => {
  it("rejects incomplete, foreign, unsupported, and corrupt Runs safely", async () => {
    const owner = await account(); const foreign = await account();
    const incomplete = await seedRun(owner, "battle", { status: "RUNNING" });
    await expect(createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: incomplete.run.id }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(createMediaArtifactFromRun(foreign.user.id, foreign.workspaceId, { runId: incomplete.run.id }))
      .rejects.toBeInstanceOf(NotFoundError);

    const unsupported = await seedRun(owner, "battle", { storedModuleId: "economy", storedModuleVersion: "economy-v1" });
    await expect(createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: unsupported.run.id }))
      .rejects.toBeInstanceOf(ValidationError);

    const corrupt = await seedRun(owner, "battle");
    await prisma.simulationRun.update({ where: { id: corrupt.run.id }, data: { result: JSON.stringify({ broken: true }) } });
    await expect(createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: corrupt.run.id }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.mediaArtifact.count()).toBe(0);
  });

  it("uses historical participant snapshots after the live Entity changes", async () => {
    const owner = await account(); const source = await seedRun(owner, "battle");
    const artifact = await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id });
    const before = JSON.stringify(artifact.version.storyboard);
    await updateEntity(owner.user.id, owner.workspaceId, source.entities[0]!.id, { name: "Renamed After Run" });
    const loaded = await getMediaArtifact(owner.user.id, owner.workspaceId, artifact.id);
    expect(JSON.stringify(loaded.version.storyboard)).toBe(before);
    expect(loaded.version.storyboard.participants[0]?.name).toBe("Historical Lion");
  });
});

describe("Creator/Media permissions and immutable versions", () => {
  it("enforces create/edit grants while allowing workspace read-only access", async () => {
    const owner = await account(); const creator = await account("Creator"); const viewer = await account("Viewer"); const foreign = await account("Foreign");
    await addMember(owner.workspaceId, creator.user.id, "CREATOR");
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const source = await seedRun(owner, "race");
    const artifact = await createMediaArtifactFromRun(creator.user.id, owner.workspaceId, { runId: source.run.id });
    expect((await getMediaArtifact(viewer.user.id, owner.workspaceId, artifact.id)).id).toBe(artifact.id);
    await expect(createMediaArtifactFromRun(viewer.user.id, owner.workspaceId, { runId: source.run.id }))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(createMediaArtifactVersion(viewer.user.id, owner.workspaceId, artifact.id, editInput(artifact)))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(getMediaArtifact(foreign.user.id, foreign.workspaceId, artifact.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getMediaArtifact(foreign.user.id, owner.workspaceId, artifact.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("appends immutable monotonic versions and rejects scene identity changes", async () => {
    const owner = await account(); const source = await seedRun(owner, "survival");
    const artifact = await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id });
    const versionOneBefore = await prisma.mediaArtifactVersion.findUniqueOrThrow({
      where: { artifactId_version: { artifactId: artifact.id, version: 1 } },
    });
    const updated = await createMediaArtifactVersion(owner.user.id, owner.workspaceId, artifact.id, editInput(artifact));
    expect(updated).toMatchObject({ currentVersion: 2, status: "READY" });
    expect(updated.version.aspectRatio).toBe("PORTRAIT_9_16");
    expect((await prisma.mediaArtifactVersion.findUniqueOrThrow({ where: { id: versionOneBefore.id } })).storyboard)
      .toBe(versionOneBefore.storyboard);
    expect(updated.versions.map((version) => version.version)).toEqual([2, 1]);

    const invalid = editInput(updated, "Invalid");
    invalid.scenes[0]!.id = "changed-source-scene";
    await expect(createMediaArtifactVersion(owner.user.id, owner.workspaceId, artifact.id, invalid))
      .rejects.toBeInstanceOf(ValidationError);
    expect((await getMediaArtifact(owner.user.id, owner.workspaceId, artifact.id)).currentVersion).toBe(2);
  });

  it("records archive and restore as immutable versions", async () => {
    const owner = await account(); const source = await seedRun(owner, "battle");
    const artifact = await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id });
    const ready = await createMediaArtifactVersion(owner.user.id, owner.workspaceId, artifact.id, editInput(artifact));
    const archived = await archiveMediaArtifact(owner.user.id, owner.workspaceId, artifact.id);
    expect(archived).toMatchObject({ status: "ARCHIVED", currentVersion: 3, archivedFromStatus: "READY" });
    await expect(createMediaArtifactVersion(owner.user.id, owner.workspaceId, artifact.id, editInput(ready)))
      .rejects.toBeInstanceOf(ConflictError);
    const restored = await restoreMediaArtifact(owner.user.id, owner.workspaceId, artifact.id);
    expect(restored).toMatchObject({ status: "READY", currentVersion: 4, archivedFromStatus: null });
    expect(restored.versions.map((version) => version.status)).toEqual(["READY", "ARCHIVED", "READY", "DRAFT"]);
  });
});
