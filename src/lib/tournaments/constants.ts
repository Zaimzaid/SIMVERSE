export const TOURNAMENT_STATUSES = [
  "DRAFT", "CONFIGURING", "READY", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
export type TournamentStatusFilter = TournamentStatus | "CURRENT" | "ALL";

export const TOURNAMENT_FORMATS = ["SINGLE_ELIMINATION", "ROUND_ROBIN"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_SEEDING_METHODS = ["MANUAL", "RANDOM"] as const;
export type TournamentSeedingMethod = (typeof TOURNAMENT_SEEDING_METHODS)[number];

export const TOURNAMENT_TIE_POLICIES = ["NO_TIES_ALLOWED", "REPLAY_MATCH"] as const;
export type TournamentTiePolicy = (typeof TOURNAMENT_TIE_POLICIES)[number];

export const TOURNAMENT_TIEBREAKERS = ["POINTS", "WINS", "HEAD_TO_HEAD"] as const;
export type TournamentTiebreaker = (typeof TOURNAMENT_TIEBREAKERS)[number];

export const TOURNAMENT_PARTICIPANT_STATUSES = ["ACTIVE", "ELIMINATED"] as const;
export type TournamentParticipantStatus = (typeof TOURNAMENT_PARTICIPANT_STATUSES)[number];

export const TOURNAMENT_ROUND_STATES = ["PENDING", "READY", "IN_PROGRESS", "COMPLETED"] as const;
export type TournamentRoundState = (typeof TOURNAMENT_ROUND_STATES)[number];

export const TOURNAMENT_MATCH_STATES = ["PENDING", "READY", "RUNNING", "COMPLETED", "CANCELLED", "BYE"] as const;
export type TournamentMatchState = (typeof TOURNAMENT_MATCH_STATES)[number];

export const TOURNAMENT_SORTS = ["updated_desc", "updated_asc", "name_asc", "name_desc", "start_asc"] as const;
export type TournamentSort = (typeof TOURNAMENT_SORTS)[number];

export const TOURNAMENT_PAGE_SIZE = 18;
export const TOURNAMENT_MAX_PAGE_SIZE = 100;
export const TOURNAMENT_SNAPSHOT_VERSION = 1 as const;
export const TOURNAMENT_RESULT_SNAPSHOT_VERSION = 1 as const;

export function isTournamentStatus(value: string): value is TournamentStatus {
  return (TOURNAMENT_STATUSES as readonly string[]).includes(value);
}

export function isTournamentRoundState(value: string): value is TournamentRoundState {
  return (TOURNAMENT_ROUND_STATES as readonly string[]).includes(value);
}

export function isTournamentMatchState(value: string): value is TournamentMatchState {
  return (TOURNAMENT_MATCH_STATES as readonly string[]).includes(value);
}
