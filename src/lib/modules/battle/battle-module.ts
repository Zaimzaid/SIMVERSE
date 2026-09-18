import { EngineExecutionError, type EngineModule, type ProposedEnvelope } from "@/lib/engine/module";
import type { EngineAction, JsonRecord } from "@/lib/engine/schemas";
import {
  BATTLE_MAX_HEALTH, BATTLE_MODULE_ID, BATTLE_MODULE_VERSION, BATTLE_RESULT_VERSION,
  BATTLE_STATE_VERSION, resolveBattleExecutionConfig,
} from "./config";
import {
  battleActionPayloads, battleEventPayloads, battleResultPayloads,
  battleResultSchema, battleStateSchema,
  type BattleParticipantStateV1, type BattleStateV1,
} from "./schemas";
import { chooseTarget, initiativeOrder, resolveAttack, shouldDefend } from "./rules";
import { resolveBattleProfile } from "./stats";

function invalidAction(): never {
  throw new EngineExecutionError("INVALID_MODULE_OUTPUT", "Battle action or target is invalid.");
}

interface BattleStanding {
  ranking: string[];
  winnerRunParticipantId: string | null;
  tiedParticipantIds: string[];
}

/** Knockout: survivor, then reverse elimination order. Timeout: living by health/damage/position. */
export function battleStanding(state: BattleStateV1): BattleStanding {
  const alive = state.participants.filter((participant) => participant.alive).sort(
    (a, b) => b.health - a.health || b.damageDealt - a.damageDealt || a.position - b.position,
  );
  const ranking = [...alive.map((participant) => participant.runParticipantId), ...[...state.eliminationOrder].reverse()];
  if (state.completionReason === "KNOCKOUT") {
    return { ranking, winnerRunParticipantId: alive[0]?.runParticipantId ?? null, tiedParticipantIds: [] };
  }
  const first = alive[0];
  if (!first) return { ranking, winnerRunParticipantId: null, tiedParticipantIds: [] };
  const tied = alive.filter((participant) =>
    participant.health === first.health && participant.damageDealt === first.damageDealt,
  ).map((participant) => participant.runParticipantId);
  return state.config.allowTies && tied.length > 1
    ? { ranking, winnerRunParticipantId: null, tiedParticipantIds: tied }
    : { ranking, winnerRunParticipantId: first.runParticipantId, tiedParticipantIds: [] };
}

function living(state: BattleStateV1): BattleParticipantStateV1[] {
  return state.participants.filter((participant) => participant.alive);
}

function event(
  type: keyof typeof battleEventPayloads, payload: JsonRecord,
  actorRunParticipantId: string | null = null, targetRunParticipantId: string | null = null,
): ProposedEnvelope {
  return { type, payloadVersion: 1, payload, actorRunParticipantId, targetRunParticipantId };
}

/** A single selected participant acts per Core tick, so at most one elimination can occur per tick. */
export const battleModule: EngineModule = {
  mode: "battle",
  id: BATTLE_MODULE_ID,
  version: BATTLE_MODULE_VERSION,
  stateSchema: battleStateSchema,
  actionPayloads: battleActionPayloads,
  eventPayloads: battleEventPayloads,
  resultPayloads: battleResultPayloads,

  initialize(context) {
    const config = resolveBattleExecutionConfig(context.input);
    const participants = context.input.participants.map((source) => ({
      runParticipantId: source.runParticipantId,
      position: source.position,
      profile: resolveBattleProfile(source),
      health: BATTLE_MAX_HEALTH,
      alive: true,
      defending: false,
      eliminationTick: null,
      damageDealt: 0,
      damageReceived: 0,
      attacksAttempted: 0,
      attacksLanded: 0,
      criticalHits: 0,
      dodges: 0,
      defends: 0,
    }));
    if (new Set(participants.map((participant) => participant.runParticipantId)).size !== participants.length) {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "Battle participant snapshot is invalid.");
    }
    return battleStateSchema.parse({
      version: BATTLE_STATE_VERSION,
      config,
      round: 1,
      turnQueue: initiativeOrder(participants, context.rng),
      participants,
      eliminationOrder: [],
      completionReason: null,
    });
  },

  planActions(context, rawState) {
    const state = battleStateSchema.parse(rawState);
    if (state.completionReason) return [];
    const actorId = state.turnQueue[0];
    const actor = state.participants.find((participant) => participant.runParticipantId === actorId && participant.alive);
    if (!actor) return invalidAction();
    if (shouldDefend(actor, context.rng)) {
      return [{ type: "battle.defend", actorRunParticipantId: actorId, payloadVersion: 1,
        payload: { reason: actor.health <= 40 ? "low_health" : "tactical" } }];
    }
    const target = chooseTarget(actor, state.participants, context.rng);
    if (!target) return invalidAction();
    return [{ type: "battle.attack", actorRunParticipantId: actorId,
      targetRunParticipantId: target.runParticipantId, payloadVersion: 1,
      payload: { decision: "attack" } }];
  },

  evaluateRules(context, rawState, action: EngineAction) {
    const state = battleStateSchema.parse(rawState);
    if (state.completionReason || state.turnQueue[0] !== action.actorRunParticipantId) return invalidAction();
    const actor = state.participants.find((participant) => participant.runParticipantId === action.actorRunParticipantId);
    if (!actor?.alive) return invalidAction();
    const events: ProposedEnvelope[] = [];
    if (context.tick === 1) {
      events.push(event("battle.started", { format: state.config.format, maxTicks: state.config.maxTicks,
        participantIds: state.participants.map((participant) => participant.runParticipantId) }));
    }
    // A guard expires at this participant's next action if it was not consumed by a hit.
    actor.defending = false;
    if (action.type === "battle.defend") {
      if (action.targetRunParticipantId) return invalidAction();
      actor.defending = true;
      actor.defends += 1;
      events.push(event("battle.defend", { health: actor.health, duration: "until_next_action_or_hit" }, actor.runParticipantId));
    } else if (action.type === "battle.attack") {
      const target = state.participants.find((participant) => participant.runParticipantId === action.targetRunParticipantId);
      if (!target?.alive || target.runParticipantId === actor.runParticipantId) return invalidAction();
      const before = target.health;
      const outcome = resolveAttack(actor, target, context.rng);
      actor.attacksAttempted += 1;
      if (outcome.dodged) target.dodges += 1;
      else {
        actor.attacksLanded += 1;
        if (outcome.critical) actor.criticalHits += 1;
        target.health = Math.max(0, before - outcome.finalDamage);
        target.damageReceived += before - target.health;
        actor.damageDealt += before - target.health;
        if (outcome.guarded) target.defending = false;
      }
      const actorId = actor.runParticipantId;
      const targetId = target.runParticipantId;
      events.push(event("battle.attack", {
        baseDamage: outcome.baseDamage, critical: outcome.critical, dodged: outcome.dodged,
        guarded: outcome.guarded, finalDamage: before - target.health,
        targetHealthBefore: before, targetHealthAfter: target.health,
      }, actorId, targetId));
      if (outcome.dodged) events.push(event("battle.dodged", { targetHealth: target.health }, actorId, targetId));
      else {
        if (outcome.critical) events.push(event("battle.critical_hit", { finalDamage: before - target.health }, actorId, targetId));
        events.push(event("battle.damage", { amount: before - target.health, healthBefore: before,
          healthAfter: target.health, guarded: outcome.guarded }, actorId, targetId));
        if (target.health === 0) {
          target.alive = false;
          target.defending = false;
          target.eliminationTick = context.tick;
          state.eliminationOrder.push(targetId);
          events.push(event("battle.eliminated", { eliminationTick: context.tick,
            eliminationRank: state.eliminationOrder.length }, actorId, targetId));
        }
      }
    } else return invalidAction();

    state.turnQueue = state.turnQueue.slice(1).filter((id) =>
      state.participants.some((participant) => participant.runParticipantId === id && participant.alive));
    if (living(state).length <= 1) state.completionReason = "KNOCKOUT";
    else if (context.tick >= state.config.maxTicks) state.completionReason = "TIME_LIMIT";
    if (state.completionReason) {
      const standing = battleStanding(state);
      if (state.completionReason === "TIME_LIMIT") {
        events.push(event("battle.timeout", { maxTicks: state.config.maxTicks, survivors: living(state).length }));
      }
      events.push(event("battle.completed", { completionReason: state.completionReason, ...standing }));
      state.turnQueue = [];
    } else if (state.turnQueue.length === 0) {
      state.round += 1;
      state.turnQueue = initiativeOrder(state.participants, context.rng);
    }
    return { state: battleStateSchema.parse(state), events };
  },

  isComplete(_context, rawState) {
    return battleStateSchema.parse(rawState).completionReason !== null;
  },

  buildResult(context, rawState) {
    const state = battleStateSchema.parse(rawState);
    if (!state.completionReason) return invalidAction();
    const standing = battleStanding(state);
    const winnerName = context.input.participants.find((participant) =>
      participant.runParticipantId === standing.winnerRunParticipantId)?.name;
    const summary = state.completionReason === "KNOCKOUT"
      ? `${winnerName ?? "The last participant"} wins by elimination.`
      : standing.tiedParticipantIds.length > 1
        ? "Battle ends in a time-limit tie."
        : `${winnerName ?? "The leading participant"} leads when time expires.`;
    return {
      resultType: "battle.result",
      summary,
      metrics: {
        ticks: context.tick,
        participants: state.participants.length,
        totalDamage: state.participants.reduce((sum, participant) => sum + participant.damageDealt, 0),
        completionReason: state.completionReason,
      },
      modulePayloadVersion: BATTLE_RESULT_VERSION,
      modulePayload: battleResultSchema.parse({
        version: BATTLE_RESULT_VERSION,
        format: state.config.format,
        completionReason: state.completionReason,
        ...standing,
        eliminationOrder: state.eliminationOrder,
        totalTicks: context.tick,
        simulatedDurationMs: context.simulatedTimeMs,
        participantMetrics: state.participants,
      }),
    };
  },
};
