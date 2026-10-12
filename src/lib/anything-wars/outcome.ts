import { battleResultSchema } from "@/lib/modules/battle/schemas";
import { raceResultSchema } from "@/lib/modules/race/schemas";
import { survivalResultSchema } from "@/lib/modules/survival/schemas";

interface OutcomeParticipant {
  runParticipantId: string;
  name: string;
}

interface OutcomeResult {
  resultType: string;
  modulePayload: unknown;
  summary?: string;
}

export interface AnythingWarsOutcome {
  title: string;
  detail: string;
}

function displayNames(ids: readonly string[], names: Map<string, string>): string {
  const resolved = ids.map((id) => names.get(id) ?? "Competitor");
  if (resolved.length <= 2) return resolved.join(" & ");
  return `${resolved[0]}, ${resolved[1]} + ${resolved.length - 2} more`;
}

/** Product-level outcome copy derived only from validated authoritative results. */
export function anythingWarsOutcome(
  result: OutcomeResult,
  participants: readonly OutcomeParticipant[],
): AnythingWarsOutcome {
  const names = new Map(participants.map((participant) => [participant.runParticipantId, participant.name]));

  if (result.resultType === "battle.result") {
    const parsed = battleResultSchema.safeParse(result.modulePayload);
    if (parsed.success) {
      if (parsed.data.tiedParticipantIds.length > 1) {
        return { title: `${displayNames(parsed.data.tiedParticipantIds, names)} Tie!`, detail: "The Battle ended with shared leaders." };
      }
      const winner = parsed.data.winnerRunParticipantId ? names.get(parsed.data.winnerRunParticipantId) : null;
      if (winner) return { title: `${winner} Wins!`, detail: parsed.data.completionReason === "KNOCKOUT" ? "Victory by elimination." : "Victory at the time limit." };
    }
  }

  if (result.resultType === "race.result") {
    const parsed = raceResultSchema.safeParse(result.modulePayload);
    if (parsed.success) {
      if (parsed.data.tiedParticipantIds.length > 1) {
        return { title: `${displayNames(parsed.data.tiedParticipantIds, names)} Tie!`, detail: "The Race finished with shared first place." };
      }
      const winner = parsed.data.winnerRunParticipantId ? names.get(parsed.data.winnerRunParticipantId) : null;
      if (winner) return { title: `${winner} Wins!`, detail: "First place is recorded in the final Race ranking." };
    }
  }

  if (result.resultType === "survival.result") {
    const parsed = survivalResultSchema.safeParse(result.modulePayload);
    if (parsed.success) {
      if (parsed.data.tiedParticipantIds.length > 1) {
        return { title: `${displayNames(parsed.data.tiedParticipantIds, names)} Share the Win!`, detail: "The Survival event ended with shared leaders." };
      }
      const winner = parsed.data.winnerRunParticipantId ? names.get(parsed.data.winnerRunParticipantId) : null;
      if (winner) return { title: `${winner} Wins!`, detail: "The final Survival ranking is complete." };
    }
  }

  return { title: "Competition Complete", detail: result.summary ?? "The authoritative result is ready." };
}
