import { BATTLE_MODULE_ID, BATTLE_MODULE_VERSION } from "@/lib/modules/battle/config";
import { battleEventPayloads, battleResultSchema } from "@/lib/modules/battle/schemas";
import { assertResultParsed, buildStoryboard, nameFor, namesFor, parsePayload, participantNames, validateEnvelope } from "./shared";
import type { HighlightCandidate, StoryboardAdapter } from "./types";

export const battleStoryboardAdapter: StoryboardAdapter = {
  id: "battle-storyboard-v1",
  supports: (moduleId, moduleVersion) => moduleId === BATTLE_MODULE_ID && moduleVersion === BATTLE_MODULE_VERSION,
  build(source) {
    validateEnvelope(source, "battle.result");
    const result = assertResultParsed(battleResultSchema.safeParse(source.result.modulePayload));
    const names = participantNames(source);
    const tied = result.tiedParticipantIds.length > 1;
    const winner = result.winnerRunParticipantId ? nameFor(names, result.winnerRunParticipantId) : null;
    const candidates: HighlightCandidate[] = [];

    for (const event of source.events) {
      if (event.type === "battle.eliminated") {
        parsePayload(event, battleEventPayloads["battle.eliminated"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 100,
          title: `${nameFor(names, event.targetRunParticipantId)} eliminated`,
          caption: `${nameFor(names, event.actorRunParticipantId)} delivered the decisive strike.`,
          participantRefs: [event.actorRunParticipantId, event.targetRunParticipantId].filter((value): value is string => Boolean(value)),
          turningPoint: true,
          durationHintMs: 3_500,
        });
      } else if (event.type === "battle.critical_hit") {
        const payload = parsePayload(event, battleEventPayloads["battle.critical_hit"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 80 + Math.min(payload.finalDamage, 19),
          title: "Critical hit",
          caption: `${nameFor(names, event.actorRunParticipantId)} lands ${payload.finalDamage} damage on ${nameFor(names, event.targetRunParticipantId)}.`,
          participantRefs: [event.actorRunParticipantId, event.targetRunParticipantId].filter((value): value is string => Boolean(value)),
          turningPoint: payload.finalDamage >= 25,
        });
      } else if (event.type === "battle.dodged") {
        parsePayload(event, battleEventPayloads["battle.dodged"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 58,
          title: "Clean dodge",
          caption: `${nameFor(names, event.targetRunParticipantId)} evades ${nameFor(names, event.actorRunParticipantId)}'s attack.`,
          participantRefs: [event.actorRunParticipantId, event.targetRunParticipantId].filter((value): value is string => Boolean(value)),
        });
      } else if (event.type === "battle.attack") {
        const payload = parsePayload(event, battleEventPayloads["battle.attack"].schema);
        if (!payload.dodged && payload.finalDamage >= 25) {
          candidates.push({
            sequence: event.sequence,
            priority: 60 + Math.min(payload.finalDamage, 19),
            title: "Heavy damage",
            caption: `${nameFor(names, event.actorRunParticipantId)} deals ${payload.finalDamage} damage to ${nameFor(names, event.targetRunParticipantId)}.`,
            participantRefs: [event.actorRunParticipantId, event.targetRunParticipantId].filter((value): value is string => Boolean(value)),
          });
        }
      } else if (event.type === "battle.timeout") {
        parsePayload(event, battleEventPayloads["battle.timeout"].schema);
        candidates.push({
          sequence: event.sequence,
          priority: 95,
          title: "Time expires",
          caption: "The Battle reaches its authoritative time limit.",
          participantRefs: result.ranking,
          turningPoint: true,
        });
      }
    }

    return buildStoryboard(source, {
      resultType: source.result.resultType,
      headline: tied
        ? `${namesFor(names, result.tiedParticipantIds)} tie`
        : winner ? `${winner} wins` : "Battle complete",
      detail: tied
        ? "The authoritative Battle result records shared leaders."
        : result.completionReason === "KNOCKOUT" ? "Victory by elimination." : "Victory at the time limit.",
      completionReason: result.completionReason,
      winnerParticipantRefs: result.winnerRunParticipantId ? [result.winnerRunParticipantId] : [],
      tiedParticipantRefs: result.tiedParticipantIds,
      ranking: result.ranking,
    }, candidates);
  },
};
