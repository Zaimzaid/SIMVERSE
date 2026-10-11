import { z } from "zod";
import {
  SURVIVAL_CONDITION_MAX,
  SURVIVAL_HAZARD_CATEGORIES,
  SURVIVAL_MAX_PARTICIPANTS,
  SURVIVAL_MAX_TICKS,
  SURVIVAL_MODES,
  SURVIVAL_MODULE_ID,
  SURVIVAL_MODULE_VERSION,
  SURVIVAL_RESOURCE_MAX,
  SURVIVAL_RESULT_VERSION,
  SURVIVAL_STATE_VERSION,
  survivalConfigV1Schema,
} from "./config";
import { survivalProfileSchema } from "./stats";

const nonnegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();
const resourceValue = z.number().int().min(0).max(SURVIVAL_RESOURCE_MAX);
const conditionValue = z.number().int().min(0).max(SURVIVAL_CONDITION_MAX);

export const survivalCompletionReasonSchema = z.enum([
  "LAST_STANDING", "TIME_LIMIT", "ALL_ELIMINATED",
]);
export type SurvivalCompletionReason = z.infer<typeof survivalCompletionReasonSchema>;

export const survivalEliminationCauseSchema = z.enum([
  "CONDITION", "RESOURCE_DEPLETION", "HAZARD",
]);
export type SurvivalEliminationCause = z.infer<typeof survivalEliminationCauseSchema>;

export const survivalRankingEntrySchema = z.object({
  runParticipantId: z.string().min(1),
  rank: positiveInteger,
  tied: z.boolean(),
}).strict();
export type SurvivalRankingEntryV1 = z.infer<typeof survivalRankingEntrySchema>;

export const survivalParticipantStateSchema = z.object({
  runParticipantId: z.string().min(1),
  position: nonnegativeInteger,
  profile: survivalProfileSchema,
  condition: conditionValue,
  energy: resourceValue,
  supplies: resourceValue,
  active: z.boolean(),
  lastConditionLoss: nonnegativeInteger,
  lastEnergyDrain: nonnegativeInteger,
  lastSuppliesDrain: nonnegativeInteger,
  eliminationTick: z.number().int().min(1).max(SURVIVAL_MAX_TICKS).nullable(),
  eliminationTimeMs: nonnegativeInteger.nullable(),
  eliminationCause: survivalEliminationCauseSchema.nullable(),
  survivalTimeMs: nonnegativeInteger,
}).strict();
export type SurvivalParticipantStateV1 = z.infer<typeof survivalParticipantStateSchema>;

const lastHazardSchema = z.object({
  tick: positiveInteger,
  category: z.enum(SURVIVAL_HAZARD_CATEGORIES),
  intensity: z.number().int().min(1).max(100),
}).strict();

export const survivalStateSchema = z.object({
  version: z.literal(SURVIVAL_STATE_VERSION),
  config: survivalConfigV1Schema,
  currentTick: z.number().int().min(0).max(SURVIVAL_MAX_TICKS),
  simulatedTimeMs: nonnegativeInteger,
  participants: z.array(survivalParticipantStateSchema).min(2).max(SURVIVAL_MAX_PARTICIPANTS),
  ranking: z.array(survivalRankingEntrySchema).min(2).max(SURVIVAL_MAX_PARTICIPANTS),
  leaderRunParticipantIds: z.array(z.string().min(1)).max(SURVIVAL_MAX_PARTICIPANTS),
  hazardCount: nonnegativeInteger,
  lastHazard: lastHazardSchema.nullable(),
  completionReason: survivalCompletionReasonSchema.nullable(),
}).strict();
export type SurvivalStateV1 = z.infer<typeof survivalStateSchema>;

export const survivalParticipantResultSchema = z.object({
  runParticipantId: z.string().min(1),
  rank: positiveInteger,
  tied: z.boolean(),
  survived: z.boolean(),
  eliminationTick: z.number().int().min(1).max(SURVIVAL_MAX_TICKS).nullable(),
  eliminationTimeMs: nonnegativeInteger.nullable(),
  eliminationCause: survivalEliminationCauseSchema.nullable(),
  finalCondition: conditionValue,
  finalResources: z.object({ energy: resourceValue, supplies: resourceValue }).strict(),
  survivalDurationMs: nonnegativeInteger,
  profile: survivalProfileSchema,
}).strict();
export type SurvivalParticipantResultV1 = z.infer<typeof survivalParticipantResultSchema>;

export const survivalResultSchema = z.object({
  version: z.literal(SURVIVAL_RESULT_VERSION),
  moduleId: z.literal(SURVIVAL_MODULE_ID),
  moduleVersion: z.literal(SURVIVAL_MODULE_VERSION),
  mode: z.enum(SURVIVAL_MODES),
  completionReason: survivalCompletionReasonSchema,
  winnerRunParticipantId: z.string().min(1).nullable(),
  tiedParticipantIds: z.array(z.string().min(1)).max(SURVIVAL_MAX_PARTICIPANTS),
  ranking: z.array(survivalRankingEntrySchema).min(2).max(SURVIVAL_MAX_PARTICIPANTS),
  participants: z.array(survivalParticipantResultSchema).min(2).max(SURVIVAL_MAX_PARTICIPANTS),
  totalTicks: positiveInteger,
  simulatedDurationMs: positiveInteger,
  hazardCount: nonnegativeInteger,
}).strict();
export type SurvivalResultV1 = z.infer<typeof survivalResultSchema>;

const statusEntrySchema = z.object({
  runParticipantId: z.string().min(1),
  condition: conditionValue,
  energy: resourceValue,
  supplies: resourceValue,
  active: z.boolean(),
  survivalTimeMs: nonnegativeInteger,
  rank: positiveInteger,
  tied: z.boolean(),
}).strict();

const resourceChangeSchema = z.object({
  runParticipantId: z.string().min(1),
  resource: z.enum(["ENERGY", "SUPPLIES"]),
  before: resourceValue,
  after: resourceValue,
  reason: z.enum(["DEPLETED", "RECOVERY_COST"]),
}).strict();

const hazardImpactSchema = z.object({
  runParticipantId: z.string().min(1),
  conditionLoss: nonnegativeInteger,
  energyLoss: nonnegativeInteger,
  suppliesLoss: nonnegativeInteger,
}).strict();

const recoveryEntrySchema = z.object({
  runParticipantId: z.string().min(1),
  conditionRecovered: positiveInteger,
  energyCost: nonnegativeInteger,
  suppliesCost: nonnegativeInteger,
}).strict();

export const survivalActionPayloads = {
  "survival.advance": {
    version: 1,
    schema: z.object({ expectedTick: positiveInteger }).strict(),
  },
} as const;

export const survivalEventPayloads = {
  "survival.started": { version: 1, schema: z.object({
    mode: z.enum(SURVIVAL_MODES),
    config: survivalConfigV1Schema,
    maxTicks: z.number().int().min(1).max(SURVIVAL_MAX_TICKS),
    conditionMax: z.literal(SURVIVAL_CONDITION_MAX),
    eliminationThreshold: z.number().int().min(0).max(SURVIVAL_CONDITION_MAX - 1),
    hazardFrequency: z.number().int().min(0).max(100),
    hazardIntensity: z.number().int().min(0).max(100),
    participants: z.array(z.object({
      runParticipantId: z.string().min(1), profile: survivalProfileSchema,
    }).strict()).min(2).max(SURVIVAL_MAX_PARTICIPANTS),
  }).strict() },
  "survival.status": { version: 1, schema: z.object({
    participants: z.array(statusEntrySchema).min(2).max(SURVIVAL_MAX_PARTICIPANTS),
    leaderRunParticipantIds: z.array(z.string().min(1)).max(SURVIVAL_MAX_PARTICIPANTS),
  }).strict() },
  "survival.resource_changed": { version: 1, schema: z.object({
    changes: z.array(resourceChangeSchema).min(1).max(SURVIVAL_MAX_PARTICIPANTS * 2),
  }).strict() },
  "survival.hazard": { version: 1, schema: z.object({
    category: z.enum(SURVIVAL_HAZARD_CATEGORIES),
    intensity: z.number().int().min(1).max(100),
    impacts: z.array(hazardImpactSchema).min(1).max(SURVIVAL_MAX_PARTICIPANTS),
  }).strict() },
  "survival.recovered": { version: 1, schema: z.object({
    recoveries: z.array(recoveryEntrySchema).min(1).max(SURVIVAL_MAX_PARTICIPANTS),
  }).strict() },
  "survival.eliminated": { version: 1, schema: z.object({
    cause: survivalEliminationCauseSchema,
    eliminationTick: positiveInteger,
    eliminationTimeMs: nonnegativeInteger,
    condition: conditionValue,
    energy: resourceValue,
    supplies: resourceValue,
  }).strict() },
  "survival.leader_changed": { version: 1, schema: z.object({
    previousLeaderRunParticipantIds: z.array(z.string().min(1)).max(SURVIVAL_MAX_PARTICIPANTS),
    newLeaderRunParticipantIds: z.array(z.string().min(1)).max(SURVIVAL_MAX_PARTICIPANTS),
  }).strict() },
  "survival.timeout": { version: 1, schema: z.object({
    maxTicks: positiveInteger,
    survivingCount: nonnegativeInteger,
    eliminatedCount: nonnegativeInteger,
  }).strict() },
  "survival.completed": { version: 1, schema: z.object({
    completionReason: survivalCompletionReasonSchema,
    winnerRunParticipantId: z.string().min(1).nullable(),
    tiedParticipantIds: z.array(z.string().min(1)).max(SURVIVAL_MAX_PARTICIPANTS),
    ranking: z.array(survivalRankingEntrySchema).min(2).max(SURVIVAL_MAX_PARTICIPANTS),
  }).strict() },
} as const;

export const survivalResultPayloads = {
  "survival.result": { version: 1, schema: survivalResultSchema },
} as const;
