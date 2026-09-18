import { describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/errors";
import { defaultConfigV1, defaultPresentation } from "@/lib/simulations/config";
import { assertRunTransition } from "./constants";
import { nextClock } from "./clock";
import { initializeEngine, stepEngine } from "./engine";
import { SeededRng } from "./rng";
import { engineStateSchema, inputSnapshotSchema, type InputSnapshotV1 } from "./schemas";
import { deterministicTestModule } from "../../../test/fixtures/deterministic-engine-module";

function input(seed = "SV-ABCD2345"): InputSnapshotV1 {
  return inputSnapshotSchema.parse({
    version: 1,
    simulationId: "simulation-1",
    simulationName: "Generic sequence",
    mode: "test-sequence",
    configVersion: 1,
    configuration: defaultConfigV1("test-sequence"),
    presentation: defaultPresentation(),
    resolvedSeed: seed,
    participants: ["one", "two"].map((id, position) => ({
      runParticipantId: id, sourceEntityId: `source-${id}`, position,
      role: null, overrides: null, name: id, shortName: null,
      description: null, category: "object", status: "ACTIVE", imageUrl: null,
      primaryColor: null, secondaryColor: null, metadata: null, tags: [], attributes: [],
    })),
  });
}

function run(seed = "SV-ABCD2345") {
  const snapshot = input(seed);
  let state = initializeEngine(deterministicTestModule, snapshot, 100);
  let actionSequence = 0;
  let eventSequence = 0;
  const actions = [];
  const events = [];
  let result = null;
  for (let i = 0; i < 3; i += 1) {
    const step = stepEngine(deterministicTestModule, snapshot, state, 100, actionSequence, eventSequence);
    state = step.state;
    actionSequence = step.lastActionSequence;
    eventSequence = step.lastEventSequence;
    actions.push(...step.actions);
    events.push(...step.events);
    result = step.result;
  }
  return { state, actions, events, result };
}

describe("Phase 3 pure Core", () => {
  it("produces the same RNG sequence for the same seed and a different one for a different seed", () => {
    const take = (seed: string) => {
      const rng = SeededRng.fromSeed(seed);
      return [rng.nextUint32(), rng.nextUint32(), rng.nextUint32()];
    };
    expect(take("SV-ABCD2345")).toEqual(take("SV-ABCD2345"));
    expect(take("SV-ABCD2345")).not.toEqual(take("SV-WXYZ6789"));
  });

  it("resumes the RNG sequence from serialized state", () => {
    const original = SeededRng.fromSeed("SV-ABCD2345");
    original.nextUint32();
    const restored = new SeededRng(JSON.parse(JSON.stringify(original.snapshot())));
    expect(restored.nextUint32()).toBe(original.nextUint32());
    expect(restored.nextUint32()).toBe(original.nextUint32());
  });

  it("advances an integer simulation clock independent of wall time", () => {
    expect(nextClock(0, 100)).toEqual({ tick: 1, simulatedTimeMs: 100, fixedStepMs: 100 });
    expect(nextClock(2, 100)).toEqual({ tick: 3, simulatedTimeMs: 300, fixedStepMs: 100 });
  });

  it("accepts legal lifecycle transitions and rejects terminal or duplicate transitions", () => {
    expect(() => assertRunTransition("CREATED", "RUNNING")).not.toThrow();
    expect(() => assertRunTransition("RUNNING", "PAUSED")).not.toThrow();
    expect(() => assertRunTransition("PAUSED", "RUNNING")).not.toThrow();
    expect(() => assertRunTransition("RUNNING", "COMPLETED")).not.toThrow();
    expect(() => assertRunTransition("RUNNING", "FAILED")).not.toThrow();
    expect(() => assertRunTransition("RUNNING", "CANCELLED")).not.toThrow();
    expect(() => assertRunTransition("PAUSED", "CANCELLED")).not.toThrow();
    expect(() => assertRunTransition("CREATED", "CANCELLED")).not.toThrow();
    for (const [from, to] of [
      ["CREATED", "PAUSED"], ["RUNNING", "RUNNING"],
      ["COMPLETED", "RUNNING"], ["CANCELLED", "PAUSED"],
    ] as const) {
      expect(() => assertRunTransition(from, to)).toThrow(ConflictError);
    }
  });

  it("replays identical actions, events, state and result from the same snapshot and seed", () => {
    const first = run();
    const second = run();
    expect(second).toEqual(first);
    expect(first.actions.map((action) => action.sequence)).toEqual([1, 2, 3]);
    expect(first.events.map((event) => [event.sequence, event.tick, event.simulatedTimeMs]))
      .toEqual([[1, 1, 100], [2, 2, 200], [3, 3, 300]]);
    expect(first.events[0]?.actorRunParticipantId).toBe("one");
    expect(first.result?.version).toBe(1);
  });

  it("changes deterministic output when the seed changes", () => {
    expect(run("SV-WXYZ6789").result).not.toEqual(run("SV-ABCD2345").result);
  });

  it("does not use Math.random for execution", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Math.random used"); });
    try {
      expect(run().state.tick).toBe(3);
    } finally {
      random.mockRestore();
    }
  });

  it("continues from a serialized state with the same output", () => {
    const snapshot = input();
    const initial = initializeEngine(deterministicTestModule, snapshot, 100);
    const first = stepEngine(deterministicTestModule, snapshot, initial, 100, 0, 0);
    const restored = engineStateSchema.parse(JSON.parse(JSON.stringify(first.state)));
    const next = stepEngine(deterministicTestModule, snapshot, restored, 100, 1, 1);
    const direct = stepEngine(deterministicTestModule, snapshot, first.state, 100, 1, 1);
    expect(next).toEqual(direct);
  });

  it("rejects malformed or unversioned persisted state", () => {
    const state = initializeEngine(deterministicTestModule, input(), 100);
    expect(engineStateSchema.safeParse({ ...state, version: 2 }).success).toBe(false);
    expect(engineStateSchema.safeParse({ ...state, moduleState: { callback: () => 1 } }).success).toBe(false);
  });
});
