import { describe, expect, it } from "vitest";
import { initializeEngine, stepEngine } from "@/lib/engine/engine";
import { EngineExecutionError } from "@/lib/engine/module";
import { productionEngineRegistry } from "@/lib/engine/registry";
import { SeededRng } from "@/lib/engine/rng";
import { inputSnapshotSchema, type InputSnapshotV1, type ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import { defaultConfigV1, defaultPresentation } from "@/lib/simulations/config";
import { battleModule, battleStanding } from "./battle-module";
import { battleExecutionIssue, MAX_BATTLE_TICKS } from "./config";
import { battleStateSchema, type BattleParticipantStateV1 } from "./schemas";
import { chooseTarget, criticalProbability, dodgeProbability, initiativeOrder, resolveAttack, shouldDefend } from "./rules";
import { resolveBattleProfile } from "./stats";

function participant(position: number, category = "object", values: Record<string, number> = {}): ParticipantSnapshotV1 {
  return {
    runParticipantId: `participant-${position}`, sourceEntityId: `entity-${position}`, position,
    role: null, overrides: null, name: `Entity ${position}`, shortName: null,
    description: null, category, status: "ACTIVE", imageUrl: null, primaryColor: null,
    secondaryColor: null, metadata: null, tags: [],
    attributes: Object.entries(values).map(([key, value]) => ({
      definitionId: `definition-${key}`, key, name: key.toUpperCase(), description: null,
      dataType: "NUMBER", unit: null, minimum: null, maximum: null, options: null,
      defaultValue: null, isBuiltIn: true, value: String(value),
    })),
  };
}

function input(options: {
  seed?: string; format?: string; count?: number; limit?: number | null;
  categories?: string[]; profiles?: Record<string, number>[]; allowTies?: boolean;
} = {}): InputSnapshotV1 {
  const configuration = defaultConfigV1("battle");
  configuration.mode = { format: options.format ?? "duel" };
  configuration.general.roundLimit = options.limit ?? null;
  configuration.general.allowTies = options.allowTies ?? false;
  return inputSnapshotSchema.parse({
    version: 1, simulationId: "simulation-1", simulationName: "Battle", mode: "battle",
    configVersion: 1, configuration, presentation: defaultPresentation(),
    resolvedSeed: options.seed ?? "SV-ABCD2345",
    participants: Array.from({ length: options.count ?? 2 }, (_, index) =>
      participant(index, options.categories?.[index], options.profiles?.[index])),
  });
}

function complete(snapshot: InputSnapshotV1) {
  let state = initializeEngine(battleModule, snapshot, 100);
  const actions: ReturnType<typeof stepEngine>["actions"] = [];
  const events: ReturnType<typeof stepEngine>["events"] = [];
  let result: ReturnType<typeof stepEngine>["result"] = null;
  let actionSequence = 0;
  let eventSequence = 0;
  for (let tick = 0; tick < MAX_BATTLE_TICKS; tick += 1) {
    const next = stepEngine(battleModule, snapshot, state, 100, actionSequence, eventSequence);
    state = next.state;
    actions.push(...next.actions);
    events.push(...next.events);
    actionSequence = next.lastActionSequence;
    eventSequence = next.lastEventSequence;
    if (next.result) { result = next.result; break; }
  }
  expect(result).not.toBeNull();
  return { state, actions, events, result: result! };
}

function fighter(id: string, position: number, values: Record<string, number> = {}): BattleParticipantStateV1 {
  return {
    runParticipantId: id, position, profile: { strength: 50, defense: 50, speed: 50, intelligence: 50, luck: 50, ...values },
    health: 100, alive: true, defending: false, eliminationTick: null, damageDealt: 0,
    damageReceived: 0, attacksAttempted: 0, attacksLanded: 0, criticalHits: 0, dodges: 0, defends: 0,
  };
}

function rolls(...values: number[]) {
  let index = 0;
  return { nextFloat: () => values[index++] ?? 0.5 };
}

describe("production Battle v1", () => {
  it("keeps Battle registered beside Race while unfinished modules remain unavailable", () => {
    expect(productionEngineRegistry.forMode("battle")).toBe(battleModule);
    expect(productionEngineRegistry.canExecute("race")).toBe(true);
    expect(productionEngineRegistry.canExecute("survival")).toBe(true);
    expect(productionEngineRegistry.canExecute("tournament")).toBe(false);
  });

  it("resolves stable snapshot keys, defaults missing stats and clamps imported numbers", () => {
    const source = participant(0, "country", { strength: 130.6, speed: -5.2, luck: 22.6 });
    expect(resolveBattleProfile(source)).toEqual({ strength: 100, defense: 50, speed: 0, intelligence: 50, luck: 23 });
    expect(source.attributes[0]?.value).toBe("130.6");
    const bad = { ...source, attributes: [{ ...source.attributes[0]!, dataType: "TEXT" }] };
    expect(() => resolveBattleProfile(bad)).toThrow("Battle participant stat is invalid");
    expect(() => resolveBattleProfile({ ...source, attributes: [...source.attributes, source.attributes[0]!] })).toThrow();
  });

  it("executes duel and free-for-all through Core with structured history and rankings", () => {
    for (const [format, count] of [["duel", 2], ["free_for_all", 4]] as const) {
      const run = complete(input({ format, count, categories: ["country", "robot", "animal", "custom"] }));
      const result = run.result.modulePayload;
      expect(run.result.resultType).toBe("battle.result");
      expect(result.format).toBe(format);
      expect(result.ranking).toHaveLength(count);
      expect(new Set(result.ranking as string[]).size).toBe(count);
      expect(run.actions.length).toBe(run.state.tick);
      expect(run.events[0]?.type).toBe("battle.started");
      expect(run.events.at(-1)?.type).toBe("battle.completed");
      expect(run.events.some((event) => event.type === "battle.damage")).toBe(true);
      expect(run.state.tick).toBeLessThanOrEqual(MAX_BATTLE_TICKS);
    }
  });

  it("rejects unsupported team and wrong duel counts before persistence", () => {
    expect(battleExecutionIssue("team", 2)).toMatch(/not supported/);
    expect(() => initializeEngine(battleModule, input({ format: "team" }), 100)).toThrow(/Team Battle/);
    expect(() => initializeEngine(battleModule, input({ format: "duel", count: 3 }), 100)).toThrow(/exactly two/);
    expect(() => initializeEngine(battleModule, input({ format: "free_for_all", count: 1 }), 100)).toThrow(/at least two/);
  });

  it("uses a finite time limit and honest timeout ranking or tie", () => {
    const run = complete(input({ limit: 1, allowTies: true }));
    const result = run.result.modulePayload;
    expect(run.state.tick).toBe(1);
    expect(result.completionReason).toBe("TIME_LIMIT");
    expect(run.events.map((event) => event.type)).toContain("battle.timeout");
    expect(run.result.summary).toMatch(/time-limit|time expires/);
    const state = battleStateSchema.parse(run.state.moduleState);
    const tied = battleStanding({ ...state, participants: state.participants.map((fighter) => ({
      ...fighter, health: 100, damageDealt: 0,
    })) });
    expect(tied.winnerRunParticipantId).toBeNull();
    expect(tied.tiedParticipantIds).toHaveLength(2);
  });

  it("replays identical snapshots and seeds, while changed seeds can alter progression", () => {
    const source = input({ count: 3, format: "free_for_all" });
    const first = complete(source);
    const second = complete(source);
    expect(second).toEqual(first);
    const other = complete(input({ count: 3, format: "free_for_all", seed: "SV-XYZW9876" }));
    expect(other.actions).not.toEqual(first.actions);
  });

  it("eliminates at zero health and never schedules an eliminated actor again", () => {
    const run = complete(input({ profiles: [{ strength: 100, speed: 100 }, { defense: 0, speed: 0 }] }));
    const elimination = run.events.find((event) => event.type === "battle.eliminated");
    expect(elimination).toBeDefined();
    const loser = elimination!.targetRunParticipantId;
    expect(run.actions.filter((action) => action.tick > elimination!.tick).every((action) => action.actorRunParticipantId !== loser)).toBe(true);
    expect(run.result.modulePayload.completionReason).toBe("KNOCKOUT");
    expect(run.result.modulePayload.winnerRunParticipantId).not.toBe(loser);
  });

  it("bounds damage, dodge and critical chances, and applies one-hit guard", () => {
    const attacker = fighter("attacker", 0, { strength: 100, speed: 0, intelligence: 100, luck: 100 });
    const defender = fighter("defender", 1, { defense: 0, speed: 100, luck: 100 });
    expect(dodgeProbability(attacker, defender)).toBeLessThanOrEqual(0.22);
    expect(criticalProbability(attacker)).toBeLessThanOrEqual(0.16);
    expect(resolveAttack(attacker, defender, rolls(0, 0, 0.5)).dodged).toBe(true);
    const critical = resolveAttack(attacker, defender, rolls(0.9, 0, 0.5));
    expect(critical.critical).toBe(true);
    expect(critical.finalDamage).toBeGreaterThan(critical.baseDamage);
    defender.defending = true;
    const guarded = resolveAttack(attacker, defender, rolls(0.9, 0.9, 0.5));
    defender.defending = false;
    const unguarded = resolveAttack(attacker, defender, rolls(0.9, 0.9, 0.5));
    expect(guarded.finalDamage).toBe(Math.ceil(unguarded.finalDamage / 2));
    expect(unguarded.finalDamage).toBeGreaterThanOrEqual(2);
    expect(unguarded.finalDamage).toBeLessThanOrEqual(28);
  });

  it("changes attack outcomes with strength, defense and intelligence", () => {
    const weak = fighter("weak", 0, { strength: 0, intelligence: 0 });
    const strong = fighter("strong", 0, { strength: 100, intelligence: 100 });
    const open = fighter("open", 1, { defense: 0 });
    const armored = fighter("armored", 1, { defense: 100 });
    expect(resolveAttack(strong, open, rolls(0.9, 0.9, 0.5)).finalDamage)
      .toBeGreaterThan(resolveAttack(weak, open, rolls(0.9, 0.9, 0.5)).finalDamage);
    expect(resolveAttack(strong, armored, rolls(0.9, 0.9, 0.5)).finalDamage)
      .toBeLessThan(resolveAttack(strong, open, rolls(0.9, 0.9, 0.5)).finalDamage);
    expect(criticalProbability(strong)).toBeGreaterThan(criticalProbability(weak));
  });

  it("rejects invalid targets and corrupt Battle state through Core validation", () => {
    const snapshot = input();
    const state = initializeEngine(battleModule, snapshot, 100);
    const battleState = battleStateSchema.parse(state.moduleState);
    const actor = battleState.turnQueue[0]!;
    const context = { input: snapshot, tick: 1, simulatedTimeMs: 100, fixedStepMs: 100,
      rng: SeededRng.fromSeed(snapshot.resolvedSeed) };
    expect(() => battleModule.evaluateRules(context, state.moduleState, {
      type: "battle.attack", actorRunParticipantId: actor, targetRunParticipantId: "foreign",
      payloadVersion: 1, payload: { decision: "attack" }, sequence: 1, tick: 1,
    })).toThrow(EngineExecutionError);
    const corrupted = { ...state, moduleState: { ...battleState, participants: [
      { ...battleState.participants[0], health: -1 }, ...battleState.participants.slice(1),
    ] } };
    expect(() => stepEngine(battleModule, snapshot, corrupted, 100, 0, 0)).toThrow();
  });

  it("consumes a defended guard on one landed hit", () => {
    const snapshot = input();
    const state = initializeEngine(battleModule, snapshot, 100);
    const battleState = battleStateSchema.parse(state.moduleState);
    const defender = battleState.participants[0]!;
    const attacker = battleState.participants[1]!;
    defender.defending = true;
    battleState.turnQueue = [attacker.runParticipantId, defender.runParticipantId];
    const evaluated = battleModule.evaluateRules({ input: snapshot, tick: 2, simulatedTimeMs: 200,
      fixedStepMs: 100, rng: rolls(0.9, 0.9, 0.5) as unknown as SeededRng }, battleState, {
      type: "battle.attack", actorRunParticipantId: attacker.runParticipantId,
      targetRunParticipantId: defender.runParticipantId, payloadVersion: 1,
      payload: { decision: "attack" }, sequence: 1, tick: 2,
    });
    const after = battleStateSchema.parse(evaluated.state);
    expect(after.participants[0]?.defending).toBe(false);
    expect(evaluated.events.find((event) => event.type === "battle.damage")?.payload.guarded).toBe(true);
  });

  it("uses speed for initiative, state and seeded jitter for targets, and intelligence for defend", () => {
    const fighters = [fighter("slow", 0, { speed: 0 }), fighter("fast", 1, { speed: 100 })];
    expect(initiativeOrder(fighters, rolls(0.5, 0.5))).toEqual(["fast", "slow"]);
    const actor = fighter("actor", 0, { intelligence: 100 });
    const healthy = fighter("healthy", 1);
    const weak = { ...fighter("weak", 2), health: 10 };
    expect(chooseTarget(actor, [actor, healthy, weak], rolls(0.5, 0.5))?.runParticipantId).toBe("weak");
    expect(shouldDefend({ ...actor, health: 30 }, rolls(0.2))).toBe(true);
    expect(shouldDefend({ ...actor, health: 100 }, rolls(0.2))).toBe(false);
    expect(initiativeOrder(fighters, SeededRng.fromSeed("SV-ABCD2345"))).toEqual(
      initiativeOrder(fighters, SeededRng.fromSeed("SV-ABCD2345")),
    );
  });
});
