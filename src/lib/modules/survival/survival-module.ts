import { EngineExecutionError, type EngineModule, type ProposedEnvelope } from "@/lib/engine/module";
import type { EngineAction, JsonRecord } from "@/lib/engine/schemas";
import {
  SURVIVAL_CONDITION_MAX,
  SURVIVAL_HAZARD_CATEGORIES,
  SURVIVAL_MODULE_ID,
  SURVIVAL_MODULE_VERSION,
  SURVIVAL_RESULT_VERSION,
  SURVIVAL_STATE_VERSION,
  SURVIVAL_STATUS_EVENT_INTERVAL_TICKS,
  resolveSurvivalExecutionConfig,
  survivalExecutionIssue,
  type SurvivalHazardCategory,
} from "./config";
import { survivalConditionDrain, survivalHazardImpact, survivalRecovery, survivalResourceDrain } from "./rules";
import {
  survivalActionPayloads,
  survivalEventPayloads,
  survivalResultPayloads,
  survivalResultSchema,
  survivalStateSchema,
  type SurvivalEliminationCause,
  type SurvivalParticipantStateV1,
  type SurvivalRankingEntryV1,
  type SurvivalStateV1,
} from "./schemas";
import { resolveSurvivalProfile } from "./stats";

function invalidAction(): never {
  throw new EngineExecutionError("INVALID_MODULE_OUTPUT", "Survival action or state is invalid.");
}

function event(
  type: keyof typeof survivalEventPayloads,
  payload: JsonRecord,
  actorRunParticipantId: string | null = null,
): ProposedEnvelope {
  return { type, payloadVersion: 1, payload, actorRunParticipantId, targetRunParticipantId: null };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * Active participants rank by condition and then remaining explicit resources.
 * Eliminated participants rank by authoritative survival time. Snapshot position
 * stabilizes JSON order but never breaks equal values into separate ranks.
 */
export function survivalRanking(
  participants: readonly SurvivalParticipantStateV1[],
): SurvivalRankingEntryV1[] {
  const ordered = [...participants].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    if (left.active) {
      return right.condition - left.condition ||
        right.energy - left.energy ||
        right.supplies - left.supplies ||
        left.position - right.position;
    }
    return right.survivalTimeMs - left.survivalTimeMs || left.position - right.position;
  });
  let previousKey = "";
  let rank = 0;
  const entries = ordered.map((participant, index) => {
    const key = participant.active
      ? `active:${participant.condition}:${participant.energy}:${participant.supplies}`
      : `eliminated:${participant.survivalTimeMs}`;
    if (key !== previousKey) rank = index + 1;
    previousKey = key;
    return { runParticipantId: participant.runParticipantId, rank, tied: false };
  });
  const counts = new Map<number, number>();
  for (const entry of entries) counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
  return entries.map((entry) => ({ ...entry, tied: (counts.get(entry.rank) ?? 0) > 1 }));
}

function leaders(ranking: readonly SurvivalRankingEntryV1[]): string[] {
  return ranking.filter((entry) => entry.rank === 1).map((entry) => entry.runParticipantId);
}

function winners(state: SurvivalStateV1): {
  winnerRunParticipantId: string | null;
  tiedParticipantIds: string[];
} {
  const first = leaders(state.ranking);
  return first.length === 1
    ? { winnerRunParticipantId: first[0]!, tiedParticipantIds: [] }
    : { winnerRunParticipantId: null, tiedParticipantIds: first };
}

function subtract(value: number, amount: number): number {
  return Math.max(0, value - amount);
}

function depletionChanges(
  participant: SurvivalParticipantStateV1,
  beforeEnergy: number,
  beforeSupplies: number,
): Array<JsonRecord> {
  const changes: Array<JsonRecord> = [];
  if (beforeEnergy > 0 && participant.energy === 0) {
    changes.push({
      runParticipantId: participant.runParticipantId,
      resource: "ENERGY",
      before: beforeEnergy,
      after: 0,
      reason: "DEPLETED",
    });
  }
  if (beforeSupplies > 0 && participant.supplies === 0) {
    changes.push({
      runParticipantId: participant.runParticipantId,
      resource: "SUPPLIES",
      before: beforeSupplies,
      after: 0,
      reason: "DEPLETED",
    });
  }
  return changes;
}

/** One aggregate advance action applies the full documented Survival tick order. */
export const survivalModule: EngineModule = {
  mode: "survival",
  id: SURVIVAL_MODULE_ID,
  version: SURVIVAL_MODULE_VERSION,
  stateSchema: survivalStateSchema,
  actionPayloads: survivalActionPayloads,
  eventPayloads: survivalEventPayloads,
  resultPayloads: survivalResultPayloads,

  initialize(context) {
    const issue = survivalExecutionIssue(context.input.configuration.mode, context.input.participants.length);
    if (issue) throw new EngineExecutionError("INVALID_EXECUTION_INPUT", issue);
    const config = resolveSurvivalExecutionConfig(context.input);
    const participants = context.input.participants.map((source) => ({
      runParticipantId: source.runParticipantId,
      position: source.position,
      profile: resolveSurvivalProfile(source, config.statMapping),
      condition: SURVIVAL_CONDITION_MAX,
      energy: config.resources.initialEnergy,
      supplies: config.resources.initialSupplies,
      active: true,
      lastConditionLoss: 0,
      lastEnergyDrain: 0,
      lastSuppliesDrain: 0,
      eliminationTick: null,
      eliminationTimeMs: null,
      eliminationCause: null,
      survivalTimeMs: 0,
    }));
    if (new Set(participants.map((participant) => participant.runParticipantId)).size !== participants.length) {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "Survival participant snapshot is invalid.");
    }
    const ranking = survivalRanking(participants);
    return survivalStateSchema.parse({
      version: SURVIVAL_STATE_VERSION,
      config,
      currentTick: 0,
      simulatedTimeMs: 0,
      participants,
      ranking,
      leaderRunParticipantIds: leaders(ranking),
      hazardCount: 0,
      lastHazard: null,
      completionReason: null,
    });
  },

  planActions(context, rawState) {
    const state = survivalStateSchema.parse(rawState);
    if (state.completionReason) return [];
    return [{ type: "survival.advance", payloadVersion: 1, payload: { expectedTick: context.tick } }];
  },

  evaluateRules(context, rawState, action: EngineAction) {
    const state = survivalStateSchema.parse(rawState);
    if (state.completionReason || action.type !== "survival.advance" ||
        action.actorRunParticipantId || action.targetRunParticipantId ||
        action.payloadVersion !== 1 || action.payload.expectedTick !== context.tick ||
        context.tick !== state.currentTick + 1) return invalidAction();

    const previousLeaders = [...state.leaderRunParticipantIds];
    const resourceChanges: JsonRecord[] = [];
    const recoveries: JsonRecord[] = [];
    const eliminated: Array<{ participant: SurvivalParticipantStateV1; cause: SurvivalEliminationCause }> = [];
    const causeByParticipant = new Map<string, SurvivalEliminationCause>();

    // 1. Explicit resource drain; 2. baseline condition drain.
    for (const participant of state.participants) {
      participant.lastConditionLoss = 0;
      participant.lastEnergyDrain = 0;
      participant.lastSuppliesDrain = 0;
      if (!participant.active) continue;

      const beforeEnergy = participant.energy;
      const beforeSupplies = participant.supplies;
      const drain = survivalResourceDrain(
        participant.profile, state.config.resources, state.config.variability, context.rng,
      );
      participant.energy = subtract(participant.energy, drain.energyDrain);
      participant.supplies = subtract(participant.supplies, drain.suppliesDrain);
      participant.lastEnergyDrain += beforeEnergy - participant.energy;
      participant.lastSuppliesDrain += beforeSupplies - participant.supplies;
      resourceChanges.push(...depletionChanges(participant, beforeEnergy, beforeSupplies));

      const condition = survivalConditionDrain(
        participant.profile,
        state.config.baseConditionDrain,
        state.config.resources.depletionConditionPenalty,
        participant.energy,
        participant.supplies,
      );
      participant.condition = subtract(participant.condition, condition.totalLoss);
      participant.lastConditionLoss += condition.totalLoss;
      if (participant.condition <= state.config.eliminationThreshold) {
        causeByParticipant.set(
          participant.runParticipantId,
          condition.resourceDepletionLoss > 0 ? "RESOURCE_DEPLETION" : "CONDITION",
        );
      }
    }

    // 3. One global seeded hazard decision, then deterministic per-participant resolution.
    let hazardPayload: JsonRecord | null = null;
    const hazardOccurs = state.config.hazardFrequency === 100 ||
      (state.config.hazardFrequency > 0 && context.rng.nextUint32() % 10_000 < state.config.hazardFrequency * 100);
    if (hazardOccurs) {
      const category = SURVIVAL_HAZARD_CATEGORIES[
        context.rng.nextUint32() % SURVIVAL_HAZARD_CATEGORIES.length
      ] as SurvivalHazardCategory;
      const impacts: JsonRecord[] = [];
      for (const participant of state.participants) {
        if (!participant.active) continue;
        const beforeCondition = participant.condition;
        const beforeEnergy = participant.energy;
        const beforeSupplies = participant.supplies;
        const impact = survivalHazardImpact(
          category, state.config.hazardIntensity, participant.profile, state.config.variability, context.rng,
        );
        participant.condition = subtract(participant.condition, impact.conditionLoss);
        participant.energy = subtract(participant.energy, impact.energyLoss);
        participant.supplies = subtract(participant.supplies, impact.suppliesLoss);
        const actualConditionLoss = beforeCondition - participant.condition;
        const actualEnergyLoss = beforeEnergy - participant.energy;
        const actualSuppliesLoss = beforeSupplies - participant.supplies;
        participant.lastConditionLoss += actualConditionLoss;
        participant.lastEnergyDrain += actualEnergyLoss;
        participant.lastSuppliesDrain += actualSuppliesLoss;
        resourceChanges.push(...depletionChanges(participant, beforeEnergy, beforeSupplies));
        impacts.push({
          runParticipantId: participant.runParticipantId,
          conditionLoss: actualConditionLoss,
          energyLoss: actualEnergyLoss,
          suppliesLoss: actualSuppliesLoss,
        });
        if (!causeByParticipant.has(participant.runParticipantId) &&
            participant.condition <= state.config.eliminationThreshold) {
          causeByParticipant.set(participant.runParticipantId, "HAZARD");
        }
      }
      state.hazardCount += 1;
      state.lastHazard = { tick: context.tick, category, intensity: state.config.hazardIntensity };
      hazardPayload = { category, intensity: state.config.hazardIntensity, impacts };
    }

    // 4. Bounded recovery consumes configured resources and cannot revive an eliminated participant.
    for (const participant of state.participants) {
      if (!participant.active || participant.condition <= state.config.eliminationThreshold) continue;
      const recovery = survivalRecovery(
        context.tick,
        participant.condition,
        participant.energy,
        participant.supplies,
        state.config.eliminationThreshold,
        participant.profile,
        state.config.recovery,
      );
      if (recovery.conditionRecovered === 0) continue;
      participant.condition += recovery.conditionRecovered;
      participant.energy -= recovery.energyCost;
      participant.supplies -= recovery.suppliesCost;
      participant.lastEnergyDrain += recovery.energyCost;
      participant.lastSuppliesDrain += recovery.suppliesCost;
      recoveries.push({
        runParticipantId: participant.runParticipantId,
        conditionRecovered: recovery.conditionRecovered,
        energyCost: recovery.energyCost,
        suppliesCost: recovery.suppliesCost,
      });
    }

    // 5. Eliminate once after all same-tick effects; 6. rebuild the authoritative ranking.
    for (const participant of state.participants) {
      if (!participant.active) continue;
      if (participant.condition <= state.config.eliminationThreshold) {
        const cause = causeByParticipant.get(participant.runParticipantId) ?? "CONDITION";
        participant.active = false;
        participant.eliminationTick = context.tick;
        participant.eliminationTimeMs = context.simulatedTimeMs;
        participant.eliminationCause = cause;
        participant.survivalTimeMs = context.simulatedTimeMs;
        eliminated.push({ participant, cause });
      } else {
        participant.survivalTimeMs = context.simulatedTimeMs;
      }
    }
    state.currentTick = context.tick;
    state.simulatedTimeMs = context.simulatedTimeMs;
    state.ranking = survivalRanking(state.participants);
    state.leaderRunParticipantIds = leaders(state.ranking);

    // 7. Complete according to the selected canonical mode.
    const activeCount = state.participants.filter((participant) => participant.active).length;
    if (activeCount === 0) state.completionReason = "ALL_ELIMINATED";
    else if (state.config.mode === "LAST_STANDING" && activeCount === 1) {
      state.completionReason = "LAST_STANDING";
    } else if (context.tick >= state.config.maxTicks) state.completionReason = "TIME_LIMIT";

    const events: ProposedEnvelope[] = [];
    if (context.tick === 1) {
      events.push(event("survival.started", {
        mode: state.config.mode,
        config: state.config,
        maxTicks: state.config.maxTicks,
        conditionMax: SURVIVAL_CONDITION_MAX,
        eliminationThreshold: state.config.eliminationThreshold,
        hazardFrequency: state.config.hazardFrequency,
        hazardIntensity: state.config.hazardIntensity,
        participants: state.participants.map((participant) => ({
          runParticipantId: participant.runParticipantId,
          profile: participant.profile,
        })),
      }));
    }
    if (hazardPayload) events.push(event("survival.hazard", hazardPayload));
    if (resourceChanges.length > 0) {
      events.push(event("survival.resource_changed", { changes: resourceChanges }));
    }
    if (recoveries.length > 0) events.push(event("survival.recovered", { recoveries }));
    for (const entry of eliminated) {
      events.push(event("survival.eliminated", {
        cause: entry.cause,
        eliminationTick: context.tick,
        eliminationTimeMs: context.simulatedTimeMs,
        condition: entry.participant.condition,
        energy: entry.participant.energy,
        supplies: entry.participant.supplies,
      }, entry.participant.runParticipantId));
    }

    const leaderChanged = !sameIds(previousLeaders, state.leaderRunParticipantIds);
    const significantTick = hazardPayload !== null || resourceChanges.length > 0 || recoveries.length > 0 ||
      eliminated.length > 0 || leaderChanged || Boolean(state.completionReason);
    if (context.tick === 1 || context.tick % SURVIVAL_STATUS_EVENT_INTERVAL_TICKS === 0 || significantTick) {
      const rankById = new Map(state.ranking.map((entry) => [entry.runParticipantId, entry]));
      events.push(event("survival.status", {
        participants: state.participants.map((participant) => ({
          runParticipantId: participant.runParticipantId,
          condition: participant.condition,
          energy: participant.energy,
          supplies: participant.supplies,
          active: participant.active,
          survivalTimeMs: participant.survivalTimeMs,
          rank: rankById.get(participant.runParticipantId)?.rank ?? state.participants.length,
          tied: rankById.get(participant.runParticipantId)?.tied ?? false,
        })),
        leaderRunParticipantIds: state.leaderRunParticipantIds,
      }));
    }
    if (leaderChanged) {
      events.push(event("survival.leader_changed", {
        previousLeaderRunParticipantIds: previousLeaders,
        newLeaderRunParticipantIds: state.leaderRunParticipantIds,
      }));
    }
    if (state.completionReason === "TIME_LIMIT") {
      events.push(event("survival.timeout", {
        maxTicks: state.config.maxTicks,
        survivingCount: activeCount,
        eliminatedCount: state.participants.length - activeCount,
      }));
    }
    if (state.completionReason) {
      events.push(event("survival.completed", {
        completionReason: state.completionReason,
        ...winners(state),
        ranking: state.ranking,
      }));
    }
    return { state: survivalStateSchema.parse(state), events };
  },

  isComplete(_context, rawState) {
    return survivalStateSchema.parse(rawState).completionReason !== null;
  },

  buildResult(context, rawState) {
    const state = survivalStateSchema.parse(rawState);
    if (!state.completionReason) return invalidAction();
    const standing = winners(state);
    const winnerName = standing.winnerRunParticipantId
      ? context.input.participants.find(
        (participant) => participant.runParticipantId === standing.winnerRunParticipantId,
      )?.name
      : null;
    const summary = standing.tiedParticipantIds.length > 1
      ? `Survival ends in a tie between ${standing.tiedParticipantIds.length} participants.`
      : state.completionReason === "LAST_STANDING"
        ? `${winnerName ?? "The last participant"} is the last standing.`
        : state.completionReason === "ALL_ELIMINATED"
          ? winnerName ? `${winnerName} endured the longest before all participants were eliminated.`
            : "All participants were eliminated with an equal leading survival time."
          : `${winnerName ?? "The leader"} leads when the endurance limit expires.`;
    const rankById = new Map(state.ranking.map((entry) => [entry.runParticipantId, entry]));
    const result = survivalResultSchema.parse({
      version: SURVIVAL_RESULT_VERSION,
      moduleId: SURVIVAL_MODULE_ID,
      moduleVersion: SURVIVAL_MODULE_VERSION,
      mode: state.config.mode,
      completionReason: state.completionReason,
      ...standing,
      ranking: state.ranking,
      participants: state.participants.map((participant) => ({
        runParticipantId: participant.runParticipantId,
        rank: rankById.get(participant.runParticipantId)?.rank ?? state.participants.length,
        tied: rankById.get(participant.runParticipantId)?.tied ?? false,
        survived: participant.active,
        eliminationTick: participant.eliminationTick,
        eliminationTimeMs: participant.eliminationTimeMs,
        eliminationCause: participant.eliminationCause,
        finalCondition: participant.condition,
        finalResources: { energy: participant.energy, supplies: participant.supplies },
        survivalDurationMs: participant.survivalTimeMs,
        profile: participant.profile,
      })),
      totalTicks: context.tick,
      simulatedDurationMs: context.simulatedTimeMs,
      hazardCount: state.hazardCount,
    });
    return {
      resultType: "survival.result",
      summary,
      metrics: {
        ticks: context.tick,
        participants: state.participants.length,
        survivors: state.participants.filter((participant) => participant.active).length,
        hazards: state.hazardCount,
        completionReason: state.completionReason,
      },
      modulePayloadVersion: SURVIVAL_RESULT_VERSION,
      modulePayload: result,
    };
  },
};
