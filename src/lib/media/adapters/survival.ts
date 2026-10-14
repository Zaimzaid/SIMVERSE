import { SURVIVAL_MODULE_ID, SURVIVAL_MODULE_VERSION } from "@/lib/modules/survival/config";
import { survivalEventPayloads, survivalResultSchema } from "@/lib/modules/survival/schemas";
import { assertResultParsed, buildStoryboard, nameFor, namesFor, parsePayload, participantNames, validateEnvelope } from "./shared";
import type { HighlightCandidate, StoryboardAdapter } from "./types";

export const survivalStoryboardAdapter: StoryboardAdapter = {
  id: "survival-storyboard-v1",
  supports: (moduleId, moduleVersion) => moduleId === SURVIVAL_MODULE_ID && moduleVersion === SURVIVAL_MODULE_VERSION,
  build(source) {
    validateEnvelope(source, "survival.result");
    const result = assertResultParsed(survivalResultSchema.safeParse(source.result.modulePayload));
    const names = participantNames(source);
    const tied = result.tiedParticipantIds.length > 1;
    const winner = result.winnerRunParticipantId ? nameFor(names, result.winnerRunParticipantId) : null;
    const candidates: HighlightCandidate[] = [];

    for (const event of source.events) {
      if (event.type === "survival.eliminated") {
        const payload = parsePayload(event, survivalEventPayloads["survival.eliminated"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 100,
          title: `${nameFor(names, event.actorRunParticipantId)} eliminated`,
          caption: `Eliminated by ${payload.cause.toLowerCase().replaceAll("_", " ")} at tick ${payload.eliminationTick}.`,
          participantRefs: event.actorRunParticipantId ? [event.actorRunParticipantId] : [],
          turningPoint: true,
          durationHintMs: 3_500,
        });
      } else if (event.type === "survival.hazard") {
        const payload = parsePayload(event, survivalEventPayloads["survival.hazard"].schema);
        const refs = payload.impacts.map((impact) => impact.runParticipantId);
        candidates.push({
          sequence: event.sequence,
          priority: 55 + payload.intensity / 3,
          title: `${payload.category.toLowerCase().replaceAll("_", " ")} hazard`,
          caption: `Intensity ${payload.intensity} affects ${refs.length} ${refs.length === 1 ? "participant" : "participants"}.`,
          participantRefs: refs,
          turningPoint: payload.intensity >= 70,
        });
      } else if (event.type === "survival.leader_changed") {
        const payload = parsePayload(event, survivalEventPayloads["survival.leader_changed"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 78,
          title: "New survival leader",
          caption: `${namesFor(names, payload.newLeaderRunParticipantIds)} ${payload.newLeaderRunParticipantIds.length === 1 ? "moves" : "move"} ahead.`,
          participantRefs: payload.newLeaderRunParticipantIds,
          turningPoint: true,
        });
      } else if (event.type === "survival.recovered") {
        const payload = parsePayload(event, survivalEventPayloads["survival.recovered"].schema);
        const refs = payload.recoveries.map((recovery) => recovery.runParticipantId);
        candidates.push({
          sequence: event.sequence,
          priority: 48,
          title: "Recovery",
          caption: `${namesFor(names, refs)} recover condition.`,
          participantRefs: refs,
        });
      } else if (event.type === "survival.timeout") {
        const payload = parsePayload(event, survivalEventPayloads["survival.timeout"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 95,
          title: "Endurance limit reached",
          caption: `${payload.survivingCount} survived; ${payload.eliminatedCount} were eliminated.`,
          participantRefs: result.ranking.map((entry) => entry.runParticipantId),
          turningPoint: true,
        });
      }
    }

    return buildStoryboard(source, {
      resultType: source.result.resultType,
      headline: tied
        ? `${namesFor(names, result.tiedParticipantIds)} share the win`
        : winner ? `${winner} survives` : "Survival event complete",
      detail: tied
        ? "The authoritative Survival result records shared leaders."
        : result.completionReason === "LAST_STANDING" ? "The last active participant wins." : "The final ranking is preserved from the completed Run.",
      completionReason: result.completionReason,
      winnerParticipantRefs: result.winnerRunParticipantId ? [result.winnerRunParticipantId] : [],
      tiedParticipantRefs: result.tiedParticipantIds,
      ranking: result.ranking.map((entry) => entry.runParticipantId),
    }, candidates);
  },
};
