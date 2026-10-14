import { RACE_MODULE_ID, RACE_MODULE_VERSION } from "@/lib/modules/race/config";
import { raceEventPayloads, raceResultSchema } from "@/lib/modules/race/schemas";
import { assertResultParsed, buildStoryboard, nameFor, namesFor, parsePayload, participantNames, validateEnvelope } from "./shared";
import type { HighlightCandidate, StoryboardAdapter } from "./types";

export const raceStoryboardAdapter: StoryboardAdapter = {
  id: "race-storyboard-v1",
  supports: (moduleId, moduleVersion) => moduleId === RACE_MODULE_ID && moduleVersion === RACE_MODULE_VERSION,
  build(source) {
    validateEnvelope(source, "race.result");
    const result = assertResultParsed(raceResultSchema.safeParse(source.result.modulePayload));
    const names = participantNames(source);
    const tied = result.tiedParticipantIds.length > 1;
    const winner = result.winnerRunParticipantId ? nameFor(names, result.winnerRunParticipantId) : null;
    const candidates: HighlightCandidate[] = [];

    for (const event of source.events) {
      if (event.type === "race.lead_changed") {
        const payload = parsePayload(event, raceEventPayloads["race.lead_changed"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 75,
          title: "Lead change",
          caption: `${namesFor(names, payload.newLeaderRunParticipantIds)} ${payload.newLeaderRunParticipantIds.length === 1 ? "takes" : "take"} the lead.`,
          participantRefs: payload.newLeaderRunParticipantIds,
          turningPoint: true,
        });
      } else if (event.type === "race.checkpoint") {
        const payload = parsePayload(event, raceEventPayloads["race.checkpoint"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 45 + payload.checkpointPercent / 10,
          title: `${payload.checkpointPercent}% checkpoint`,
          caption: `${nameFor(names, event.actorRunParticipantId)} reaches the checkpoint on lap ${payload.lap}.`,
          participantRefs: event.actorRunParticipantId ? [event.actorRunParticipantId] : [],
        });
      } else if (event.type === "race.finished") {
        const payload = parsePayload(event, raceEventPayloads["race.finished"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: payload.finishPosition === 1 ? 100 : 82 - Math.min(payload.finishPosition, 20),
          title: payload.finishPosition === 1 ? "First across the line" : `Finish position ${payload.finishPosition}`,
          caption: `${nameFor(names, event.actorRunParticipantId)} finishes${payload.tied ? " in a tie" : ""}.`,
          participantRefs: event.actorRunParticipantId ? [event.actorRunParticipantId] : [],
          turningPoint: payload.finishPosition === 1,
          durationHintMs: 3_500,
        });
      } else if (event.type === "race.timeout") {
        const payload = parsePayload(event, raceEventPayloads["race.timeout"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 95,
          title: "Time limit reached",
          caption: `${payload.finishedCount} finished; ${payload.unfinishedCount} remained on course.`,
          participantRefs: result.ranking.map((entry) => entry.runParticipantId),
          turningPoint: true,
        });
      }
    }

    return buildStoryboard(source, {
      resultType: source.result.resultType,
      headline: tied
        ? `${namesFor(names, result.tiedParticipantIds)} tie`
        : winner ? `${winner} wins the race` : "Race complete",
      detail: tied
        ? "The authoritative Race ranking records shared first place."
        : result.completionReason === "ALL_FINISHED" ? "First place is fixed by the final ranking." : "The leader wins at the time limit.",
      completionReason: result.completionReason,
      winnerParticipantRefs: result.winnerRunParticipantId ? [result.winnerRunParticipantId] : [],
      tiedParticipantRefs: result.tiedParticipantIds,
      ranking: result.ranking.map((entry) => entry.runParticipantId),
    }, candidates);
  },
};
