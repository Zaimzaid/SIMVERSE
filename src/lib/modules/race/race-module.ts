import { EngineExecutionError, type EngineModule, type ProposedEnvelope } from "@/lib/engine/module";
import type { EngineAction, JsonRecord } from "@/lib/engine/schemas";
import {
  RACE_MODULE_ID, RACE_MODULE_VERSION, RACE_PROGRESS_EVENT_INTERVAL_TICKS,
  RACE_RESULT_VERSION, RACE_STATE_VERSION, raceExecutionIssue, resolveRaceExecutionConfig,
} from "./config";
import { finishTimeMicros, raceProgressDelta } from "./rules";
import {
  raceActionPayloads, raceEventPayloads, raceResultPayloads, raceResultSchema,
  raceStateSchema, type RaceParticipantStateV1, type RaceRankingEntryV1, type RaceStateV1,
} from "./schemas";
import { resolveRaceProfile } from "./stats";

function invalidAction(): never {
  throw new EngineExecutionError("INVALID_MODULE_OUTPUT", "Race action or state is invalid.");
}

function event(
  type: keyof typeof raceEventPayloads,
  payload: JsonRecord,
  actorRunParticipantId: string | null = null,
): ProposedEnvelope {
  return { type, payloadVersion: 1, payload, actorRunParticipantId, targetRunParticipantId: null };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * Finished participants sort by precise finish time. Unfinished participants sort
 * by achieved progress. Snapshot position orders equal entries for stable JSON but
 * never changes their shared rank or tie status.
 */
export function raceRanking(participants: readonly RaceParticipantStateV1[]): RaceRankingEntryV1[] {
  const ordered = [...participants].sort((left, right) => {
    if (left.finished !== right.finished) return left.finished ? -1 : 1;
    if (left.finished && right.finished) {
      return (left.finishTimeMicros ?? Number.MAX_SAFE_INTEGER) - (right.finishTimeMicros ?? Number.MAX_SAFE_INTEGER) ||
        left.position - right.position;
    }
    return right.progressMilli - left.progressMilli || left.position - right.position;
  });
  let previousKey = "";
  let rank = 0;
  const entries = ordered.map((participant, index) => {
    const key = participant.finished ? `finished:${participant.finishTimeMicros}` : `progress:${participant.progressMilli}`;
    if (key !== previousKey) rank = index + 1;
    previousKey = key;
    return { runParticipantId: participant.runParticipantId, rank, tied: false };
  });
  const counts = new Map<number, number>();
  for (const entry of entries) counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
  return entries.map((entry) => ({ ...entry, tied: (counts.get(entry.rank) ?? 0) > 1 }));
}

function leaders(ranking: readonly RaceRankingEntryV1[]): string[] {
  return ranking.filter((entry) => entry.rank === 1).map((entry) => entry.runParticipantId);
}

function winners(state: RaceStateV1): { winnerRunParticipantId: string | null; tiedParticipantIds: string[] } {
  const first = state.ranking.filter((entry) => entry.rank === 1).map((entry) => entry.runParticipantId);
  return first.length === 1
    ? { winnerRunParticipantId: first[0]!, tiedParticipantIds: [] }
    : { winnerRunParticipantId: null, tiedParticipantIds: first };
}

function checkpointCrossings(
  participant: RaceParticipantStateV1,
  previousProgressMilli: number,
  courseDistanceMilli: number,
  laps: number,
  checkpoints: readonly number[],
): Array<{ key: string; checkpointPercent: number; lap: number; progressMilli: number }> {
  const crossings: Array<{ key: string; checkpointPercent: number; lap: number; progressMilli: number }> = [];
  const passed = new Set(participant.checkpointKeys);
  for (let lap = 1; lap <= laps; lap += 1) {
    const lapStart = (lap - 1) * courseDistanceMilli;
    for (const checkpointPercent of checkpoints) {
      const progressMilli = lapStart + Math.floor(courseDistanceMilli * checkpointPercent / 100);
      const key = `${lap}:${checkpointPercent}`;
      if (!passed.has(key) && previousProgressMilli < progressMilli && participant.progressMilli >= progressMilli) {
        crossings.push({ key, checkpointPercent, lap, progressMilli });
      }
    }
  }
  return crossings;
}

/** One aggregate advance action per fixed Core tick; all participants advance together. */
export const raceModule: EngineModule = {
  mode: "race",
  id: RACE_MODULE_ID,
  version: RACE_MODULE_VERSION,
  stateSchema: raceStateSchema,
  actionPayloads: raceActionPayloads,
  eventPayloads: raceEventPayloads,
  resultPayloads: raceResultPayloads,

  initialize(context) {
    const issue = raceExecutionIssue(context.input.configuration.mode, context.input.participants.length);
    if (issue) throw new EngineExecutionError("INVALID_EXECUTION_INPUT", issue);
    const config = resolveRaceExecutionConfig(context.input);
    const participants = context.input.participants.map((source) => ({
      runParticipantId: source.runParticipantId,
      position: source.position,
      profile: resolveRaceProfile(source, config.statMapping),
      progressMilli: 0,
      lastDeltaMilli: 0,
      currentLap: 1,
      lapsCompleted: 0,
      checkpointKeys: [],
      finished: false,
      finishTimeMicros: null,
    }));
    if (new Set(participants.map((participant) => participant.runParticipantId)).size !== participants.length) {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "Race participant snapshot is invalid.");
    }
    const ranking = raceRanking(participants);
    return raceStateSchema.parse({
      version: RACE_STATE_VERSION,
      config,
      currentTick: 0,
      simulatedTimeMs: 0,
      participants,
      ranking,
      leaderRunParticipantIds: leaders(ranking),
      completionReason: null,
    });
  },

  planActions(context, rawState) {
    const state = raceStateSchema.parse(rawState);
    if (state.completionReason) return [];
    return [{ type: "race.advance", payloadVersion: 1, payload: { expectedTick: context.tick } }];
  },

  evaluateRules(context, rawState, action: EngineAction) {
    const state = raceStateSchema.parse(rawState);
    if (state.completionReason || action.type !== "race.advance" ||
        action.actorRunParticipantId || action.targetRunParticipantId ||
        action.payload.expectedTick !== context.tick || context.tick !== state.currentTick + 1) return invalidAction();

    const previousLeaders = [...state.leaderRunParticipantIds];
    const checkpointEvents: ProposedEnvelope[] = [];
    const newlyFinished = new Set<string>();

    for (const participant of state.participants) {
      if (participant.finished) continue;
      const previousProgressMilli = participant.progressMilli;
      const delta = raceProgressDelta({
        profile: participant.profile,
        tick: context.tick,
        progressMilli: previousProgressMilli,
        totalDistanceMilli: state.config.totalDistanceMilli,
        variability: state.config.variability,
      }, context.rng);
      participant.lastDeltaMilli = delta.progressDeltaMilli;
      participant.progressMilli = Math.min(
        state.config.totalDistanceMilli,
        previousProgressMilli + delta.progressDeltaMilli,
      );
      const crossings = checkpointCrossings(
        participant, previousProgressMilli, state.config.courseDistanceMilli,
        state.config.laps, state.config.checkpoints,
      );
      for (const crossing of crossings) {
        participant.checkpointKeys.push(crossing.key);
        checkpointEvents.push(event("race.checkpoint", {
          checkpointPercent: crossing.checkpointPercent,
          lap: crossing.lap,
          progressMilli: crossing.progressMilli,
        }, participant.runParticipantId));
      }

      participant.lapsCompleted = Math.min(
        state.config.laps,
        Math.floor(participant.progressMilli / state.config.courseDistanceMilli),
      );
      participant.currentLap = Math.min(state.config.laps, participant.lapsCompleted + 1);
      if (participant.progressMilli >= state.config.totalDistanceMilli) {
        participant.finished = true;
        participant.lapsCompleted = state.config.laps;
        participant.currentLap = state.config.laps;
        participant.finishTimeMicros = finishTimeMicros(
          context.tick, context.fixedStepMs, previousProgressMilli,
          delta.progressDeltaMilli, state.config.totalDistanceMilli,
        );
        newlyFinished.add(participant.runParticipantId);
      }
    }

    state.currentTick = context.tick;
    state.simulatedTimeMs = context.simulatedTimeMs;
    state.ranking = raceRanking(state.participants);
    state.leaderRunParticipantIds = leaders(state.ranking);
    const allFinished = state.participants.every((participant) => participant.finished);
    if (allFinished) state.completionReason = "ALL_FINISHED";
    else if (context.tick >= state.config.maxTicks) state.completionReason = "TIME_LIMIT";

    const events: ProposedEnvelope[] = [];
    if (context.tick === 1) {
      events.push(event("race.started", {
        mode: state.config.mode,
        distance: state.config.distance,
        distanceUnit: state.config.distanceUnit,
        laps: state.config.laps,
        totalDistanceMilli: state.config.totalDistanceMilli,
        maxTicks: state.config.maxTicks,
        checkpoints: state.config.checkpoints,
        participants: state.participants.map((participant) => ({
          runParticipantId: participant.runParticipantId,
          profile: participant.profile,
        })),
      }));
    }

    const significantTick = checkpointEvents.length > 0 || newlyFinished.size > 0 ||
      !sameIds(previousLeaders, state.leaderRunParticipantIds) || Boolean(state.completionReason);
    if (context.tick === 1 || context.tick % RACE_PROGRESS_EVENT_INTERVAL_TICKS === 0 || significantTick) {
      const rankById = new Map(state.ranking.map((entry) => [entry.runParticipantId, entry]));
      events.push(event("race.progress", {
        participants: state.participants.map((participant) => ({
          runParticipantId: participant.runParticipantId,
          progressMilli: participant.progressMilli,
          deltaMilli: participant.lastDeltaMilli,
          currentLap: participant.currentLap,
          lapsCompleted: participant.lapsCompleted,
          finished: participant.finished,
          finishTimeMicros: participant.finishTimeMicros,
          rank: rankById.get(participant.runParticipantId)?.rank ?? state.participants.length,
          tied: rankById.get(participant.runParticipantId)?.tied ?? false,
        })),
        leaderRunParticipantIds: state.leaderRunParticipantIds,
      }));
    }
    if (!sameIds(previousLeaders, state.leaderRunParticipantIds)) {
      events.push(event("race.lead_changed", {
        previousLeaderRunParticipantIds: previousLeaders,
        newLeaderRunParticipantIds: state.leaderRunParticipantIds,
      }));
    }
    events.push(...checkpointEvents);
    const rankById = new Map(state.ranking.map((entry) => [entry.runParticipantId, entry]));
    for (const participant of state.participants.filter((entry) => newlyFinished.has(entry.runParticipantId))) {
      const rank = rankById.get(participant.runParticipantId);
      events.push(event("race.finished", {
        finishTimeMicros: participant.finishTimeMicros ?? 0,
        finishPosition: rank?.rank ?? state.participants.length,
        tied: rank?.tied ?? false,
        totalDistanceMilli: state.config.totalDistanceMilli,
        lapsCompleted: participant.lapsCompleted,
      }, participant.runParticipantId));
    }
    if (state.completionReason === "TIME_LIMIT") {
      const finishedCount = state.participants.filter((participant) => participant.finished).length;
      events.push(event("race.timeout", {
        maxTicks: state.config.maxTicks,
        finishedCount,
        unfinishedCount: state.participants.length - finishedCount,
      }));
    }
    if (state.completionReason) {
      events.push(event("race.completed", {
        completionReason: state.completionReason,
        ...winners(state),
        ranking: state.ranking,
      }));
    }
    return { state: raceStateSchema.parse(state), events };
  },

  isComplete(_context, rawState) {
    return raceStateSchema.parse(rawState).completionReason !== null;
  },

  buildResult(context, rawState) {
    const state = raceStateSchema.parse(rawState);
    if (!state.completionReason) return invalidAction();
    const standing = winners(state);
    const name = standing.winnerRunParticipantId
      ? context.input.participants.find((participant) => participant.runParticipantId === standing.winnerRunParticipantId)?.name
      : null;
    const summary = standing.tiedParticipantIds.length > 1
      ? `Race ends in a tie between ${standing.tiedParticipantIds.length} participants.`
      : state.completionReason === "ALL_FINISHED"
        ? `${name ?? "The leader"} wins the race.`
        : `${name ?? "The leader"} leads when the time limit expires.`;
    const result = raceResultSchema.parse({
      version: RACE_RESULT_VERSION,
      moduleId: RACE_MODULE_ID,
      moduleVersion: RACE_MODULE_VERSION,
      mode: state.config.mode,
      distance: state.config.distance,
      distanceUnit: state.config.distanceUnit,
      laps: state.config.laps,
      totalDistanceMilli: state.config.totalDistanceMilli,
      completionReason: state.completionReason,
      ...standing,
      ranking: state.ranking,
      participants: state.participants.map((participant) => ({
        runParticipantId: participant.runParticipantId,
        rank: state.ranking.find((entry) => entry.runParticipantId === participant.runParticipantId)?.rank ?? state.participants.length,
        tied: state.ranking.find((entry) => entry.runParticipantId === participant.runParticipantId)?.tied ?? false,
        finished: participant.finished,
        finishTimeMicros: participant.finishTimeMicros,
        distanceMilli: participant.progressMilli,
        lapsCompleted: participant.lapsCompleted,
        profile: participant.profile,
      })),
      totalTicks: context.tick,
      simulatedDurationMs: context.simulatedTimeMs,
    });
    return {
      resultType: "race.result",
      summary,
      metrics: {
        ticks: context.tick,
        participants: state.participants.length,
        finished: state.participants.filter((participant) => participant.finished).length,
        completionReason: state.completionReason,
      },
      modulePayloadVersion: RACE_RESULT_VERSION,
      modulePayload: result,
    };
  },
};
