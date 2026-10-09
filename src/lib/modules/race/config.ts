import { z } from "zod";
import { EngineExecutionError } from "@/lib/engine/module";
import type { InputSnapshotV1 } from "@/lib/engine/schemas";

export const RACE_MODULE_ID = "race";
export const RACE_MODULE_VERSION = "race-v1";
export const RACE_CONFIG_VERSION = 1;
export const RACE_STATE_VERSION = 1;
export const RACE_RESULT_VERSION = 1;

export const RACE_MODES = ["SPRINT", "CIRCUIT"] as const;
export type RaceMode = (typeof RACE_MODES)[number];
export const RACE_MODE_LABELS: Record<RaceMode, string> = {
  SPRINT: "Sprint",
  CIRCUIT: "Circuit",
};

export const RACE_DISTANCE_UNITS = ["METER", "KILOMETER", "ABSTRACT_UNIT"] as const;
export type RaceDistanceUnit = (typeof RACE_DISTANCE_UNITS)[number];
export const RACE_DISTANCE_UNIT_LABELS: Record<RaceDistanceUnit, string> = {
  METER: "Meters",
  KILOMETER: "Kilometers",
  ABSTRACT_UNIT: "Abstract units",
};

export const RACE_MIN_PARTICIPANTS = 2;
export const RACE_MAX_PARTICIPANTS = 64;
export const RACE_MAX_DISTANCE = 1_000_000;
export const RACE_MAX_LAPS = 100;
export const RACE_MAX_TICKS = 5_000;
export const RACE_MAX_CHECKPOINTS = 12;
export const RACE_PROGRESS_SCALE = 1_000;
export const RACE_PROGRESS_EVENT_INTERVAL_TICKS = 5;

export const DEFAULT_RACE_DISTANCE = 1_000;
export const DEFAULT_RACE_MAX_TICKS = 500;
export const DEFAULT_RACE_VARIABILITY = 12;
export const DEFAULT_RACE_CHECKPOINTS = [25, 50, 75] as const;

export const RACE_STAT_NAMES = ["speed", "acceleration", "handling", "stamina", "luck"] as const;
export type RaceStatName = (typeof RACE_STAT_NAMES)[number];
export const DEFAULT_RACE_STAT_MAPPING: Record<RaceStatName, string> = {
  speed: "speed",
  acceleration: "acceleration",
  handling: "handling",
  stamina: "stamina",
  luck: "luck",
};

const statAttributeKey = z.string().trim().toLowerCase().min(1).max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use a lowercase Entity attribute key.");

export const raceStatMappingSchema = z.object({
  speed: statAttributeKey.default(DEFAULT_RACE_STAT_MAPPING.speed),
  acceleration: statAttributeKey.default(DEFAULT_RACE_STAT_MAPPING.acceleration),
  handling: statAttributeKey.default(DEFAULT_RACE_STAT_MAPPING.handling),
  stamina: statAttributeKey.default(DEFAULT_RACE_STAT_MAPPING.stamina),
  luck: statAttributeKey.default(DEFAULT_RACE_STAT_MAPPING.luck),
}).strict().superRefine((value, context) => {
  const keys = Object.values(value);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", message: "Race stat mappings must use distinct Entity attribute keys." });
  }
});

const preciseDistance = z.number().finite().positive().max(RACE_MAX_DISTANCE)
  .refine((value) => Number.isSafeInteger(Math.round(value * RACE_PROGRESS_SCALE)),
    "Distance supports at most three decimal places.")
  .refine((value) => Math.abs(value * RACE_PROGRESS_SCALE - Math.round(value * RACE_PROGRESS_SCALE)) < 1e-7,
    "Distance supports at most three decimal places.");

const baseRaceConfigSchema = z.object({
  version: z.literal(RACE_CONFIG_VERSION).default(RACE_CONFIG_VERSION),
  mode: z.enum(RACE_MODES).default("SPRINT"),
  distance: preciseDistance.default(DEFAULT_RACE_DISTANCE),
  distanceUnit: z.enum(RACE_DISTANCE_UNITS).default("METER"),
  laps: z.number().int().min(1).max(RACE_MAX_LAPS).default(1),
  maxTicks: z.number().int().min(1).max(RACE_MAX_TICKS).default(DEFAULT_RACE_MAX_TICKS),
  variability: z.number().int().min(0).max(100).default(DEFAULT_RACE_VARIABILITY),
  checkpoints: z.array(z.number().int().min(1).max(99)).max(RACE_MAX_CHECKPOINTS)
    .default([...DEFAULT_RACE_CHECKPOINTS]),
  statMapping: raceStatMappingSchema.default(DEFAULT_RACE_STAT_MAPPING),
}).strict().superRefine((value, context) => {
  if (value.mode === "SPRINT" && value.laps !== 1) {
    context.addIssue({ code: "custom", path: ["laps"], message: "Sprint races use exactly one lap." });
  }
  if (value.mode === "CIRCUIT" && value.laps < 2) {
    context.addIssue({ code: "custom", path: ["laps"], message: "Circuit races require at least two laps." });
  }
  if (new Set(value.checkpoints).size !== value.checkpoints.length) {
    context.addIssue({ code: "custom", path: ["checkpoints"], message: "Checkpoint percentages must be unique." });
  }
});

function legacyRaceConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ("version" in record || "mode" in record || !("raceStyle" in record)) return value;
  if (record.raceStyle === "sprint") return {};
  if (record.raceStyle === "circuit") return { mode: "CIRCUIT", laps: 3 };
  return value;
}

/** Canonical stored and execution configuration for Race v1. */
export const raceConfigV1Schema = z.preprocess(legacyRaceConfig, baseRaceConfigSchema.transform((value) => ({
  ...value,
  checkpoints: [...value.checkpoints].sort((a, b) => a - b),
})));
export type RaceConfigV1 = z.infer<typeof raceConfigV1Schema>;

export interface RaceExecutionConfigV1 extends RaceConfigV1 {
  courseDistanceMilli: number;
  totalDistanceMilli: number;
}

export function defaultRaceConfigV1(): RaceConfigV1 {
  return raceConfigV1Schema.parse({});
}

function distanceMultiplier(unit: RaceDistanceUnit): number {
  return unit === "KILOMETER" ? 1_000_000 : RACE_PROGRESS_SCALE;
}

export function resolveRaceExecutionConfig(input: InputSnapshotV1): RaceExecutionConfigV1 {
  const parsed = raceConfigV1Schema.safeParse(input.configuration.mode);
  if (!parsed.success) {
    throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "Race configuration is invalid.");
  }
  const courseDistanceMilli = Math.round(parsed.data.distance * distanceMultiplier(parsed.data.distanceUnit));
  const totalDistanceMilli = courseDistanceMilli * parsed.data.laps;
  if (!Number.isSafeInteger(courseDistanceMilli) || courseDistanceMilli < 1 ||
      !Number.isSafeInteger(totalDistanceMilli) || totalDistanceMilli < 1) {
    throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "Race distance is outside the supported range.");
  }
  return { ...parsed.data, courseDistanceMilli, totalDistanceMilli };
}

/** READY and detail-page execution eligibility for Race v1. */
export function raceExecutionIssue(config: unknown, participantCount: number): string | null {
  if (!raceConfigV1Schema.safeParse(config).success) return "Race configuration is invalid or unsupported.";
  if (participantCount < RACE_MIN_PARTICIPANTS) return `Race requires at least ${RACE_MIN_PARTICIPANTS} participants.`;
  if (participantCount > RACE_MAX_PARTICIPANTS) return `Race v1 supports at most ${RACE_MAX_PARTICIPANTS} participants.`;
  return null;
}
