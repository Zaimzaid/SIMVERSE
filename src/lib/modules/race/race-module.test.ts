import { describe, expect, it, vi } from "vitest";
import { initializeEngine, stepEngine } from "@/lib/engine/engine";
import { EngineExecutionError } from "@/lib/engine/module";
import { productionEngineRegistry } from "@/lib/engine/registry";
import { SeededRng } from "@/lib/engine/rng";
import { inputSnapshotSchema, type InputSnapshotV1, type ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import { defaultConfigV1, defaultPresentation } from "@/lib/simulations/config";
import { battleModule } from "@/lib/modules/battle/battle-module";
import {
  RACE_MAX_PARTICIPANTS, defaultRaceConfigV1, raceConfigV1Schema, raceExecutionIssue,
  type RaceConfigV1,
} from "./config";
import { raceModule, raceRanking } from "./race-module";
import { finishTimeMicros, raceProgressDelta } from "./rules";
import { raceResultSchema, raceStateSchema, type RaceParticipantStateV1 } from "./schemas";
import { resolveRaceProfile } from "./stats";

function participant(position: number, values: Record<string, number> = {}): ParticipantSnapshotV1 {
  return {
    runParticipantId: `participant-${position}`, sourceEntityId: `entity-${position}`, position,
    role: null, overrides: null, name: `Racer ${position}`, shortName: null,
    description: null, category: position % 2 ? "creature" : "vehicle", status: "ACTIVE",
    imageUrl: null, primaryColor: null, secondaryColor: null, metadata: null, tags: [],
    attributes: Object.entries(values).map(([key, value]) => ({
      definitionId: `definition-${position}-${key}`, key, name: key.toUpperCase(), description: null,
      dataType: "NUMBER", unit: null, minimum: null, maximum: null, options: null,
      defaultValue: null, isBuiltIn: true, value: String(value),
    })),
  };
}

function input(options: {
  seed?: string; count?: number; config?: Partial<RaceConfigV1>; profiles?: Record<string, number>[];
} = {}): InputSnapshotV1 {
  const configuration = defaultConfigV1("race");
  const base = defaultRaceConfigV1();
  configuration.mode = {
    ...base,
    ...options.config,
    statMapping: { ...base.statMapping, ...options.config?.statMapping },
  };
  return inputSnapshotSchema.parse({
    version: 1, simulationId: "simulation-race", simulationName: "Race", mode: "race",
    configVersion: 1, configuration, presentation: defaultPresentation(),
    resolvedSeed: options.seed ?? "SV-RACE2345",
    participants: Array.from({ length: options.count ?? 2 }, (_, index) => participant(index, options.profiles?.[index])),
  });
}

function complete(snapshot: InputSnapshotV1) {
  let state = initializeEngine(raceModule, snapshot, 100);
  const actions: ReturnType<typeof stepEngine>["actions"] = [];
  const events: ReturnType<typeof stepEngine>["events"] = [];
  let result: ReturnType<typeof stepEngine>["result"] = null;
  let actionSequence = 0;
  let eventSequence = 0;
  const maxTicks = raceConfigV1Schema.parse(snapshot.configuration.mode).maxTicks;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const next = stepEngine(raceModule, snapshot, state, 100, actionSequence, eventSequence);
    state = next.state;
    actions.push(...next.actions);
    events.push(...next.events);
    actionSequence = next.lastActionSequence;
    eventSequence = next.lastEventSequence;
    if (next.result) { result = next.result; break; }
  }
  expect(result).not.toBeNull();
  return { state, actions, events, result: result!, raceResult: raceResultSchema.parse(result!.modulePayload) };
}

function racer(id: string, position: number, progressMilli: number, finishTime: number | null = null): RaceParticipantStateV1 {
  return {
    runParticipantId: id, position,
    profile: { speed: 50, acceleration: 50, handling: 50, stamina: 50, luck: 50 },
    progressMilli, lastDeltaMilli: 1_000, currentLap: 1, lapsCompleted: 0,
    checkpointKeys: [], finished: finishTime !== null, finishTimeMicros: finishTime,
  };
}

describe("production Race v1", () => {
  it("registers Race beside Battle without activating unfinished modules", () => {
    expect(productionEngineRegistry.forMode("battle")).toBe(battleModule);
    expect(productionEngineRegistry.forMode("race")).toBe(raceModule);
    expect(productionEngineRegistry.canExecute("tournament")).toBe(false);
    expect(productionEngineRegistry.canExecute("survival")).toBe(true);
  });

  it("validates canonical and legacy config while rejecting unsupported or unsafe values", () => {
    expect(raceConfigV1Schema.parse({ raceStyle: "sprint" })).toMatchObject({ version: 1, mode: "SPRINT", laps: 1 });
    expect(raceConfigV1Schema.parse({ raceStyle: "circuit" })).toMatchObject({ mode: "CIRCUIT", laps: 3 });
    expect(raceConfigV1Schema.safeParse({ raceStyle: "endurance" }).success).toBe(false);
    expect(raceConfigV1Schema.safeParse({ distance: 0 }).success).toBe(false);
    expect(raceConfigV1Schema.safeParse({ distance: Number.NaN }).success).toBe(false);
    expect(raceConfigV1Schema.safeParse({ distance: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(raceConfigV1Schema.safeParse({ mode: "SPRINT", laps: 2 }).success).toBe(false);
    expect(raceConfigV1Schema.safeParse({ checkpoints: [25, 25] }).success).toBe(false);
    expect(raceExecutionIssue(defaultRaceConfigV1(), 1)).toMatch(/at least 2/);
    expect(raceExecutionIssue(defaultRaceConfigV1(), RACE_MAX_PARTICIPANTS + 1)).toMatch(/at most/);
  });

  it("resolves configured frozen NUMBER attributes once, defaults missing values and clamps to 0–100", () => {
    const source = participant(0, { speed: 140.2, acceleration: -4.8, handling: 60.4 });
    expect(resolveRaceProfile(source, defaultRaceConfigV1().statMapping)).toEqual({
      speed: 100, acceleration: 0, handling: 60, stamina: 50, luck: 50,
    });
    expect(source.attributes[0]?.value).toBe("140.2");
    const custom = defaultRaceConfigV1();
    custom.statMapping.speed = "velocity";
    expect(resolveRaceProfile(participant(0, { velocity: 91 }), custom.statMapping).speed).toBe(91);
    const bad = { ...source, attributes: [{ ...source.attributes[0]!, dataType: "TEXT" }] };
    expect(() => resolveRaceProfile(bad, defaultRaceConfigV1().statMapping)).toThrow(/Race participant stat/);
  });

  it("executes deterministic two-person and multi-participant Sprint races through Core", () => {
    for (const count of [2, 4, 8]) {
      const run = complete(input({ count, config: { distance: 120, variability: 15 } }));
      expect(run.raceResult).toMatchObject({ moduleId: "race", moduleVersion: "race-v1" });
      expect(run.raceResult.participants).toHaveLength(count);
      expect(run.raceResult.ranking).toHaveLength(count);
      expect(new Set(run.raceResult.ranking.map((entry) => entry.runParticipantId)).size).toBe(count);
      expect(run.actions).toHaveLength(run.state.tick);
      expect(run.events[0]?.type).toBe("race.started");
      expect(run.events.at(-1)?.type).toBe("race.completed");
      expect(run.events.filter((event) => event.type === "race.completed")).toHaveLength(1);
    }
  });

  it("supports Circuit laps and emits deterministic checkpoint context per lap", () => {
    const run = complete(input({ count: 4, config: {
      mode: "CIRCUIT", distance: 20, laps: 3, checkpoints: [25, 50, 75], variability: 0,
    } }));
    expect(run.raceResult.mode).toBe("CIRCUIT");
    expect(run.raceResult.participants.every((entry) => entry.lapsCompleted === 3)).toBe(true);
    const checkpoints = run.events.filter((event) => event.type === "race.checkpoint");
    expect(checkpoints.some((event) => event.payload.lap === 1 && event.payload.checkpointPercent === 25)).toBe(true);
    expect(checkpoints.some((event) => event.payload.lap === 3 && event.payload.checkpointPercent === 75)).toBe(true);
  });

  it("uses the documented acceleration, stamina, handling and bounded luck factors", () => {
    const neutral = { speed: 50, acceleration: 50, handling: 50, stamina: 50, luck: 50 };
    const fixed = { nextUint32: () => 1_000 };
    const fastAcceleration = raceProgressDelta({ profile: { ...neutral, acceleration: 100 }, tick: 1, progressMilli: 0, totalDistanceMilli: 100_000, variability: 0 }, fixed);
    const slowAcceleration = raceProgressDelta({ profile: { ...neutral, acceleration: 0 }, tick: 1, progressMilli: 0, totalDistanceMilli: 100_000, variability: 0 }, fixed);
    expect(fastAcceleration.progressDeltaMilli).toBeGreaterThan(slowAcceleration.progressDeltaMilli);
    const highStamina = raceProgressDelta({ profile: { ...neutral, stamina: 100 }, tick: 50, progressMilli: 90_000, totalDistanceMilli: 100_000, variability: 0 }, fixed);
    const lowStamina = raceProgressDelta({ profile: { ...neutral, stamina: 0 }, tick: 50, progressMilli: 90_000, totalDistanceMilli: 100_000, variability: 0 }, fixed);
    expect(highStamina.progressDeltaMilli).toBeGreaterThan(lowStamina.progressDeltaMilli);
    const negativeRoll = { nextUint32: () => 0 };
    const highHandling = raceProgressDelta({ profile: { ...neutral, handling: 100 }, tick: 50, progressMilli: 10_000, totalDistanceMilli: 100_000, variability: 100 }, negativeRoll);
    const lowHandling = raceProgressDelta({ profile: { ...neutral, handling: 0 }, tick: 50, progressMilli: 10_000, totalDistanceMilli: 100_000, variability: 100 }, negativeRoll);
    expect(highHandling.progressDeltaMilli).toBeGreaterThan(lowHandling.progressDeltaMilli);
    for (const luck of [0, 50, 100]) {
      const delta = raceProgressDelta({ profile: { ...neutral, luck }, tick: 50, progressMilli: 10_000, totalDistanceMilli: 100_000, variability: 100 }, { nextUint32: () => 2_000 });
      expect(delta.variabilityBasisPoints).toBeGreaterThanOrEqual(-1_000);
      expect(delta.variabilityBasisPoints).toBeLessThanOrEqual(1_000);
    }
  });

  it("is replay deterministic, uses no Math.random and permits seed-driven variation", () => {
    const source = input({ count: 4, config: { distance: 250, variability: 100 } });
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Math.random used"); });
    try {
      expect(complete(source)).toEqual(complete(source));
    } finally {
      random.mockRestore();
    }
    const other = complete(input({ count: 4, seed: "SV-OTHER999", config: { distance: 250, variability: 100 } }));
    expect(other.events).not.toEqual(complete(source).events);
  });

  it("preserves exact finish ties and shared ranks without inventing a tiebreaker", () => {
    const run = complete(input({ count: 3, config: { distance: 50, variability: 0 } }));
    expect(run.raceResult.winnerRunParticipantId).toBeNull();
    expect(run.raceResult.tiedParticipantIds).toHaveLength(3);
    expect(run.raceResult.ranking.map((entry) => entry.rank)).toEqual([1, 1, 1]);
    expect(new Set(run.raceResult.participants.map((entry) => entry.finishTimeMicros)).size).toBe(1);
  });

  it("uses precise within-tick finish timing and keeps equal authoritative values tied", () => {
    expect(finishTimeMicros(3, 100, 9_000, 2_000, 10_000)).toBe(250_000);
    expect(raceRanking([racer("later", 0, 10_000, 250_001), racer("first", 1, 10_000, 250_000)]))
      .toEqual([{ runParticipantId: "first", rank: 1, tied: false }, { runParticipantId: "later", rank: 2, tied: false }]);
    expect(raceRanking([racer("a", 0, 10_000, 250_000), racer("b", 1, 10_000, 250_000)]).map((entry) => entry.rank))
      .toEqual([1, 1]);
  });

  it("times out honestly, retains finishers and ranks DNF participants by achieved progress", () => {
    const run = complete(input({
      count: 3,
      config: { distance: 1_000_000, maxTicks: 2, variability: 0 },
      profiles: [{ speed: 100 }, { speed: 50 }, { speed: 0 }],
    }));
    expect(run.raceResult.completionReason).toBe("TIME_LIMIT");
    expect(run.raceResult.participants.every((entry) => !entry.finished && entry.finishTimeMicros === null)).toBe(true);
    expect(run.raceResult.ranking.map((entry) => entry.runParticipantId)).toEqual(["participant-0", "participant-1", "participant-2"]);
    expect(run.events.map((event) => event.type)).toContain("race.timeout");
  });

  it("emits aggregate progress at a bounded interval plus meaningful lead, checkpoint and finish events", () => {
    const run = complete(input({
      count: 2, config: { distance: 100, checkpoints: [25, 50, 75], variability: 0 },
      profiles: [{ speed: 100, acceleration: 100 }, { speed: 0, acceleration: 0 }],
    }));
    const types = run.events.map((event) => event.type);
    expect(types).toContain("race.progress");
    expect(types).toContain("race.lead_changed");
    expect(types).toContain("race.checkpoint");
    expect(types).toContain("race.finished");
    expect(run.events.filter((event) => event.type === "race.progress").length).toBeLessThan(run.state.tick);
    expect(run.events.filter((event) => event.type === "race.completed")).toHaveLength(1);
  });

  it("continues identically from serialized state, preserving RNG and acceleration", () => {
    const snapshot = input({ count: 4, config: { distance: 300, variability: 70 } });
    const initial = initializeEngine(raceModule, snapshot, 100);
    const first = stepEngine(raceModule, snapshot, initial, 100, 0, 0);
    const restored = JSON.parse(JSON.stringify(first.state));
    expect(stepEngine(raceModule, snapshot, restored, 100, 1, first.lastEventSequence))
      .toEqual(stepEngine(raceModule, snapshot, first.state, 100, 1, first.lastEventSequence));
  });

  it("rejects duplicate participants, invalid cardinality and corrupt actions", () => {
    expect(() => initializeEngine(raceModule, input({ count: 1 }), 100)).toThrow(/at least 2/);
    const duplicate = input();
    duplicate.participants[1] = { ...duplicate.participants[1]!, runParticipantId: duplicate.participants[0]!.runParticipantId };
    expect(() => initializeEngine(raceModule, duplicate, 100)).toThrow(EngineExecutionError);
    const snapshot = input();
    const state = initializeEngine(raceModule, snapshot, 100);
    const context = { input: snapshot, tick: 1, simulatedTimeMs: 100, fixedStepMs: 100,
      rng: SeededRng.fromSeed(snapshot.resolvedSeed) };
    expect(() => raceModule.evaluateRules(context, state.moduleState, {
      type: "race.advance", actorRunParticipantId: "participant-0", targetRunParticipantId: null,
      payloadVersion: 1, payload: { expectedTick: 1 }, sequence: 1, tick: 1,
    })).toThrow(EngineExecutionError);
  });
});
