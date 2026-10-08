import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { battleTournamentResultAdapter } from "@/lib/tournaments/result-adapter";
import type { WorkspaceRole } from "@/lib/permissions";
import { EXPERIENCE_PRESETS } from "@/lib/experiences/presets";
import { WORLD_PRESETS } from "@/lib/worlds/presets";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createEntity } from "./entity-service";
import { createExperienceProfile } from "./experience-profile-service";
import { createProject } from "./project-service";
import { createSimulationRun, executeUntilComplete, startSimulationRun } from "./simulation-run-service";
import { createSimulation, markSimulationReady } from "./simulation-service";
import { createWorld } from "./world-service";
import {
  acceptTournamentMatchResult, archiveTournament, cancelTournament, createTournament, deleteTournament,
  generateTournamentStructure, getTournament, listTournaments, markTournamentReady, pauseTournament,
  restoreTournament, resumeTournament, runTournamentMatch, startTournament, updateTournament, updateTournamentSchedule,
} from "./tournament-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function account() {
  sequence += 1;
  return registerUser({ displayName: `Tournament User ${sequence}`, email: `tournament-${sequence}-${Date.now()}@example.com`, password: "Password123", confirmPassword: "Password123" });
}
async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) { await prisma.workspaceMember.create({ data: { workspaceId, userId, role } }); }

async function fixture(count = 4) {
  const owner = await account(); const project = await createProject(owner.user.id, owner.workspaceId, { name: "Tournament Project" });
  const entities = [];
  for (let index = 1; index <= count; index += 1) entities.push(await createEntity(owner.user.id, owner.workspaceId, { name: `Participant ${index}`, category: "creature" }));
  const simulation = await createSimulation(owner.user.id, owner.workspaceId, { projectId: project.id, name: "Battle Duel Template", mode: "battle", seed: "SV-TOUR0001", participants: entities.slice(0, 2).map((entity) => ({ entityId: entity.id })), configuration: { general: { roundLimit: 120, allowTies: true }, mode: { format: "duel" } } });
  await markSimulationReady(owner.user.id, owner.workspaceId, simulation.id);
  return { owner, project, entities, simulation };
}

function input(source: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, unknown> = {}) {
  return { name: "SIMVERSE Championship", description: "Generic competition orchestration.", projectId: source.project.id, simulationTemplateId: source.simulation.id, format: "SINGLE_ELIMINATION", participants: source.entities.map((entity, index) => ({ entityId: entity.id, seed: index + 1 })), seedingMethod: "MANUAL", randomSeed: "SV-BRACKET1", tiePolicy: "REPLAY_MATCH", winPoints: 3, tiePoints: 1, lossPoints: 0, tiebreakers: ["POINTS", "WINS", "HEAD_TO_HEAD"], ...overrides };
}

describe("Tournament CRUD, permissions and tenant isolation", () => {
  it("creates, reads, lists, updates, archives, restores and safely deletes a Draft", async () => {
    const source = await fixture(); const created = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source));
    expect(created).toMatchObject({ status: "DRAFT", format: "SINGLE_ELIMINATION", participantType: "ENTITY", moduleKey: "battle" });
    expect(created.participants.map((participant) => participant.displayName)).toEqual(source.entities.map((entity) => entity.name));
    const updated = await updateTournament(source.owner.user.id, source.owner.workspaceId, created.id, { name: "Updated Championship" });
    expect(updated.name).toBe("Updated Championship");
    expect((await listTournaments(source.owner.user.id, source.owner.workspaceId, { search: "Updated" })).items).toHaveLength(1);
    expect((await archiveTournament(source.owner.user.id, source.owner.workspaceId, created.id)).status).toBe("ARCHIVED");
    expect((await restoreTournament(source.owner.user.id, source.owner.workspaceId, created.id)).status).toBe("DRAFT");
    await deleteTournament(source.owner.user.id, source.owner.workspaceId, created.id);
    await expect(getTournament(source.owner.user.id, source.owner.workspaceId, created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("enforces view/manage/run permissions and safe foreign failures", async () => {
    const source = await fixture(2); const viewer = await account(); const operator = await account(); const foreign = await account();
    await addMember(source.owner.workspaceId, viewer.user.id, "VIEWER"); await addMember(source.owner.workspaceId, operator.user.id, "OPERATOR");
    const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source));
    expect((await getTournament(viewer.user.id, source.owner.workspaceId, tournament.id)).id).toBe(tournament.id);
    await expect(updateTournament(viewer.user.id, source.owner.workspaceId, tournament.id, { name: "Blocked" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(generateTournamentStructure(operator.user.id, source.owner.workspaceId, tournament.id)).rejects.toBeInstanceOf(AuthorizationError);
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id); await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id);
    expect((await runTournamentMatch(operator.user.id, source.owner.workspaceId, tournament.id, structured.matches[0]!.id)).status).toBe("COMPLETED");
    await expect(getTournament(foreign.user.id, foreign.workspaceId, tournament.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects duplicate, archived and cross-workspace participant or template references", async () => {
    const source = await fixture(2); const foreign = await fixture(2);
    await expect(createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { participants: [{ entityId: source.entities[0]!.id }, { entityId: source.entities[0]!.id }] }))).rejects.toBeInstanceOf(ValidationError);
    await prisma.entity.update({ where: { id: source.entities[1]!.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    await expect(createTournament(source.owner.user.id, source.owner.workspaceId, input(source))).rejects.toBeInstanceOf(ValidationError);
    await expect(createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { simulationTemplateId: foreign.simulation.id }))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("Tournament seeding and deterministic structures", () => {
  it("generates the canonical seven-participant bracket with one BYE and never duplicates it", async () => {
    const source = await fixture(7); const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source));
    const generated = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    expect(generated.rounds).toHaveLength(3); expect(generated.matches).toHaveLength(7);
    expect(generated.matches.filter((match) => match.state === "BYE")).toHaveLength(1);
    expect(generated.matches.filter((match) => match.state === "BYE")[0]?.simulationRunId).toBeNull();
    const firstRound = generated.matches.filter((match) => match.roundId === generated.rounds[0]!.id);
    const seeds = (match: typeof firstRound[number]) => [match.participantOneId, match.participantTwoId].map((id) => id ? generated.participants.find((participant) => participant.id === id)?.seed : null);
    expect(firstRound.map(seeds)).toEqual([[1, null], [4, 5], [2, 7], [3, 6]]);
    await expect(generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("reproduces deterministic random seeding and preserves manual order", async () => {
    const source = await fixture(6);
    const first = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { name: "Random One", seedingMethod: "RANDOM", randomSeed: "SV-RANDOM01" }));
    const second = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { name: "Random Two", seedingMethod: "RANDOM", randomSeed: "SV-RANDOM01" }));
    expect(first.participants.map((participant) => participant.entityId)).toEqual(second.participants.map((participant) => participant.entityId));
    const manual = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { name: "Manual", participants: [...source.entities].reverse().map((entity, index) => ({ entityId: entity.id, seed: index + 1 })) }));
    expect(manual.participants.map((participant) => participant.entityId)).toEqual([...source.entities].reverse().map((entity) => entity.id));
  });

  it("creates a complete odd round-robin schedule with no duplicate pairings", async () => {
    const source = await fixture(5); const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { format: "ROUND_ROBIN" }));
    const generated = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    expect(generated.rounds).toHaveLength(5); expect(generated.matches).toHaveLength(10);
    const pairs = generated.matches.map((match) => [match.participantOneId, match.participantTwoId].sort().join(":"));
    expect(new Set(pairs).size).toBe(10); expect(generated.matches.every((match) => match.state === "READY")).toBe(true);
  });
});

describe("Tournament lifecycle, Runs, results and history", () => {
  it("locks structure at READY and supports start, pause, resume and history-preserving cancel", async () => {
    const source = await fixture(2); const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source));
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    const scheduleDate = new Date("2030-01-02T12:00:00.000Z");
    const scheduled = await updateTournamentSchedule(source.owner.user.id, source.owner.workspaceId, tournament.id, { scheduledStartAt: scheduleDate, rounds: [{ roundId: structured.rounds[0]!.id, startsAt: scheduleDate }], matches: [{ matchId: structured.matches[0]!.id, scheduledAt: scheduleDate }] });
    expect(scheduled.scheduledStartAt?.toISOString()).toBe(scheduleDate.toISOString()); expect(scheduled.rounds[0]!.startsAt?.toISOString()).toBe(scheduleDate.toISOString()); expect(scheduled.matches[0]!.scheduledAt?.toISOString()).toBe(scheduleDate.toISOString());
    expect((await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id)).status).toBe("READY");
    await expect(updateTournament(source.owner.user.id, source.owner.workspaceId, tournament.id, { name: "Too late" })).rejects.toBeInstanceOf(ConflictError);
    expect((await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).status).toBe("IN_PROGRESS");
    expect((await pauseTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).status).toBe("PAUSED");
    expect((await resumeTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).status).toBe("IN_PROGRESS");
    expect((await cancelTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).status).toBe("CANCELLED");
    expect((await getTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).matches).toHaveLength(1);
  });

  it("runs a Match through the normal Core/Battle pipeline and records an immutable champion", async () => {
    const source = await fixture(2); const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source));
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id); await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id);
    const completed = await runTournamentMatch(source.owner.user.id, source.owner.workspaceId, tournament.id, structured.matches[0]!.id);
    expect(completed.status).toBe("COMPLETED"); expect(completed.championParticipantId).toBeTruthy();
    const match = completed.matches[0]!; expect(match.state).toBe("COMPLETED"); expect(match.simulationId).toBeTruthy(); expect(match.simulationRunId).toBeTruthy(); expect(match.result?.sourceModule).toBe("battle");
    const derived = await prisma.simulation.findUniqueOrThrow({ where: { id: match.simulationId! }, include: { entityLinks: true } });
    expect(derived.status).toBe("READY"); expect(derived.entityLinks).toHaveLength(2);
    const snapshotBefore = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: match.id }, select: { resultSnapshot: true } });
    const idempotent = await acceptTournamentMatchResult(source.owner.user.id, source.owner.workspaceId, tournament.id, match.id);
    expect(idempotent.matches).toHaveLength(1); expect(idempotent.championParticipantId).toBe(completed.championParticipantId);
    await prisma.entity.update({ where: { id: source.entities[0]!.id }, data: { name: "Changed later" } });
    const archived = await archiveTournament(source.owner.user.id, source.owner.workspaceId, tournament.id); expect(archived.status).toBe("ARCHIVED");
    const historical = await restoreTournament(source.owner.user.id, source.owner.workspaceId, tournament.id); expect(historical.status).toBe("COMPLETED");
    expect(historical.participants[0]!.displayName).toBe("Participant 1");
    expect((await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: match.id } })).resultSnapshot).toBe(snapshotBefore.resultSnapshot);
    await expect(deleteTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("pins inherited World and Experience versions and uses the frozen template snapshot", async () => {
    const source = await fixture(2); const worldPreset = WORLD_PRESETS[0]!; const experiencePreset = EXPERIENCE_PRESETS[0]!;
    const world = await createWorld(source.owner.user.id, source.owner.workspaceId, { name: "Tournament Savannah", description: "Pinned Tournament World.", category: worldPreset.category, status: "DRAFT", tags: worldPreset.tags, biome: worldPreset.biome, visibility: "WORKSPACE", blueprint: structuredClone(worldPreset.blueprint), assetAssociations: [], entityAssociations: [], changeNote: "Initial" });
    const experience = await createExperienceProfile(source.owner.user.id, source.owner.workspaceId, { name: "Tournament Broadcast", description: "Pinned Match presentation.", status: "DRAFT", tags: ["Tournament"], definition: structuredClone(experiencePreset.definition), changeNote: "Initial" });
    const template = await createSimulation(source.owner.user.id, source.owner.workspaceId, { projectId: source.project.id, name: "Bound Duel Template", mode: "battle", seed: "SV-BOUND001", participants: source.entities.map((entity) => ({ entityId: entity.id })), configuration: { general: { roundLimit: 120 }, mode: { format: "duel" } }, worldId: world.id, worldVersion: 1, experienceProfileId: experience.id, experienceProfileVersion: 1 });
    await markSimulationReady(source.owner.user.id, source.owner.workspaceId, template.id);
    const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { simulationTemplateId: template.id }));
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    await prisma.simulation.update({ where: { id: template.id }, data: { name: "Changed after structure", configuration: JSON.stringify({ version: 1, general: { speed: "normal", roundLimit: 120, randomEvents: true, allowTies: false, difficulty: "normal" }, mode: { format: "free_for_all" } }) } });
    await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id); await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id);
    const completed = await runTournamentMatch(source.owner.user.id, source.owner.workspaceId, tournament.id, structured.matches[0]!.id);
    const match = completed.matches[0]!; const derived = await prisma.simulation.findUniqueOrThrow({ where: { id: match.simulationId! } });
    expect(derived).toMatchObject({ worldId: world.id, worldVersion: 1, experienceProfileId: experience.id, experienceProfileVersion: 1 });
    expect(JSON.parse(derived.configuration!).mode.format).toBe("duel");
    const run = await prisma.simulationRun.findUniqueOrThrow({ where: { id: match.simulationRunId! } }); const snapshot = JSON.parse(run.inputSnapshot);
    expect(snapshot.world).toMatchObject({ worldId: world.id, version: 1 }); expect(snapshot.experienceProfile).toMatchObject({ experienceProfileId: experience.id, version: 1 });
  });

  it("creates a replay Match for an authoritative elimination tie without overwriting the original", async () => {
    const source = await fixture(2); const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { tiePolicy: "REPLAY_MATCH" }));
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id); await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id); await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id);
    const run = await completedTemplateRun(source); const ids = run.inputSnapshot.participants.map((participant) => participant.runParticipantId);
    await makeTie(run.id, run.result!, ids); await prisma.tournamentMatch.update({ where: { id: structured.matches[0]!.id }, data: { state: "RUNNING", simulationId: source.simulation.id, simulationRunId: run.id } });
    const accepted = await acceptTournamentMatchResult(source.owner.user.id, source.owner.workspaceId, tournament.id, structured.matches[0]!.id);
    expect(accepted.matches).toHaveLength(2); expect(accepted.matches[0]!.state).toBe("COMPLETED"); expect(accepted.matches[0]!.winnerParticipantId).toBeNull();
    expect(accepted.matches[1]).toMatchObject({ state: "READY", replayOfMatchId: structured.matches[0]!.id, simulationRunId: null });
  });

  it("pauses on a forbidden elimination tie and never invents a winner", async () => {
    const source = await fixture(2); const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { tiePolicy: "NO_TIES_ALLOWED" }));
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id); await markTournamentReady(source.owner.user.id, source.owner.workspaceId, tournament.id); await startTournament(source.owner.user.id, source.owner.workspaceId, tournament.id);
    const run = await completedTemplateRun(source); const ids = run.inputSnapshot.participants.map((participant) => participant.runParticipantId);
    await makeTie(run.id, run.result!, ids); await prisma.tournamentMatch.update({ where: { id: structured.matches[0]!.id }, data: { state: "RUNNING", simulationId: source.simulation.id, simulationRunId: run.id } });
    const accepted = await acceptTournamentMatchResult(source.owner.user.id, source.owner.workspaceId, tournament.id, structured.matches[0]!.id);
    expect(accepted.status).toBe("PAUSED"); expect(accepted.championParticipantId).toBeNull(); expect(accepted.executionError).toContain("tie");
  });

  it("derives round-robin standings from immutable Match result snapshots", async () => {
    const source = await fixture(3); const tournament = await createTournament(source.owner.user.id, source.owner.workspaceId, input(source, { format: "ROUND_ROBIN", winPoints: 4, tiePoints: 2, lossPoints: 0 }));
    const structured = await generateTournamentStructure(source.owner.user.id, source.owner.workspaceId, tournament.id);
    for (const [index, match] of structured.matches.entries()) {
      const tie = index === 0; const result = { snapshotVersion: 1, winnerTournamentParticipantId: tie ? null : match.participantOneId, tiedTournamentParticipantIds: tie ? [match.participantOneId!, match.participantTwoId!] : [], ranking: [match.participantOneId!, match.participantTwoId!], completed: true, sourceRunId: `run-${index}`, sourceModule: "battle", sourceModuleVersion: "battle-v1", completionReason: "TEST", metadata: {} };
      await prisma.tournamentMatch.update({ where: { id: match.id }, data: { state: "COMPLETED", winnerParticipantId: result.winnerTournamentParticipantId, resultSnapshot: JSON.stringify(result), completedAt: new Date() } });
    }
    const standings = (await getTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).standings;
    expect(standings.every((standing) => standing.played === 2)).toBe(true);
    expect(standings.reduce((total, standing) => total + standing.points, 0)).toBe(12);
    expect(standings.map((standing) => standing.rank)).toEqual([...standings.map((standing) => standing.rank)].sort((a, b) => a - b));
    for (const match of structured.matches) {
      const tie = { snapshotVersion: 1, winnerTournamentParticipantId: null, tiedTournamentParticipantIds: [match.participantOneId!, match.participantTwoId!], ranking: [match.participantOneId!, match.participantTwoId!], completed: true, sourceRunId: `tie-${match.id}`, sourceModule: "battle", sourceModuleVersion: "battle-v1", completionReason: "TEST", metadata: {} };
      await prisma.tournamentMatch.update({ where: { id: match.id }, data: { winnerParticipantId: null, resultSnapshot: JSON.stringify(tie) } });
    }
    expect((await getTournament(source.owner.user.id, source.owner.workspaceId, tournament.id)).standings.map((standing) => standing.rank)).toEqual([1, 1, 1]);
  });
});

describe("Battle Tournament result adapter", () => {
  it("rejects invalid participant mappings and never reimplements Battle winner logic", async () => {
    const source = await fixture(2); const run = await completedTemplateRun(source);
    expect(() => battleTournamentResultAdapter.interpret(run, [{ tournamentParticipantId: "one", entityId: source.entities[0]!.id }, { tournamentParticipantId: "foreign", entityId: "missing" }])).toThrow(ValidationError);
    const result = battleTournamentResultAdapter.interpret(run, source.entities.map((entity, index) => ({ tournamentParticipantId: `t-${index}`, entityId: entity.id })));
    expect(result.sourceModule).toBe("battle"); expect(result.ranking).toHaveLength(2);
  });
});

async function completedTemplateRun(source: Awaited<ReturnType<typeof fixture>>) {
  let run = await createSimulationRun(source.owner.user.id, source.owner.workspaceId, source.simulation.id);
  run = await startSimulationRun(source.owner.user.id, source.owner.workspaceId, run.id);
  run = await executeUntilComplete(source.owner.user.id, source.owner.workspaceId, run.id);
  expect(run.status).toBe("COMPLETED"); expect(run.result).not.toBeNull(); return run;
}

async function makeTie(runId: string, result: NonNullable<Awaited<ReturnType<typeof completedTemplateRun>>["result"]>, runParticipantIds: string[]) {
  const payload = result.modulePayload as Record<string, unknown>;
  await prisma.simulationRun.update({ where: { id: runId }, data: { result: JSON.stringify({ ...result, modulePayload: { ...payload, winnerRunParticipantId: null, tiedParticipantIds: runParticipantIds, ranking: runParticipantIds } }) } });
}
