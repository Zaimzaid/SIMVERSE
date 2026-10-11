import { describe, expect, it, vi } from "vitest";
import { initializeEngine, stepEngine } from "@/lib/engine/engine";
import { EngineExecutionError } from "@/lib/engine/module";
import { productionEngineRegistry } from "@/lib/engine/registry";
import { SeededRng } from "@/lib/engine/rng";
import { inputSnapshotSchema, type InputSnapshotV1, type ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import { defaultConfigV1, defaultPresentation } from "@/lib/simulations/config";
import {
  SURVIVAL_MAX_PARTICIPANTS,
  defaultSurvivalConfigV1,
  survivalConfigV1Schema,
  survivalExecutionIssue,
  type SurvivalConfigV1,
} from "./config";
import {
  survivalConditionDrain, survivalHazardImpact, survivalRecovery, survivalResourceDrain,
} from "./rules";
import { survivalModule, survivalRanking } from "./survival-module";
import { survivalResultSchema, survivalStateSchema, type SurvivalParticipantStateV1 } from "./schemas";
import { resolveSurvivalProfile } from "./stats";

function participant(position: number, values: Record<string, number> = {}): ParticipantSnapshotV1 {
  return {
    runParticipantId: `participant-${position}`, sourceEntityId: `entity-${position}`, position,
    role: null, overrides: null, name: `Survivor ${position}`, shortName: null,
    description: null, category: position % 2 ? "robot" : "creature", status: "ACTIVE",
    imageUrl: null, primaryColor: null, secondaryColor: null, metadata: null, tags: [],
    attributes: Object.entries(values).map(([key, value]) => ({
      definitionId: `definition-${position}-${key}`, key, name: key.toUpperCase(), description: null,
      dataType: "NUMBER", unit: null, minimum: null, maximum: null, options: null,
      defaultValue: null, isBuiltIn: true, value: String(value),
    })),
  };
}

function mergedConfig(config: Partial<SurvivalConfigV1> = {}): SurvivalConfigV1 {
  const base = defaultSurvivalConfigV1();
  return survivalConfigV1Schema.parse({
    ...base,
    ...config,
    resources: { ...base.resources, ...config.resources },
    recovery: { ...base.recovery, ...config.recovery },
    statMapping: { ...base.statMapping, ...config.statMapping },
  });
}

function input(options: {
  seed?: string; count?: number; config?: Partial<SurvivalConfigV1>; profiles?: Record<string, number>[];
} = {}): InputSnapshotV1 {
  const configuration = defaultConfigV1("survival");
  configuration.mode = mergedConfig(options.config);
  return inputSnapshotSchema.parse({
    version: 1, simulationId: "simulation-survival", simulationName: "Survival", mode: "survival",
    configVersion: 1, configuration, presentation: defaultPresentation(),
    resolvedSeed: options.seed ?? "SV-SURV2345",
    participants: Array.from({ length: options.count ?? 2 }, (_, index) => participant(index, options.profiles?.[index])),
  });
}

function complete(snapshot: InputSnapshotV1) {
  let state = initializeEngine(survivalModule, snapshot, 100);
  const actions: ReturnType<typeof stepEngine>["actions"] = [];
  const events: ReturnType<typeof stepEngine>["events"] = [];
  let result: ReturnType<typeof stepEngine>["result"] = null;
  let actionSequence = 0;
  let eventSequence = 0;
  const maxTicks = survivalConfigV1Schema.parse(snapshot.configuration.mode).maxTicks;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const next = stepEngine(survivalModule, snapshot, state, 100, actionSequence, eventSequence);
    state = next.state;
    actions.push(...next.actions);
    events.push(...next.events);
    actionSequence = next.lastActionSequence;
    eventSequence = next.lastEventSequence;
    if (next.result) { result = next.result; break; }
  }
  expect(result).not.toBeNull();
  return {
    state,
    actions,
    events,
    result: result!,
    survivalResult: survivalResultSchema.parse(result!.modulePayload),
  };
}

function survivor(
  id: string,
  position: number,
  values: Partial<SurvivalParticipantStateV1> = {},
): SurvivalParticipantStateV1 {
  return {
    runParticipantId: id, position,
    profile: { endurance: 50, resilience: 50, resourceEfficiency: 50, adaptability: 50, awareness: 50, luck: 50 },
    condition: 100_000, energy: 100_000, supplies: 100_000, active: true,
    lastConditionLoss: 0, lastEnergyDrain: 0, lastSuppliesDrain: 0,
    eliminationTick: null, eliminationTimeMs: null, eliminationCause: null, survivalTimeMs: 0,
    ...values,
  };
}

describe("production Survival v1", () => {
  it("registers Survival beside Battle and Race while unfinished Tournament execution remains unavailable", () => {
    expect(productionEngineRegistry.canExecute("battle")).toBe(true);
    expect(productionEngineRegistry.canExecute("race")).toBe(true);
    expect(productionEngineRegistry.forMode("survival")).toBe(survivalModule);
    expect(productionEngineRegistry.canExecute("tournament")).toBe(false);
  });

  it("validates canonical and legacy configuration with bounded finite values", () => {
    expect(survivalConfigV1Schema.parse({ scenarioType: "elimination" }).mode).toBe("LAST_STANDING");
    expect(survivalConfigV1Schema.parse({ scenarioType: "endurance" }).mode).toBe("ENDURANCE");
    expect(survivalConfigV1Schema.safeParse({ mode: "OTHER" }).success).toBe(false);
    expect(survivalConfigV1Schema.safeParse({ maxTicks: 10_001 }).success).toBe(false);
    expect(survivalConfigV1Schema.safeParse({ baseConditionDrain: -1 }).success).toBe(false);
    expect(survivalConfigV1Schema.safeParse({ variability: Number.NaN }).success).toBe(false);
    expect(survivalConfigV1Schema.safeParse({ resources: { initialEnergy: Number.POSITIVE_INFINITY } }).success).toBe(false);
    expect(survivalConfigV1Schema.safeParse({ hazardFrequency: 1, hazardIntensity: 0 }).success).toBe(false);
    expect(survivalConfigV1Schema.safeParse({ recovery: { amount: 1, energyCost: 0, suppliesCost: 0 } }).success).toBe(false);
    expect(survivalExecutionIssue(defaultSurvivalConfigV1(), 1)).toMatch(/at least 2/);
    expect(survivalExecutionIssue(defaultSurvivalConfigV1(), SURVIVAL_MAX_PARTICIPANTS + 1)).toMatch(/at most/);
  });

  it("resolves frozen generic NUMBER attributes once, defaults missing values and clamps to 0–100", () => {
    const source = participant(0, { endurance: 140.2, resilience: -4.8, adaptability: 60.4 });
    expect(resolveSurvivalProfile(source, defaultSurvivalConfigV1().statMapping)).toEqual({
      endurance: 100, resilience: 0, resourceEfficiency: 50, adaptability: 60, awareness: 50, luck: 50,
    });
    expect(source.attributes[0]?.value).toBe("140.2");
    const custom = defaultSurvivalConfigV1();
    custom.statMapping.endurance = "stamina";
    expect(resolveSurvivalProfile(participant(0, { stamina: 91 }), custom.statMapping).endurance).toBe(91);
    const bad = { ...source, attributes: [{ ...source.attributes[0]!, dataType: "TEXT" }] };
    expect(() => resolveSurvivalProfile(bad, defaultSurvivalConfigV1().statMapping)).toThrow(/Survival participant stat/);
  });

  it("executes two-person and multi-participant Last Standing runs with one completion event", () => {
    for (const count of [2, 4, 16]) {
      const profiles = Array.from({ length: count }, (_, index) => ({ endurance: index === 0 ? 100 : 0 }));
      const run = complete(input({ count, profiles, config: {
        maxTicks: 30, baseConditionDrain: 10_000, hazardFrequency: 0, variability: 0,
        recovery: { ...defaultSurvivalConfigV1().recovery, amount: 0 },
      } }));
      expect(run.survivalResult).toMatchObject({
        moduleId: "survival", moduleVersion: "survival-v1", completionReason: "LAST_STANDING",
        winnerRunParticipantId: "participant-0",
      });
      expect(run.survivalResult.participants).toHaveLength(count);
      expect(run.actions).toHaveLength(run.state.tick);
      expect(run.events[0]?.type).toBe("survival.started");
      expect(run.events.at(-1)?.type).toBe("survival.completed");
      expect(run.events.filter((event) => event.type === "survival.completed")).toHaveLength(1);
    }
  });

  it("runs Endurance to its explicit time limit and preserves exact ties", () => {
    const run = complete(input({ count: 4, config: {
      mode: "ENDURANCE", maxTicks: 3, hazardFrequency: 0, variability: 0,
      recovery: { ...defaultSurvivalConfigV1().recovery, amount: 0 },
    } }));
    expect(run.survivalResult.completionReason).toBe("TIME_LIMIT");
    expect(run.survivalResult.winnerRunParticipantId).toBeNull();
    expect(run.survivalResult.tiedParticipantIds).toHaveLength(4);
    expect(run.survivalResult.ranking.map((entry) => entry.rank)).toEqual([1, 1, 1, 1]);
    expect(run.events.map((event) => event.type)).toContain("survival.timeout");
  });

  it("applies explicit resource, endurance and depletion formulas", () => {
    const neutral = { endurance: 50, resilience: 50, resourceEfficiency: 50, adaptability: 50, awareness: 50, luck: 50 };
    const config = defaultSurvivalConfigV1();
    const fixed = { nextUint32: () => 1_000 };
    const efficient = survivalResourceDrain({ ...neutral, resourceEfficiency: 100 }, config.resources, 0, fixed);
    const wasteful = survivalResourceDrain({ ...neutral, resourceEfficiency: 0 }, config.resources, 0, fixed);
    expect(efficient.energyDrain).toBeLessThan(wasteful.energyDrain);
    expect(efficient.suppliesDrain).toBeLessThan(wasteful.suppliesDrain);
    expect(survivalResourceDrain({ ...neutral, luck: 100 }, config.resources, 100, fixed).energyDrain)
      .toBeLessThanOrEqual(survivalResourceDrain({ ...neutral, luck: 0 }, config.resources, 100, fixed).energyDrain);
    expect(survivalConditionDrain({ ...neutral, endurance: 100 }, 1_000, 500, 10, 10).totalLoss)
      .toBeLessThan(survivalConditionDrain({ ...neutral, endurance: 0 }, 1_000, 500, 10, 10).totalLoss);
    expect(survivalConditionDrain(neutral, 1_000, 500, 0, 0).resourceDepletionLoss).toBe(1_000);
  });

  it("keeps hazard effects bounded while awareness, resilience and adaptability reduce their documented portions", () => {
    const neutral = { endurance: 50, resilience: 50, resourceEfficiency: 50, adaptability: 50, awareness: 50, luck: 50 };
    const fixed = { nextUint32: () => 500 };
    const exposed = survivalHazardImpact("ENVIRONMENT", 100, { ...neutral, awareness: 0, resilience: 0, adaptability: 0 }, 0, fixed);
    const protectedImpact = survivalHazardImpact("ENVIRONMENT", 100, { ...neutral, awareness: 100, resilience: 100, adaptability: 100 }, 0, fixed);
    expect(protectedImpact.conditionLoss).toBeLessThan(exposed.conditionLoss);
    const accidentAdaptable = survivalHazardImpact("ACCIDENT", 100, { ...neutral, adaptability: 100 }, 0, fixed);
    const accidentUnadaptable = survivalHazardImpact("ACCIDENT", 100, { ...neutral, adaptability: 0 }, 0, fixed);
    expect(accidentAdaptable.conditionLoss).toBe(accidentUnadaptable.conditionLoss);
    for (const luck of [0, 50, 100]) {
      const impact = survivalHazardImpact("EXTREME_CONDITION", 100, { ...neutral, luck }, 100, fixed);
      expect(impact.variabilityBasisPoints).toBeGreaterThanOrEqual(-500);
      expect(impact.variabilityBasisPoints).toBeLessThanOrEqual(500);
      expect(impact.conditionLoss).toBeGreaterThan(0);
    }
    expect(survivalHazardImpact("EXTREME_CONDITION", 100, { ...neutral, luck: 100 }, 100, fixed).conditionLoss)
      .toBeLessThanOrEqual(survivalHazardImpact("EXTREME_CONDITION", 100, { ...neutral, luck: 0 }, 100, fixed).conditionLoss);
  });

  it("uses adaptability for bounded paid recovery and never creates resources", () => {
    const config = defaultSurvivalConfigV1().recovery;
    const neutral = { endurance: 50, resilience: 50, resourceEfficiency: 50, adaptability: 50, awareness: 50, luck: 50 };
    const low = survivalRecovery(10, 90_000, 10_000, 10_000, 0, { ...neutral, adaptability: 0 }, config);
    const high = survivalRecovery(10, 90_000, 10_000, 10_000, 0, { ...neutral, adaptability: 100 }, config);
    expect(high.conditionRecovered).toBeGreaterThan(low.conditionRecovered);
    expect(high).toMatchObject({ energyCost: config.energyCost, suppliesCost: config.suppliesCost });
    expect(survivalRecovery(10, 90_000, config.energyCost - 1, 10_000, 0, neutral, config).conditionRecovered).toBe(0);
    const run = complete(input({ config: {
      mode: "ENDURANCE", maxTicks: 2, baseConditionDrain: 1_000, hazardFrequency: 0, variability: 0,
      recovery: { amount: 500, intervalTicks: 1, energyCost: 200, suppliesCost: 100 },
    } }));
    expect(run.events.some((event) => event.type === "survival.recovered")).toBe(true);
  });

  it("generates typed hazards and meaningful resource depletion events", () => {
    const run = complete(input({ config: {
      mode: "ENDURANCE", maxTicks: 2, hazardFrequency: 100, hazardIntensity: 100, variability: 50,
      resources: {
        initialEnergy: 100, initialSupplies: 100, baseEnergyDrain: 100, baseSuppliesDrain: 100,
        depletionConditionPenalty: 0,
      },
      recovery: { amount: 0, intervalTicks: 1, energyCost: 0, suppliesCost: 0 },
    } }));
    expect(run.events.filter((event) => event.type === "survival.hazard")).toHaveLength(2);
    expect(run.events.some((event) => event.type === "survival.resource_changed")).toBe(true);
    expect(run.survivalResult.hazardCount).toBe(2);
  });

  it("records one elimination per participant and preserves an all-eliminated terminal tie", () => {
    const run = complete(input({ count: 3, config: {
      maxTicks: 5, baseConditionDrain: 10_000, eliminationThreshold: 92_500,
      hazardFrequency: 0, variability: 0,
      recovery: { amount: 0, intervalTicks: 1, energyCost: 0, suppliesCost: 0 },
    } }));
    expect(run.state.tick).toBe(1);
    expect(run.survivalResult.completionReason).toBe("ALL_ELIMINATED");
    expect(run.survivalResult.winnerRunParticipantId).toBeNull();
    expect(run.survivalResult.tiedParticipantIds).toHaveLength(3);
    expect(run.survivalResult.participants.every((entry) => !entry.survived && entry.eliminationTick === 1)).toBe(true);
    expect(run.events.filter((event) => event.type === "survival.eliminated")).toHaveLength(3);
  });

  it("ranks active state before eliminated state without using stable position as a hidden tiebreaker", () => {
    const ranking = survivalRanking([
      survivor("eliminated", 0, { active: false, survivalTimeMs: 500, eliminationTick: 5, eliminationTimeMs: 500, eliminationCause: "CONDITION" }),
      survivor("leader-a", 2, { condition: 90_000, energy: 50_000, supplies: 40_000, survivalTimeMs: 500 }),
      survivor("leader-b", 1, { condition: 90_000, energy: 50_000, supplies: 40_000, survivalTimeMs: 500 }),
    ]);
    expect(ranking).toEqual([
      { runParticipantId: "leader-b", rank: 1, tied: true },
      { runParticipantId: "leader-a", rank: 1, tied: true },
      { runParticipantId: "eliminated", rank: 3, tied: false },
    ]);
  });

  it("is replay deterministic, varies by valid seed and never uses Math.random", () => {
    const source = input({ count: 6, config: { mode: "ENDURANCE", maxTicks: 12, hazardFrequency: 70, variability: 100 } });
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Math.random used"); });
    try {
      expect(complete(source)).toEqual(complete(source));
    } finally {
      random.mockRestore();
    }
    const other = complete(input({ count: 6, seed: "SV-OTHER999", config: { mode: "ENDURANCE", maxTicks: 12, hazardFrequency: 70, variability: 100 } }));
    expect(other.events).not.toEqual(complete(source).events);
  });

  it("avoids module RNG consumption when hazards and variability are disabled", () => {
    const snapshot = input({ config: {
      mode: "ENDURANCE", maxTicks: 2, hazardFrequency: 0, variability: 0,
      recovery: { amount: 0, intervalTicks: 1, energyCost: 0, suppliesCost: 0 },
    } });
    const initialized = initializeEngine(survivalModule, snapshot, 100);
    const context = {
      input: snapshot, tick: 1, simulatedTimeMs: 100, fixedStepMs: 100,
      rng: { nextUint32: () => { throw new Error("unexpected RNG use"); } } as unknown as SeededRng,
    };
    expect(() => survivalModule.evaluateRules(context, initialized.moduleState, {
      type: "survival.advance", actorRunParticipantId: null, targetRunParticipantId: null,
      payloadVersion: 1, payload: { expectedTick: 1 }, sequence: 1, tick: 1,
    })).not.toThrow();
  });

  it("continues identically from serialized state and preserved RNG state", () => {
    const snapshot = input({ count: 4, config: { mode: "ENDURANCE", maxTicks: 20, hazardFrequency: 65, variability: 80 } });
    const initial = initializeEngine(survivalModule, snapshot, 100);
    const first = stepEngine(survivalModule, snapshot, initial, 100, 0, 0);
    const restored = JSON.parse(JSON.stringify(first.state));
    expect(stepEngine(survivalModule, snapshot, restored, 100, 1, first.lastEventSequence))
      .toEqual(stepEngine(survivalModule, snapshot, first.state, 100, 1, first.lastEventSequence));
  });

  it("rejects duplicate participants, invalid cardinality, corrupt action and corrupt state", () => {
    expect(() => initializeEngine(survivalModule, input({ count: 1 }), 100)).toThrow(/at least 2/);
    const duplicate = input();
    duplicate.participants[1] = { ...duplicate.participants[1]!, runParticipantId: duplicate.participants[0]!.runParticipantId };
    expect(() => initializeEngine(survivalModule, duplicate, 100)).toThrow(EngineExecutionError);
    const snapshot = input();
    const state = initializeEngine(survivalModule, snapshot, 100);
    const context = {
      input: snapshot, tick: 1, simulatedTimeMs: 100, fixedStepMs: 100,
      rng: SeededRng.fromSeed(snapshot.resolvedSeed),
    };
    expect(() => survivalModule.evaluateRules(context, state.moduleState, {
      type: "survival.advance", actorRunParticipantId: "participant-0", targetRunParticipantId: null,
      payloadVersion: 1, payload: { expectedTick: 1 }, sequence: 1, tick: 1,
    })).toThrow(EngineExecutionError);
    const corrupted = { ...state, moduleState: { ...survivalStateSchema.parse(state.moduleState), participants: [
      { ...survivalStateSchema.parse(state.moduleState).participants[0], condition: -1 },
      ...survivalStateSchema.parse(state.moduleState).participants.slice(1),
    ] } };
    expect(() => stepEngine(survivalModule, snapshot, corrupted, 100, 0, 0)).toThrow();
  });
});
