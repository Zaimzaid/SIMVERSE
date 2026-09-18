import { describe, expect, it } from "vitest";
import { initializeEngine, stepEngine } from "@/lib/engine/engine";
import { inputSnapshotSchema, type ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import { battleModule } from "@/lib/modules/battle/battle-module";
import { battleResultSchema } from "@/lib/modules/battle/schemas";
import { defaultConfigV1, defaultPresentation } from "@/lib/simulations/config";
import { battleViewerAdapter } from "./battle-adapter";
import { ViewerClock } from "./clock";
import { ViewerAdapterRegistry, productionViewerRegistry } from "./registry";
import { buildArenaScene, visualSource } from "./scene";

function participant(position: number, name: string, imageUrl: string | null = null): ParticipantSnapshotV1 {
  return {
    runParticipantId: `p${position}`, sourceEntityId: `e${position}`, position, role: null, overrides: null,
    name, shortName: null, description: null, category: position ? "Animal" : "Country",
    status: "ACTIVE", imageUrl, primaryColor: position ? "#f97316" : "#22d3ee", secondaryColor: null,
    metadata: null, tags: [], attributes: [],
  };
}

function complete(count = 2, limit = 120) {
  const configuration = defaultConfigV1("battle");
  configuration.mode = { format: count === 2 ? "duel" : "free_for_all" };
  configuration.general.roundLimit = limit;
  const participants = Array.from({ length: count }, (_, index) => participant(index, ["Lion", "Tiger", "Kenya", "Ghana"][index] ?? `Entity ${index}`));
  const input = inputSnapshotSchema.parse({
    version: 1, simulationId: "s1", simulationName: "Viewer test", mode: "battle", configVersion: 1,
    configuration, presentation: defaultPresentation(), resolvedSeed: "SV-ABCD2345", participants,
  });
  let state = initializeEngine(battleModule, input, 100);
  const events: ReturnType<typeof stepEngine>["events"] = [];
  let actionSequence = 0;
  let eventSequence = 0;
  for (let tick = 0; tick < 160; tick += 1) {
    const next = stepEngine(battleModule, input, state, 100, actionSequence, eventSequence);
    state = next.state;
    events.push(...next.events);
    actionSequence = next.lastActionSequence;
    eventSequence = next.lastEventSequence;
    if (next.result) return { participants, events, result: battleResultSchema.parse(next.result.modulePayload) };
  }
  throw new Error("Fixture Battle did not complete.");
}

describe("Viewer registry and scene", () => {
  it("registers only the supported Battle viewer version", () => {
    expect(productionViewerRegistry.forRun("battle", "battle-v1")).toBe(battleViewerAdapter);
    expect(productionViewerRegistry.forRun("battle", "battle-v2")).toBeNull();
    expect(productionViewerRegistry.forRun("race", "race-v1")).toBeNull();
    expect(new ViewerAdapterRegistry([]).forRun("battle", "battle-v1")).toBeNull();
  });
  it("uses immutable visual fields, safe initials, opposite duel and spaced FFA positions", () => {
    const lion = participant(0, "Lion", "https://example.com/lion.png");
    expect(visualSource(lion)).toEqual({ kind: "IMAGE", url: lion.imageUrl });
    expect(visualSource(participant(0, "Lion", "data:image/png;base64,iVBORw0KGgo="))).toMatchObject({ kind: "IMAGE" });
    expect(visualSource(participant(1, "South Africa"))).toEqual({ kind: "FALLBACK", initials: "SA" });
    expect(visualSource(participant(1, "Tiger", "javascript:bad"))).toEqual({ kind: "FALLBACK", initials: "T" });
    const duel = buildArenaScene([lion, participant(1, "Tiger")]);
    expect(duel[0]!.x).toBeLessThan(duel[1]!.x);
    expect(duel.map((entity) => entity.facing)).toEqual([1, -1]);
    const ffa = buildArenaScene(Array.from({ length: 4 }, (_, index) => participant(index, `P${index}`)));
    expect(new Set(ffa.map((entity) => `${entity.x.toFixed(2)},${entity.y.toFixed(2)}`)).size).toBe(4);
  });
});

describe("Battle viewer adapter", () => {
  it("maps a real persisted Battle stream into ordered, grouped cues and exact final health/outcome", () => {
    const fixture = complete();
    const scene = battleViewerAdapter.buildScene(fixture.participants);
    const timeline = battleViewerAdapter.buildTimeline(fixture);
    expect(timeline.cues.map((cue) => cue.sequence)).toEqual(fixture.events.map((event) => event.sequence));
    expect(timeline.cues.map((cue) => cue.kind)).toContain("ATTACK");
    expect(timeline.cues.map((cue) => cue.kind)).toContain("DAMAGE");
    expect(timeline.moments[0]!.cues.length).toBeGreaterThan(1);
    const final = battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, timeline.durationMs);
    expect(final.completed).toBe(true);
    expect(final.winnerId).toBe(fixture.result.winnerRunParticipantId);
    expect(final.tiedIds).toEqual(fixture.result.tiedParticipantIds);
    expect(final.rankingIds).toEqual(fixture.result.ranking);
    for (const metric of fixture.result.participantMetrics) {
      expect(final.participants[metric.runParticipantId]!.health).toBe(metric.health);
      expect(final.participants[metric.runParticipantId]!.eliminated).toBe(!metric.alive);
    }
    const firstDamage = timeline.cues.find((cue) => cue.kind === "DAMAGE")!;
    const before = battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, firstDamage.startMs - 1);
    const after = battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, firstDamage.startMs);
    expect(after.participants[firstDamage.targetId!]!.health).toBe(firstDamage.event.payload.healthAfter);
    expect(before.participants[firstDamage.targetId!]!.health).toBe(firstDamage.event.payload.healthBefore);
  });

  it("represents time-limit outcomes and FFA without inventing eliminations", () => {
    const timeout = complete(4, 2);
    const scene = battleViewerAdapter.buildScene(timeout.participants);
    const timeline = battleViewerAdapter.buildTimeline(timeout);
    const final = battleViewerAdapter.deriveFrame(timeline, scene, timeout.result, timeline.durationMs);
    expect(final.timeout).toBe(true);
    expect(final.completed).toBe(true);
    expect(timeline.cues.some((cue) => cue.kind === "TIMEOUT")).toBe(true);
    expect(Object.values(final.participants).filter((state) => state.eliminated)).toHaveLength(timeout.result.eliminationOrder.length);
    expect(scene).toHaveLength(4);
  });

  it("rebuilds the same initial/final state after seeking or restart and rejects corrupt history", () => {
    const fixture = complete();
    const scene = battleViewerAdapter.buildScene(fixture.participants);
    const timeline = battleViewerAdapter.buildTimeline(fixture);
    const initial = battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, 0);
    const final = battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, timeline.durationMs);
    expect(initial.completed).toBe(false);
    expect(Object.values(initial.participants).every((state) => state.health === 100 && !state.eliminated)).toBe(true);
    expect(battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, timeline.durationMs)).toEqual(final);
    expect(battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, 0)).toEqual(initial);
    const reduced = battleViewerAdapter.deriveFrame(timeline, scene, fixture.result, timeline.moments[0]!.startMs + 400, true);
    expect(reduced.reducedMotion).toBe(true);
    expect(reduced.camera.zoom).toBe(1);
    expect(reduced.camera.shake).toBe(0);
    const badType = { ...fixture, events: fixture.events.map((event, index) => index === 1 ? { ...event, type: "race.lap" } : event) };
    expect(() => battleViewerAdapter.buildTimeline(badType)).toThrow("unsupported or invalid event");
    const badPayload = { ...fixture, events: fixture.events.map((event, index) => index === 1 ? { ...event, payload: {} } : event) };
    expect(() => battleViewerAdapter.buildTimeline(badPayload)).toThrow("unsupported or invalid event");
    const outOfOrder = { ...fixture, events: [...fixture.events].reverse() };
    expect(() => battleViewerAdapter.buildTimeline(outOfOrder)).toThrow("unsupported or invalid event");
    const wrongHealth = { ...fixture, events: fixture.events.map((event) => event.type === "battle.damage"
      ? { ...event, payload: { ...event.payload, healthAfter: 99 } } : event) };
    expect(() => battleViewerAdapter.buildTimeline(wrongHealth)).toThrow("unsupported or invalid event");
  });
});

describe("presentation clock", () => {
  it("applies speed only to wall-time playback, pauses, seeks and restarts", () => {
    const clock = new ViewerClock(2000);
    clock.play(100);
    expect(clock.advance(600)).toBe(500);
    clock.pause();
    expect(clock.advance(1600)).toBe(500);
    clock.setSpeed(2);
    clock.play(1600);
    expect(clock.advance(1850)).toBe(1000);
    clock.setSpeed(0.5);
    expect(clock.advance(2050)).toBe(1100);
    clock.seek(1750, 2050);
    expect(clock.advance(2550)).toBe(2000);
    expect(clock.isPlaying).toBe(false);
    clock.restart();
    expect(clock.position).toBe(0);
    expect(() => clock.setSpeed(3)).toThrow();
  });
});
