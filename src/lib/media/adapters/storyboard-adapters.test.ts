import { describe, expect, it } from "vitest";
import type { EngineEvent, JsonRecord, ParticipantSnapshotV1, ResultEnvelopeV1 } from "@/lib/engine/schemas";
import { battleStoryboardAdapter } from "./battle";
import { raceStoryboardAdapter } from "./race";
import { survivalStoryboardAdapter } from "./survival";
import type { StoryboardSourceRun } from "./types";

function participant(index: number): ParticipantSnapshotV1 {
  return {
    runParticipantId: `participant-${index}`,
    sourceEntityId: `entity-${index}`,
    position: index - 1,
    role: null,
    overrides: null,
    name: ["Lion", "Falcon", "Robot", "Orb"][index - 1] ?? `Participant ${index}`,
    shortName: null,
    description: null,
    category: "creature",
    status: "ACTIVE",
    imageUrl: null,
    primaryColor: null,
    secondaryColor: null,
    metadata: null,
    tags: [],
    attributes: [],
  };
}

function result(resultType: string, modulePayload: JsonRecord): ResultEnvelopeV1 {
  return { version: 1, resultType, summary: "Authoritative result", metrics: {}, modulePayloadVersion: 1, modulePayload };
}

function event(
  sequence: number,
  type: string,
  payload: JsonRecord,
  actorRunParticipantId: string | null = null,
  targetRunParticipantId: string | null = null,
): EngineEvent {
  return { sequence, tick: Math.max(1, sequence), simulatedTimeMs: sequence * 100, type,
    actorRunParticipantId, targetRunParticipantId, payloadVersion: 1, payload };
}

function source(
  moduleId: string,
  moduleVersion: string,
  participants: ParticipantSnapshotV1[],
  events: EngineEvent[],
  authoritativeResult: ResultEnvelopeV1,
): StoryboardSourceRun {
  return { id: "run-1", simulationId: "simulation-1", simulationName: "Canonical Event", mode: moduleId,
    moduleId, moduleVersion, participants, events, result: authoritativeResult };
}

const battleProfile = { strength: 50, defense: 50, speed: 50, intelligence: 50, luck: 50 };
function battleMetric(id: string, position: number, alive: boolean) {
  return { runParticipantId: id, position, profile: battleProfile, health: alive ? 50 : 0, alive,
    defending: false, eliminationTick: alive ? null : 8, damageDealt: 50, damageReceived: 50,
    attacksAttempted: 4, attacksLanded: 3, criticalHits: 1, dodges: 1, defends: 0 };
}
function battleResult(ids: string[], options: { winner?: string | null; tied?: string[]; reason?: "KNOCKOUT" | "TIME_LIMIT" } = {}) {
  const winner = options.winner === undefined ? ids[0]! : options.winner;
  const tied = options.tied ?? [];
  return result("battle.result", { version: 1, format: ids.length === 2 ? "duel" : "free_for_all",
    completionReason: options.reason ?? "KNOCKOUT", winnerRunParticipantId: winner,
    tiedParticipantIds: tied, ranking: ids, eliminationOrder: winner ? ids.slice(1).reverse() : [],
    totalTicks: 10, simulatedDurationMs: 1000,
    participantMetrics: ids.map((id, index) => battleMetric(id, index, id === winner || tied.includes(id))) });
}

const raceProfile = { speed: 50, acceleration: 50, handling: 50, stamina: 50, luck: 50 };
function raceResult(ids: string[], winner: string | null, tied: string[] = []) {
  return result("race.result", { version: 1, moduleId: "race", moduleVersion: "race-v1", mode: "SPRINT",
    distance: 100, distanceUnit: "METER", laps: 1, totalDistanceMilli: 100_000,
    completionReason: "ALL_FINISHED", winnerRunParticipantId: winner, tiedParticipantIds: tied,
    ranking: ids.map((id, index) => ({ runParticipantId: id, rank: tied.length ? 1 : index + 1, tied: tied.includes(id) })),
    participants: ids.map((id, index) => ({ runParticipantId: id, rank: tied.length ? 1 : index + 1,
      tied: tied.includes(id), finished: true, finishTimeMicros: 100_000 + index, distanceMilli: 100_000,
      lapsCompleted: 1, profile: raceProfile })), totalTicks: 12, simulatedDurationMs: 1200 });
}

const survivalProfile = { endurance: 50, resilience: 50, resourceEfficiency: 50, adaptability: 50, awareness: 50, luck: 50 };
function survivalResult(ids: string[], winner: string | null, tied: string[] = []) {
  return result("survival.result", { version: 1, moduleId: "survival", moduleVersion: "survival-v1",
    mode: "LAST_STANDING", completionReason: tied.length ? "TIME_LIMIT" : "LAST_STANDING",
    winnerRunParticipantId: winner, tiedParticipantIds: tied,
    ranking: ids.map((id, index) => ({ runParticipantId: id, rank: tied.length ? 1 : index + 1, tied: tied.includes(id) })),
    participants: ids.map((id, index) => ({ runParticipantId: id, rank: tied.length ? 1 : index + 1,
      tied: tied.includes(id), survived: id === winner || tied.includes(id), eliminationTick: id === winner || tied.includes(id) ? null : 8,
      eliminationTimeMs: id === winner || tied.includes(id) ? null : 800, eliminationCause: id === winner || tied.includes(id) ? null : "CONDITION",
      finalCondition: id === winner || tied.includes(id) ? 50_000 : 0, finalResources: { energy: 20_000, supplies: 10_000 },
      survivalDurationMs: 1000 - index, profile: survivalProfile })), totalTicks: 10, simulatedDurationMs: 1000, hazardCount: 2 });
}

describe("Battle storyboard adapter", () => {
  it("preserves a knockout winner and decisive event deterministically", () => {
    const participants = [participant(1), participant(2)];
    const ids = participants.map((item) => item.runParticipantId);
    const input = source("battle", "battle-v1", participants, [
      event(1, "battle.critical_hit", { finalDamage: 30 }, ids[0], ids[1]),
      event(2, "battle.eliminated", { eliminationTick: 2, eliminationRank: 1 }, ids[0], ids[1]),
    ], battleResult(ids));
    const first = battleStoryboardAdapter.build(input);
    expect(first).toEqual(battleStoryboardAdapter.build(input));
    expect(first.summary).toMatchObject({ winnerParticipantRefs: [ids[0]], completionReason: "KNOCKOUT" });
    expect(first.scenes.some((scene) => scene.sourceEventSequence === 2 && scene.kind === "TURNING_POINT")).toBe(true);
  });

  it("represents a time-limit tie without inventing a winner", () => {
    const participants = [participant(1), participant(2)]; const ids = participants.map((item) => item.runParticipantId);
    const storyboard = battleStoryboardAdapter.build(source("battle", "battle-v1", participants,
      [event(1, "battle.timeout", { maxTicks: 10, survivors: 2 })],
      battleResult(ids, { winner: null, tied: ids, reason: "TIME_LIMIT" })));
    expect(storyboard.summary.winnerParticipantRefs).toEqual([]);
    expect(storyboard.summary.tiedParticipantRefs).toEqual(ids);
    expect(storyboard.summary.headline).toContain("tie");
  });

  it("bounds highlights for a multi-participant free-for-all", () => {
    const participants = [participant(1), participant(2), participant(3), participant(4)];
    const ids = participants.map((item) => item.runParticipantId);
    const events = Array.from({ length: 18 }, (_, index) => event(index + 1, "battle.critical_hit",
      { finalDamage: 25 + index }, ids[index % 4]!, ids[(index + 1) % 4]!));
    const storyboard = battleStoryboardAdapter.build(source("battle", "battle-v1", participants, events, battleResult(ids)));
    expect(storyboard.participants).toHaveLength(4);
    expect(storyboard.scenes.filter((scene) => scene.kind === "HIGHLIGHT" || scene.kind === "TURNING_POINT")).toHaveLength(6);
    expect(storyboard.scenes).toHaveLength(10);
  });
});

describe("Race storyboard adapter", () => {
  it("uses the saved winner and finish event", () => {
    const participants = [participant(1), participant(2)]; const ids = participants.map((item) => item.runParticipantId);
    const storyboard = raceStoryboardAdapter.build(source("race", "race-v1", participants,
      [event(1, "race.finished", { finishTimeMicros: 100_000, finishPosition: 1, tied: false, totalDistanceMilli: 100_000, lapsCompleted: 1 }, ids[0])],
      raceResult(ids, ids[0]!)));
    expect(storyboard.summary.winnerParticipantRefs).toEqual([ids[0]]);
    expect(storyboard.scenes.some((scene) => scene.title === "First across the line")).toBe(true);
  });

  it("preserves a shared first-place result", () => {
    const participants = [participant(1), participant(2)]; const ids = participants.map((item) => item.runParticipantId);
    const storyboard = raceStoryboardAdapter.build(source("race", "race-v1", participants, [], raceResult(ids, null, ids)));
    expect(storyboard.summary.tiedParticipantRefs).toEqual(ids);
    expect(storyboard.summary.headline).toContain("tie");
  });
});

describe("Survival storyboard adapter", () => {
  it("uses the saved final survivor", () => {
    const participants = [participant(1), participant(2)]; const ids = participants.map((item) => item.runParticipantId);
    const storyboard = survivalStoryboardAdapter.build(source("survival", "survival-v1", participants,
      [event(1, "survival.eliminated", { cause: "CONDITION", eliminationTick: 8, eliminationTimeMs: 800,
        condition: 0, energy: 100, supplies: 100 }, ids[1])], survivalResult(ids, ids[0]!)));
    expect(storyboard.summary.winnerParticipantRefs).toEqual([ids[0]]);
    expect(storyboard.summary.headline).toContain("survives");
  });

  it("represents shared survivors without choosing one", () => {
    const participants = [participant(1), participant(2)]; const ids = participants.map((item) => item.runParticipantId);
    const storyboard = survivalStoryboardAdapter.build(source("survival", "survival-v1", participants, [], survivalResult(ids, null, ids)));
    expect(storyboard.summary.winnerParticipantRefs).toEqual([]);
    expect(storyboard.summary.tiedParticipantRefs).toEqual(ids);
    expect(storyboard.summary.headline).toContain("share the win");
  });
});
