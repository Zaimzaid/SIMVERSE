import { ValidationError } from "@/lib/errors";
import { battleResultSchema } from "@/lib/modules/battle/schemas";
import type { RunView } from "@/server/services/simulation-run-service";
import { TOURNAMENT_RESULT_SNAPSHOT_VERSION } from "./constants";
import { competitionMatchResultSchema, type CompetitionMatchResult } from "./schemas";

export interface TournamentResultParticipant {
  tournamentParticipantId: string;
  entityId: string;
}

export interface TournamentModuleResultAdapter {
  supports(moduleId: string, moduleVersion: string): boolean;
  interpret(run: RunView, participants: readonly TournamentResultParticipant[]): CompetitionMatchResult;
}

function participantMapping(run: RunView, participants: readonly TournamentResultParticipant[]) {
  if (participants.length !== 2) throw new ValidationError("Tournament matches require exactly two participant mappings.");
  const tournamentByEntity = new Map(participants.map((participant) => [participant.entityId, participant.tournamentParticipantId]));
  if (tournamentByEntity.size !== participants.length) throw new ValidationError("Tournament participant mappings must be unique.");
  const tournamentByRun = new Map<string, string>();
  for (const participant of run.inputSnapshot.participants) {
    const tournamentParticipantId = tournamentByEntity.get(participant.sourceEntityId);
    if (tournamentParticipantId) tournamentByRun.set(participant.runParticipantId, tournamentParticipantId);
  }
  if (tournamentByRun.size !== participants.length) throw new ValidationError("The Run participants do not match this Tournament Match.");
  return tournamentByRun;
}

export const battleTournamentResultAdapter: TournamentModuleResultAdapter = {
  supports: (moduleId, moduleVersion) => moduleId === "battle" && moduleVersion === "battle-v1",
  interpret(run, participants) {
    if (run.status !== "COMPLETED" || !run.result) throw new ValidationError("Only a completed authoritative Run result can be accepted.");
    if (run.result.resultType !== "battle.result" || run.result.modulePayloadVersion !== 1) throw new ValidationError("The Run does not contain a supported Battle result.");
    const battle = battleResultSchema.safeParse(run.result.modulePayload);
    if (!battle.success) throw new ValidationError("The authoritative Battle result is invalid.");
    const byRun = participantMapping(run, participants);
    const mapId = (id: string) => {
      const mapped = byRun.get(id);
      if (!mapped) throw new ValidationError("The Battle result references a participant outside this Match.");
      return mapped;
    };
    const winner = battle.data.winnerRunParticipantId ? mapId(battle.data.winnerRunParticipantId) : null;
    const tied = battle.data.tiedParticipantIds.map(mapId);
    const ranking = battle.data.ranking.map(mapId);
    if (new Set(ranking).size !== participants.length || ranking.length !== participants.length) throw new ValidationError("The Battle ranking does not map exactly to this Match.");
    if (winner && tied.length) throw new ValidationError("The Battle result cannot contain both a winner and tied participants.");
    return competitionMatchResultSchema.parse({
      snapshotVersion: TOURNAMENT_RESULT_SNAPSHOT_VERSION,
      winnerTournamentParticipantId: winner,
      tiedTournamentParticipantIds: tied,
      ranking,
      completed: true,
      sourceRunId: run.id,
      sourceModule: run.moduleId,
      sourceModuleVersion: run.moduleVersion,
      completionReason: battle.data.completionReason,
      metadata: { resultType: run.result.resultType, resultVersion: run.resultVersion },
    });
  },
};

const adapters: readonly TournamentModuleResultAdapter[] = [battleTournamentResultAdapter];

export function resultAdapterFor(moduleId: string, moduleVersion: string): TournamentModuleResultAdapter {
  const adapter = adapters.find((candidate) => candidate.supports(moduleId, moduleVersion));
  if (!adapter) throw new ValidationError(`Tournament result support is unavailable for ${moduleId} ${moduleVersion}.`);
  return adapter;
}
