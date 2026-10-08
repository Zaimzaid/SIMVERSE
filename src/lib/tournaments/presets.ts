import type { CreateTournamentInput } from "./schemas";

export interface TournamentPreset {
  id: string;
  name: string;
  description: string;
  participantCount: number;
  configuration: Pick<CreateTournamentInput, "format" | "seedingMethod" | "tiePolicy" | "winPoints" | "tiePoints" | "lossPoints" | "tiebreakers">;
}

export const TOURNAMENT_PRESETS: readonly TournamentPreset[] = [
  { id: "single-elimination-8", name: "8 participant elimination", description: "A seeded knockout bracket with explicit replay handling for ties.", participantCount: 8, configuration: { format: "SINGLE_ELIMINATION", seedingMethod: "MANUAL", tiePolicy: "REPLAY_MATCH", winPoints: 3, tiePoints: 1, lossPoints: 0, tiebreakers: ["POINTS", "WINS", "HEAD_TO_HEAD"] } },
  { id: "single-elimination-16", name: "16 participant elimination", description: "A seeded knockout bracket for a larger field.", participantCount: 16, configuration: { format: "SINGLE_ELIMINATION", seedingMethod: "MANUAL", tiePolicy: "REPLAY_MATCH", winPoints: 3, tiePoints: 1, lossPoints: 0, tiebreakers: ["POINTS", "WINS", "HEAD_TO_HEAD"] } },
  { id: "round-robin-4", name: "4 participant round robin", description: "Every participant meets every other participant once.", participantCount: 4, configuration: { format: "ROUND_ROBIN", seedingMethod: "MANUAL", tiePolicy: "NO_TIES_ALLOWED", winPoints: 3, tiePoints: 1, lossPoints: 0, tiebreakers: ["POINTS", "WINS", "HEAD_TO_HEAD"] } },
  { id: "round-robin-8", name: "8 participant round robin", description: "A complete deterministic league schedule.", participantCount: 8, configuration: { format: "ROUND_ROBIN", seedingMethod: "RANDOM", tiePolicy: "NO_TIES_ALLOWED", winPoints: 3, tiePoints: 1, lossPoints: 0, tiebreakers: ["POINTS", "WINS", "HEAD_TO_HEAD"] } },
] as const;
