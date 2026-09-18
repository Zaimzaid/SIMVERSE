/**
 * Versioned Simulation configuration (Phase 2).
 *
 * A Simulation stores its logic configuration as a typed, versioned object
 * (`SimulationConfigV1`) and its presentation separately. This module is the
 * single, isolated home for:
 *   - the TypeScript shapes,
 *   - the option catalogs (with UI labels),
 *   - sensible defaults,
 *   - and the SERVER-SIDE validation that turns untrusted client JSON into a
 *     known-good, typed object.
 *
 * This file validates configuration; registered modules interpret selected values.
 * Battle v1 consumes format, roundLimit and allowTies. "speed", "difficulty"
 * and "random events" remain preferences in Battle v1. Raw browser JSON is NEVER written
 * to the database unvalidated; it always passes through `normalizeConfigInput`.
 *
 * Mode-specific settings are isolated behind a per-mode schema map
 * (`MODE_CONFIG_SCHEMAS`), so a new mode adds an entry here — never a new column.
 */

import { z } from "zod";
import { ValidationError, type FieldIssue } from "@/lib/errors";
import { SIMULATION_CONFIG_VERSION } from "./constants";

// ---------------------------------------------------------------------------
// General settings (Rules & Settings step). Generic and mode-agnostic.
// ---------------------------------------------------------------------------

export const SIMULATION_SPEEDS = ["slow", "normal", "fast"] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];
export const SIMULATION_SPEED_LABELS: Record<SimulationSpeed, string> = {
  slow: "Slow",
  normal: "Normal",
  fast: "Fast",
};

export const SIMULATION_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type SimulationDifficulty = (typeof SIMULATION_DIFFICULTIES)[number];
export const SIMULATION_DIFFICULTY_META: Record<
  SimulationDifficulty,
  { label: string; description: string }
> = {
  easy: { label: "Easy", description: "Forgiving preset." },
  normal: { label: "Normal", description: "Balanced preset." },
  hard: { label: "Hard", description: "Demanding preset." },
};

/** Upper bound for the optional round/turn limit (a configuration cap, not a runtime). */
export const ROUND_LIMIT_MAX = 100_000;

export interface SimulationGeneralConfig {
  speed: SimulationSpeed;
  /** Optional cap on rounds/turns/duration units. null = no explicit limit. */
  roundLimit: number | null;
  /** Preference for optional random events; Battle v1 records combat events independently. */
  randomEvents: boolean;
  allowTies: boolean;
  difficulty: SimulationDifficulty;
}

// ---------------------------------------------------------------------------
// Mode-specific settings. Mechanics remain in registered execution modules.
// ---------------------------------------------------------------------------

export const BATTLE_FORMATS = ["free_for_all", "duel", "team"] as const;
export type BattleFormat = (typeof BATTLE_FORMATS)[number];
export const BATTLE_FORMAT_LABELS: Record<BattleFormat, string> = {
  free_for_all: "Free-for-all",
  duel: "Duel (1v1)",
  team: "Team vs team",
};

export const RACE_STYLES = ["sprint", "endurance", "circuit"] as const;
export type RaceStyle = (typeof RACE_STYLES)[number];
export const RACE_STYLE_LABELS: Record<RaceStyle, string> = {
  sprint: "Sprint",
  endurance: "Endurance",
  circuit: "Circuit (laps)",
};

export const TOURNAMENT_FORMATS = ["single_elimination", "double_elimination", "round_robin"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export const TOURNAMENT_FORMAT_LABELS: Record<TournamentFormat, string> = {
  single_elimination: "Single elimination",
  double_elimination: "Double elimination",
  round_robin: "Round robin",
};

export const SURVIVAL_SCENARIOS = ["elimination", "endurance", "resource"] as const;
export type SurvivalScenario = (typeof SURVIVAL_SCENARIOS)[number];
export const SURVIVAL_SCENARIO_LABELS: Record<SurvivalScenario, string> = {
  elimination: "Elimination",
  endurance: "Endurance",
  resource: "Resource scarcity",
};

// ---------------------------------------------------------------------------
// The versioned config + presentation shapes.
// ---------------------------------------------------------------------------

export interface SimulationConfigV1 {
  version: typeof SIMULATION_CONFIG_VERSION;
  general: SimulationGeneralConfig;
  /** Mode-specific settings, validated per mode slug. Empty for unknown modes. */
  mode: Record<string, unknown>;
}

export interface SimulationPresentationConfig {
  /** Optional display title override; null = use the simulation's name. */
  displayTitle: string | null;
  /** Optional theme color (hex); null = default theme. */
  themeColor: string | null;
  showLabels: boolean;
  showLeaderboard: boolean;
}

// ---------------------------------------------------------------------------
// Defaults.
// ---------------------------------------------------------------------------

export function defaultGeneralConfig(): SimulationGeneralConfig {
  return {
    speed: "normal",
    roundLimit: null,
    randomEvents: true,
    allowTies: false,
    difficulty: "normal",
  };
}

/** Default mode-specific settings for a given mode slug (empty for unknown modes). */
export function defaultModeConfig(mode: string): Record<string, unknown> {
  switch (mode) {
    case "battle":
      return { format: "free_for_all" satisfies BattleFormat };
    case "race":
      return { raceStyle: "sprint" satisfies RaceStyle };
    case "tournament":
      return { format: "single_elimination" satisfies TournamentFormat };
    case "survival":
      return { scenarioType: "elimination" satisfies SurvivalScenario };
    default:
      return {};
  }
}

export function defaultConfigV1(mode: string): SimulationConfigV1 {
  return {
    version: SIMULATION_CONFIG_VERSION,
    general: defaultGeneralConfig(),
    mode: defaultModeConfig(mode),
  };
}

export function defaultPresentation(): SimulationPresentationConfig {
  return { displayTitle: null, themeColor: null, showLabels: true, showLeaderboard: true };
}

// ---------------------------------------------------------------------------
// Zod schemas (server-side authority).
// ---------------------------------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const generalConfigSchema = z.object({
  speed: z.enum(SIMULATION_SPEEDS).default("normal"),
  roundLimit: z
    .union([z.number().int().min(1).max(ROUND_LIMIT_MAX), z.null()])
    .default(null),
  randomEvents: z.boolean().default(true),
  allowTies: z.boolean().default(false),
  difficulty: z.enum(SIMULATION_DIFFICULTIES).default("normal"),
});

const presentationSchema = z.object({
  displayTitle: z
    .union([z.string().trim().max(120, "Display title must be at most 120 characters."), z.null()])
    .default(null)
    .transform((v) => (v ? v : null)),
  themeColor: z
    .union([z.string().trim().regex(HEX_COLOR, "Enter a 6-digit hex color, e.g. #22D3EE."), z.null()])
    .default(null)
    .transform((v) => (v ? v.toUpperCase() : null)),
  showLabels: z.boolean().default(true),
  showLeaderboard: z.boolean().default(true),
});

/**
 * Per-mode configuration schemas. Mechanics remain in modules, not this file.
 * Unknown modes have no entry and validate to an empty object.
 */
export const MODE_CONFIG_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  battle: z.object({ format: z.enum(BATTLE_FORMATS).default("free_for_all") }),
  race: z.object({ raceStyle: z.enum(RACE_STYLES).default("sprint") }),
  tournament: z.object({ format: z.enum(TOURNAMENT_FORMATS).default("single_elimination") }),
  survival: z.object({ scenarioType: z.enum(SURVIVAL_SCENARIOS).default("elimination") }),
};

function mapIssues(error: z.ZodError, prefix: string): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: `${prefix}.${issue.path.join(".")}`.replace(/\.$/, ""),
    message: issue.message,
  }));
}

/**
 * Validate untrusted config input for a given mode and return a typed, versioned
 * config. Throws ValidationError (with field issues) on malformed input — raw
 * client JSON never reaches the database.
 */
export function normalizeConfigInput(mode: string, input: unknown): SimulationConfigV1 {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const issues: FieldIssue[] = [];

  const generalResult = generalConfigSchema.safeParse(raw.general ?? {});
  if (!generalResult.success) issues.push(...mapIssues(generalResult.error, "configuration.general"));

  const modeSchema = MODE_CONFIG_SCHEMAS[mode];
  let modeConfig: Record<string, unknown> = {};
  if (modeSchema) {
    const modeResult = modeSchema.safeParse(raw.mode ?? {});
    if (!modeResult.success) issues.push(...mapIssues(modeResult.error, "configuration.mode"));
    else modeConfig = modeResult.data;
  }

  if (issues.length > 0) throw new ValidationError("Some simulation settings are invalid.", issues);

  return {
    version: SIMULATION_CONFIG_VERSION,
    general: generalResult.success ? generalResult.data : defaultGeneralConfig(),
    mode: modeConfig,
  };
}

/** Validate untrusted presentation input. Throws ValidationError on malformed input. */
export function normalizePresentationInput(input: unknown): SimulationPresentationConfig {
  const result = presentationSchema.safeParse(
    input && typeof input === "object" ? input : {},
  );
  if (!result.success) {
    throw new ValidationError("Some presentation settings are invalid.", mapIssues(result.error, "presentation"));
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Tolerant reads (stored JSON → typed object). Never throw; fall back to defaults.
// ---------------------------------------------------------------------------

/** Parse a stored configuration JSON string back into a typed config for a mode. */
export function parseStoredConfig(json: string | null, mode: string): SimulationConfigV1 {
  if (!json) return defaultConfigV1(mode);
  try {
    return normalizeConfigInput(mode, JSON.parse(json));
  } catch {
    return defaultConfigV1(mode);
  }
}

/** Parse a stored presentation JSON string back into a typed presentation config. */
export function parseStoredPresentation(json: string | null): SimulationPresentationConfig {
  if (!json) return defaultPresentation();
  try {
    return normalizePresentationInput(JSON.parse(json));
  } catch {
    return defaultPresentation();
  }
}
