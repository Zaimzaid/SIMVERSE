import { z } from "zod";
import { EngineExecutionError } from "@/lib/engine/module";
import type { InputSnapshotV1 } from "@/lib/engine/schemas";

export const SURVIVAL_MODULE_ID = "survival";
export const SURVIVAL_MODULE_VERSION = "survival-v1";
export const SURVIVAL_CONFIG_VERSION = 1;
export const SURVIVAL_STATE_VERSION = 1;
export const SURVIVAL_RESULT_VERSION = 1;

export const SURVIVAL_MODES = ["LAST_STANDING", "ENDURANCE"] as const;
export type SurvivalMode = (typeof SURVIVAL_MODES)[number];
export const SURVIVAL_MODE_LABELS: Record<SurvivalMode, string> = {
  LAST_STANDING: "Last standing",
  ENDURANCE: "Endurance",
};

export const SURVIVAL_HAZARD_CATEGORIES = [
  "ENVIRONMENT", "RESOURCE_SHORTAGE", "FATIGUE", "ACCIDENT", "EXTREME_CONDITION", "CUSTOM",
] as const;
export type SurvivalHazardCategory = (typeof SURVIVAL_HAZARD_CATEGORIES)[number];

export const SURVIVAL_MIN_PARTICIPANTS = 2;
export const SURVIVAL_MAX_PARTICIPANTS = 64;
export const SURVIVAL_MAX_TICKS = 10_000;
export const SURVIVAL_CONDITION_MAX = 100_000;
export const SURVIVAL_RESOURCE_MAX = 100_000;
export const SURVIVAL_MAX_DRAIN = 10_000;
export const SURVIVAL_MAX_DEPLETION_PENALTY = 20_000;
export const SURVIVAL_MAX_RECOVERY = 10_000;
export const SURVIVAL_MAX_RECOVERY_INTERVAL = 1_000;
export const SURVIVAL_STATUS_EVENT_INTERVAL_TICKS = 5;

export const DEFAULT_SURVIVAL_MAX_TICKS = 500;
export const DEFAULT_SURVIVAL_STAT_MAPPING = {
  endurance: "endurance",
  resilience: "resilience",
  resourceEfficiency: "resource_efficiency",
  adaptability: "adaptability",
  awareness: "awareness",
  luck: "luck",
} as const;

export const SURVIVAL_STAT_NAMES = [
  "endurance", "resilience", "resourceEfficiency", "adaptability", "awareness", "luck",
] as const;
export type SurvivalStatName = (typeof SURVIVAL_STAT_NAMES)[number];

const attributeKey = z.string().trim().toLowerCase().min(1).max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use a lowercase Entity attribute key.");

export const survivalStatMappingSchema = z.object({
  endurance: attributeKey.default(DEFAULT_SURVIVAL_STAT_MAPPING.endurance),
  resilience: attributeKey.default(DEFAULT_SURVIVAL_STAT_MAPPING.resilience),
  resourceEfficiency: attributeKey.default(DEFAULT_SURVIVAL_STAT_MAPPING.resourceEfficiency),
  adaptability: attributeKey.default(DEFAULT_SURVIVAL_STAT_MAPPING.adaptability),
  awareness: attributeKey.default(DEFAULT_SURVIVAL_STAT_MAPPING.awareness),
  luck: attributeKey.default(DEFAULT_SURVIVAL_STAT_MAPPING.luck),
}).strict().superRefine((value, context) => {
  if (new Set(Object.values(value)).size !== SURVIVAL_STAT_NAMES.length) {
    context.addIssue({ code: "custom", message: "Survival stat mappings must use distinct Entity attribute keys." });
  }
});

export const survivalResourceConfigSchema = z.object({
  initialEnergy: z.number().int().min(0).max(SURVIVAL_RESOURCE_MAX).default(SURVIVAL_RESOURCE_MAX),
  initialSupplies: z.number().int().min(0).max(SURVIVAL_RESOURCE_MAX).default(SURVIVAL_RESOURCE_MAX),
  baseEnergyDrain: z.number().int().min(1).max(SURVIVAL_MAX_DRAIN).default(300),
  baseSuppliesDrain: z.number().int().min(1).max(SURVIVAL_MAX_DRAIN).default(160),
  depletionConditionPenalty: z.number().int().min(0).max(SURVIVAL_MAX_DEPLETION_PENALTY).default(500),
}).strict();

export const survivalRecoveryConfigSchema = z.object({
  amount: z.number().int().min(0).max(SURVIVAL_MAX_RECOVERY).default(400),
  intervalTicks: z.number().int().min(1).max(SURVIVAL_MAX_RECOVERY_INTERVAL).default(10),
  energyCost: z.number().int().min(0).max(SURVIVAL_MAX_DRAIN).default(200),
  suppliesCost: z.number().int().min(0).max(SURVIVAL_MAX_DRAIN).default(100),
}).strict();

const baseSurvivalConfigSchema = z.object({
  version: z.literal(SURVIVAL_CONFIG_VERSION).default(SURVIVAL_CONFIG_VERSION),
  mode: z.enum(SURVIVAL_MODES).default("LAST_STANDING"),
  maxTicks: z.number().int().min(1).max(SURVIVAL_MAX_TICKS).default(DEFAULT_SURVIVAL_MAX_TICKS),
  baseConditionDrain: z.number().int().min(0).max(SURVIVAL_MAX_DRAIN).default(120),
  hazardFrequency: z.number().int().min(0).max(100).default(15),
  hazardIntensity: z.number().int().min(0).max(100).default(35),
  variability: z.number().int().min(0).max(100).default(20),
  eliminationThreshold: z.number().int().min(0).max(SURVIVAL_CONDITION_MAX - 1).default(0),
  resources: survivalResourceConfigSchema.default({
    initialEnergy: SURVIVAL_RESOURCE_MAX,
    initialSupplies: SURVIVAL_RESOURCE_MAX,
    baseEnergyDrain: 300,
    baseSuppliesDrain: 160,
    depletionConditionPenalty: 500,
  }),
  recovery: survivalRecoveryConfigSchema.default({
    amount: 400,
    intervalTicks: 10,
    energyCost: 200,
    suppliesCost: 100,
  }),
  statMapping: survivalStatMappingSchema.default(DEFAULT_SURVIVAL_STAT_MAPPING),
}).strict().superRefine((value, context) => {
  if (value.hazardFrequency > 0 && value.hazardIntensity === 0) {
    context.addIssue({
      code: "custom",
      path: ["hazardIntensity"],
      message: "Hazard intensity must be at least 1 when hazards are enabled.",
    });
  }
  if (value.recovery.amount > 0 && value.recovery.energyCost === 0 && value.recovery.suppliesCost === 0) {
    context.addIssue({
      code: "custom",
      path: ["recovery"],
      message: "Configured recovery must consume energy, supplies, or both.",
    });
  }
});

function legacySurvivalConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ("version" in record || "mode" in record || !("scenarioType" in record)) return value;
  return record.scenarioType === "endurance" || record.scenarioType === "resource"
    ? { mode: "ENDURANCE" }
    : record.scenarioType === "elimination" ? { mode: "LAST_STANDING" } : value;
}

export const survivalConfigV1Schema = z.preprocess(legacySurvivalConfig, baseSurvivalConfigSchema);
export type SurvivalConfigV1 = z.infer<typeof survivalConfigV1Schema>;

export function defaultSurvivalConfigV1(): SurvivalConfigV1 {
  return survivalConfigV1Schema.parse({});
}

export function resolveSurvivalExecutionConfig(input: InputSnapshotV1): SurvivalConfigV1 {
  const parsed = survivalConfigV1Schema.safeParse(input.configuration.mode);
  if (!parsed.success) {
    throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "Survival configuration is invalid.");
  }
  return parsed.data;
}

export function survivalExecutionIssue(config: unknown, participantCount: number): string | null {
  if (!survivalConfigV1Schema.safeParse(config).success) return "Survival configuration is invalid or unsupported.";
  if (participantCount < SURVIVAL_MIN_PARTICIPANTS) return `Survival requires at least ${SURVIVAL_MIN_PARTICIPANTS} participants.`;
  if (participantCount > SURVIVAL_MAX_PARTICIPANTS) return `Survival v1 supports at most ${SURVIVAL_MAX_PARTICIPANTS} participants.`;
  return null;
}
