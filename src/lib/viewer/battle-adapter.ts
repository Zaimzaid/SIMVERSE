import type { EngineEvent } from "@/lib/engine/schemas";
import { BATTLE_MODULE_ID, BATTLE_MODULE_VERSION } from "@/lib/modules/battle/config";
import { battleEventPayloads, battleResultSchema, type BattleResultV1 } from "@/lib/modules/battle/schemas";
import { buildArenaScene } from "./scene";
import type { CueKind, SimulationViewerAdapter, ViewerCue, ViewerFrame, ViewerInput, ViewerMoment, ViewerTimeline, VisualEntityInstance, VisualParticipantState } from "./types";

const INTRO_MS = 1900;
const ACTION_MS = 1080;
const END_MS = 2100;

const eventKinds: Record<keyof typeof battleEventPayloads, CueKind> = {
  "battle.started": "START", "battle.defend": "DEFEND", "battle.attack": "ATTACK",
  "battle.dodged": "DODGE", "battle.critical_hit": "CRITICAL", "battle.damage": "DAMAGE",
  "battle.eliminated": "ELIMINATE", "battle.timeout": "TIMEOUT", "battle.completed": "COMPLETE",
};
const offsets: Record<CueKind, number> = {
  START: 0, DEFEND: 0.15, ATTACK: 0.12, DODGE: 0.53, CRITICAL: 0.51,
  DAMAGE: 0.62, ELIMINATE: 0.76, TIMEOUT: 0.82, COMPLETE: 0.9,
};

function invalid(): never { throw new Error("This replay contains an unsupported or invalid event."); }

function parseResult(raw: unknown): BattleResultV1 {
  const parsed = battleResultSchema.safeParse(raw);
  if (!parsed.success) invalid();
  return parsed.data;
}

function parseEvents(events: EngineEvent[], ids: Set<string>, result: BattleResultV1): EngineEvent[] {
  if (events.length < 2 || events[0]?.type !== "battle.started" || events.at(-1)?.type !== "battle.completed") invalid();
  let lastTick = 0;
  let lastTime = -1;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]!;
    const schema = battleEventPayloads[event.type as keyof typeof battleEventPayloads];
    if (!schema || event.payloadVersion !== 1 || !schema.schema.safeParse(event.payload).success ||
        event.sequence !== i + 1 || event.tick < lastTick || event.simulatedTimeMs < lastTime ||
        (event.actorRunParticipantId && !ids.has(event.actorRunParticipantId)) ||
        (event.targetRunParticipantId && !ids.has(event.targetRunParticipantId))) invalid();
    lastTick = event.tick;
    lastTime = event.simulatedTimeMs;
  }
  const started = events[0].payload;
  const completed = events.at(-1)!.payload;
  if (started.format !== result.format || !Array.isArray(started.participantIds) ||
      started.participantIds.length !== ids.size || started.participantIds.some((id) => !ids.has(id as string)) ||
      events.filter((event) => event.type === "battle.started").length !== 1 ||
      events.filter((event) => event.type === "battle.completed").length !== 1 ||
      events.filter((event) => event.type === "battle.timeout").length !== (result.completionReason === "TIME_LIMIT" ? 1 : 0) ||
      completed.completionReason !== result.completionReason ||
      completed.winnerRunParticipantId !== result.winnerRunParticipantId ||
      JSON.stringify(completed.ranking) !== JSON.stringify(result.ranking) ||
      JSON.stringify(completed.tiedParticipantIds) !== JSON.stringify(result.tiedParticipantIds) ||
      events.at(-1)?.tick !== result.totalTicks ||
      result.ranking.length !== ids.size || new Set(result.ranking).size !== ids.size ||
      result.ranking.some((id) => !ids.has(id)) ||
      result.participantMetrics.length !== ids.size) invalid();
  return events;
}

function buildTimeline(input: ViewerInput): ViewerTimeline {
  const result = parseResult(input.result);
  const ids = new Set(input.participants.map((participant) => participant.runParticipantId));
  if (ids.size < 2 || ids.size !== input.participants.length) invalid();
  const events = parseEvents(input.events, ids, result);
  const groups = new Map<number, EngineEvent[]>();
  for (const event of events) {
    const group = groups.get(event.tick) ?? [];
    group.push(event);
    groups.set(event.tick, group);
  }
  const moments: ViewerMoment[] = [];
  const cues: ViewerCue[] = [];
  let cursor = INTRO_MS;
  for (const [tick, group] of groups) {
    const isFinal = group.some((event) => event.type === "battle.completed");
    const durationMs = isFinal ? END_MS : ACTION_MS;
    const momentCues: ViewerCue[] = group.map((event) => {
      const kind = eventKinds[event.type as keyof typeof eventKinds];
      const cue: ViewerCue = {
        sequence: event.sequence, tick, simulatedTimeMs: event.simulatedTimeMs,
        startMs: cursor + offsets[kind] * ACTION_MS,
        durationMs: kind === "COMPLETE" ? END_MS - offsets[kind] * ACTION_MS : ACTION_MS * 0.35,
        kind, actorId: event.actorRunParticipantId, targetId: event.targetRunParticipantId, event,
      };
      return cue;
    });
    moments.push({ tick, startMs: cursor, durationMs, cues: momentCues });
    cues.push(...momentCues);
    cursor += durationMs;
  }
  const timeline = { introMs: INTRO_MS, durationMs: cursor, moments, cues };
  const final = deriveFrame(timeline, buildArenaScene(input.participants), result, timeline.durationMs);
  if (result.participantMetrics.some((metric) => {
    const state = final.participants[metric.runParticipantId];
    return !state || state.health !== metric.health || state.eliminated === metric.alive;
  })) invalid();
  return timeline;
}

function name(scene: VisualEntityInstance[], id: string | null): string {
  return scene.find((entity) => entity.id === id)?.name ?? "Participant";
}

function caption(cue: ViewerCue, scene: VisualEntityInstance[], result: BattleResultV1): string {
  switch (cue.kind) {
    case "START": return "Battle begins";
    case "DEFEND": return `${name(scene, cue.actorId)} takes a defensive stance`;
    case "ATTACK": return `${name(scene, cue.actorId)} attacks ${name(scene, cue.targetId)}`;
    case "DODGE": return `${name(scene, cue.targetId)} dodges!`;
    case "CRITICAL": return `Critical hit by ${name(scene, cue.actorId)}!`;
    case "DAMAGE": return `${name(scene, cue.targetId)} takes ${cue.event.payload.amount} damage`;
    case "ELIMINATE": return `${name(scene, cue.targetId)} eliminated!`;
    case "TIMEOUT": return "Time limit reached";
    case "COMPLETE": return result.completionReason === "TIME_LIMIT"
      ? result.tiedParticipantIds.length > 1 ? "Time limit · Draw" : "Time limit · Final standings"
      : `Winner · ${name(scene, result.winnerRunParticipantId)}`;
  }
}

function deriveFrame(timeline: ViewerTimeline, scene: VisualEntityInstance[], rawResult: unknown, timeMs: number, reducedMotion = false): ViewerFrame {
  const result = parseResult(rawResult);
  const at = Math.max(0, Math.min(timeline.durationMs, timeMs));
  const participants: Record<string, VisualParticipantState> = {};
  for (const entity of scene) participants[entity.id] = { health: 100, defending: false, eliminated: false };
  let completed = false;
  let timeout = false;
  let latest: ViewerCue | null = null;
  for (const cue of timeline.cues) {
    if (cue.startMs > at) break;
    latest = cue;
    const actor = cue.actorId ? participants[cue.actorId] : null;
    const target = cue.targetId ? participants[cue.targetId] : null;
    if (cue.kind === "DEFEND" && actor) actor.defending = true;
    if (cue.kind === "ATTACK" && actor) actor.defending = false;
    if (cue.kind === "DAMAGE" && target) {
      target.health = Math.max(0, Number(cue.event.payload.healthAfter));
      if (cue.event.payload.guarded) target.defending = false;
    }
    if (cue.kind === "ELIMINATE" && target) { target.eliminated = true; target.defending = false; }
    if (cue.kind === "TIMEOUT") timeout = true;
    if (cue.kind === "COMPLETE") completed = true;
  }
  const activeMoment = timeline.moments.find((moment) => at >= moment.startMs && at < moment.startMs + moment.durationMs) ?? null;
  const progress = activeMoment ? (at - activeMoment.startMs) / activeMoment.durationMs : 0;
  const attack = activeMoment?.cues.find((cue) => cue.kind === "ATTACK");
  const defend = activeMoment?.cues.find((cue) => cue.kind === "DEFEND");
  const focus = attack ?? defend;
  const actorEntity = scene.find((entity) => entity.id === focus?.actorId);
  const targetEntity = scene.find((entity) => entity.id === focus?.targetId);
  const cameraX = actorEntity && targetEntity ? (actorEntity.x + targetEntity.x) / 2 : actorEntity?.x ?? 0.5;
  const cameraY = actorEntity && targetEntity ? (actorEntity.y + targetEntity.y) / 2 : actorEntity?.y ?? 0.5;
  const impact = activeMoment?.cues.some((cue) => (cue.kind === "DAMAGE" || cue.kind === "CRITICAL") &&
    at >= cue.startMs && at < cue.startMs + 190) ?? false;
  const focusStrength = focus && !reducedMotion ? Math.sin(Math.PI * Math.min(1, progress)) : 0;
  return {
    timeMs: at, reducedMotion, tick: activeMoment?.tick ?? (at >= timeline.durationMs ? result.totalTicks : 0),
    activeMoment, progress, participants, completed, timeout,
    caption: latest ? caption(latest, scene, result) : "Entering SIMVERSE Arena",
    winnerId: completed ? result.winnerRunParticipantId : null,
    tiedIds: completed ? result.tiedParticipantIds : [],
    rankingIds: completed ? result.ranking : [],
    completionReason: completed ? result.completionReason : null,
    camera: {
      x: 0.5 + (cameraX - 0.5) * focusStrength * (scene.length > 2 ? 0.27 : 0.5),
      y: 0.5 + (cameraY - 0.5) * focusStrength * 0.4,
      zoom: 1 + focusStrength * (scene.length > 2 ? 0.07 : 0.15),
      shake: impact && !reducedMotion ? Math.sin(at * 0.26) * 0.005 : 0,
    },
  };
}

export const battleViewerAdapter: SimulationViewerAdapter = {
  moduleId: BATTLE_MODULE_ID,
  moduleVersions: [BATTLE_MODULE_VERSION],
  buildScene: buildArenaScene,
  buildTimeline,
  deriveFrame,
};
