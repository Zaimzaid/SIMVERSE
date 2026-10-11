export const EXPERIENCE_PROFILE_STATUSES = [
  "DRAFT", "IN_DESIGN", "REVIEW", "VALIDATED", "RUNTIME_READY", "ARCHIVED",
] as const;
export type ExperienceProfileStatus = (typeof EXPERIENCE_PROFILE_STATUSES)[number];
export type ExperienceProfileStatusFilter = ExperienceProfileStatus | "CURRENT" | "ALL";
export const EXPERIENCE_PROFILE_STATUS_FILTERS = [...EXPERIENCE_PROFILE_STATUSES, "CURRENT", "ALL"] as const;

export const EXPERIENCE_PROFILE_STATUS_LABELS: Record<ExperienceProfileStatusFilter, string> = {
  DRAFT: "Draft", IN_DESIGN: "In design", REVIEW: "Review", VALIDATED: "Validated",
  RUNTIME_READY: "Runtime ready", ARCHIVED: "Archived", CURRENT: "Current profiles", ALL: "All statuses",
};

const STATUS_TRANSITIONS: Record<Exclude<ExperienceProfileStatus, "ARCHIVED">, readonly ExperienceProfileStatus[]> = {
  DRAFT: ["IN_DESIGN"],
  IN_DESIGN: ["DRAFT", "REVIEW"],
  REVIEW: ["IN_DESIGN", "VALIDATED"],
  VALIDATED: ["REVIEW", "RUNTIME_READY"],
  RUNTIME_READY: ["VALIDATED"],
};

export function canTransitionExperienceStatus(from: ExperienceProfileStatus, to: ExperienceProfileStatus) {
  if (from === to) return true;
  if (from === "ARCHIVED" || to === "ARCHIVED") return false;
  return STATUS_TRANSITIONS[from].includes(to);
}

export function isExperienceProfileStatus(value: string): value is ExperienceProfileStatus {
  return (EXPERIENCE_PROFILE_STATUSES as readonly string[]).includes(value);
}

export const EXPERIENCE_PRESET_TYPES = [
  "CINEMATIC", "COMPETITIVE", "BROADCAST", "MINIMAL", "DRAMATIC", "DOCUMENTARY", "CUSTOM",
] as const;
export type ExperiencePresetType = (typeof EXPERIENCE_PRESET_TYPES)[number];

export const BATTLE_EXPERIENCE_EVENT_TYPES = [
  "battle.started", "battle.attack", "battle.defend", "battle.dodged", "battle.critical_hit",
  "battle.damage", "battle.eliminated", "battle.timeout", "battle.completed",
] as const;
export type BattleExperienceEventType = (typeof BATTLE_EXPERIENCE_EVENT_TYPES)[number];

export const RACE_EXPERIENCE_EVENT_TYPES = [
  "race.started", "race.progress", "race.lead_changed", "race.checkpoint",
  "race.finished", "race.timeout", "race.completed",
] as const;
export type RaceExperienceEventType = (typeof RACE_EXPERIENCE_EVENT_TYPES)[number];

export const SURVIVAL_EXPERIENCE_EVENT_TYPES = [
  "survival.started", "survival.status", "survival.resource_changed", "survival.hazard",
  "survival.recovered", "survival.eliminated", "survival.leader_changed",
  "survival.timeout", "survival.completed",
] as const;
export type SurvivalExperienceEventType = (typeof SURVIVAL_EXPERIENCE_EVENT_TYPES)[number];

export const EXPERIENCE_EVENT_TYPES = [
  ...BATTLE_EXPERIENCE_EVENT_TYPES,
  ...RACE_EXPERIENCE_EVENT_TYPES,
  ...SURVIVAL_EXPERIENCE_EVENT_TYPES,
] as const;
export type ExperienceEventType = (typeof EXPERIENCE_EVENT_TYPES)[number];

export const CAMERA_CUES = [
  "DEFAULT", "OVERVIEW", "FOLLOW_ACTOR", "FOLLOW_TARGET", "TRACK_ACTION", "ATTACK_CLOSE",
  "REACTION_CLOSE", "DUEL_WIDE", "ELIMINATION_FOCUS", "WINNER_CLOSEUP", "RESULT_OVERVIEW",
  "INTRO_ESTABLISHING", "SPECTATOR", "CUSTOM",
] as const;
export const CAMERA_SUBJECTS = ["ACTOR", "TARGET", "WINNER", "ALL_PARTICIPANTS", "WORLD"] as const;
export const CAMERA_DISTANCES = ["CLOSE", "MEDIUM", "WIDE", "EXTREME_WIDE", "AUTO"] as const;
export const CAMERA_ANGLES = ["EYE_LEVEL", "LOW", "HIGH", "OVER_SHOULDER", "TOP_DOWN", "DYNAMIC", "AUTO"] as const;

export const VFX_CUES = [
  "NONE", "IMPACT_LIGHT", "IMPACT_HEAVY", "CRITICAL", "DODGE_TRAIL", "GUARD",
  "ELIMINATION", "VICTORY", "DUST", "SPLASH", "SPARK", "SMOKE", "CUSTOM",
] as const;

export const AUDIO_CUES = [
  "INTRO", "AMBIENT", "ATTACK", "HEAVY_ATTACK", "DODGE", "HIT", "CRITICAL", "DEFEND",
  "ELIMINATION", "VICTORY", "DEFEAT", "RESULT", "CUSTOM",
] as const;

export const HUD_CUES = [
  "SHOW_HEALTH", "SHOW_NAMES", "SHOW_RANKING", "SHOW_EVENT_MESSAGE", "SHOW_DAMAGE",
  "SHOW_TIMER", "SHOW_RESULT", "HIDE_HUD", "CUSTOM",
] as const;

export const EXPERIENCE_ASSET_ROLES = ["AUDIO", "VFX", "UI", "GRAPHIC"] as const;
export const EXPERIENCE_OVERRIDE_KINDS = ["ENTITY", "ARCHETYPE", "CATEGORY"] as const;

export const EXPERIENCE_SORTS = ["updated_desc", "updated_asc", "name_asc", "name_desc"] as const;
export type ExperienceSort = (typeof EXPERIENCE_SORTS)[number];
export const EXPERIENCE_SORT_LABELS: Record<ExperienceSort, string> = {
  updated_desc: "Recently updated", updated_asc: "Oldest updated",
  name_asc: "Name A–Z", name_desc: "Name Z–A",
};

export const EXPERIENCE_PROFILE_SCHEMA_VERSION = 1 as const;
export const EXPERIENCE_PAGE_SIZE = 18;
export const EXPERIENCE_MAX_PAGE_SIZE = 100;
