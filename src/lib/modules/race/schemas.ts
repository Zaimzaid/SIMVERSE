import { z } from "zod";
import {
  RACE_MAX_CHECKPOINTS, RACE_MAX_DISTANCE, RACE_MAX_LAPS, RACE_MAX_PARTICIPANTS,
  RACE_MAX_TICKS, RACE_MODULE_ID, RACE_MODULE_VERSION, RACE_RESULT_VERSION, RACE_STATE_VERSION,
} from "./config";
import { raceProfileSchema } from "./stats";

const nonnegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();

export const raceExecutionConfigSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["SPRINT", "CIRCUIT"]),
  distance: z.number().finite().positive().max(RACE_MAX_DISTANCE),
  distanceUnit: z.enum(["METER", "KILOMETER", "ABSTRACT_UNIT"]),
  laps: z.number().int().min(1).max(RACE_MAX_LAPS),
  maxTicks: z.number().int().min(1).max(RACE_MAX_TICKS),
  variability: z.number().int().min(0).max(100),
  checkpoints: z.array(z.number().int().min(1).max(99)).max(RACE_MAX_CHECKPOINTS),
  statMapping: z.object({
    speed: z.string().min(1), acceleration: z.string().min(1), handling: z.string().min(1),
    stamina: z.string().min(1), luck: z.string().min(1),
  }).strict(),
  courseDistanceMilli: positiveInteger,
  totalDistanceMilli: positiveInteger,
}).strict();

export const raceRankingEntrySchema = z.object({
  runParticipantId: z.string().min(1),
  rank: positiveInteger,
  tied: z.boolean(),
}).strict();
export type RaceRankingEntryV1 = z.infer<typeof raceRankingEntrySchema>;

export const raceParticipantStateSchema = z.object({
  runParticipantId: z.string().min(1),
  position: nonnegativeInteger,
  profile: raceProfileSchema,
  progressMilli: nonnegativeInteger,
  lastDeltaMilli: nonnegativeInteger,
  currentLap: positiveInteger,
  lapsCompleted: nonnegativeInteger,
  checkpointKeys: z.array(z.string().regex(/^\d+:[1-9]\d?$/)),
  finished: z.boolean(),
  finishTimeMicros: nonnegativeInteger.nullable(),
}).strict();
export type RaceParticipantStateV1 = z.infer<typeof raceParticipantStateSchema>;

export const raceStateSchema = z.object({
  version: z.literal(RACE_STATE_VERSION),
  config: raceExecutionConfigSchema,
  currentTick: nonnegativeInteger,
  simulatedTimeMs: nonnegativeInteger,
  participants: z.array(raceParticipantStateSchema).min(2).max(RACE_MAX_PARTICIPANTS),
  ranking: z.array(raceRankingEntrySchema).min(2).max(RACE_MAX_PARTICIPANTS),
  leaderRunParticipantIds: z.array(z.string()),
  completionReason: z.enum(["ALL_FINISHED", "TIME_LIMIT"]).nullable(),
}).strict();
export type RaceStateV1 = z.infer<typeof raceStateSchema>;

export const raceParticipantResultSchema = z.object({
  runParticipantId: z.string().min(1),
  rank: positiveInteger,
  tied: z.boolean(),
  finished: z.boolean(),
  finishTimeMicros: nonnegativeInteger.nullable(),
  distanceMilli: nonnegativeInteger,
  lapsCompleted: nonnegativeInteger,
  profile: raceProfileSchema,
}).strict();
export type RaceParticipantResultV1 = z.infer<typeof raceParticipantResultSchema>;

export const raceResultSchema = z.object({
  version: z.literal(RACE_RESULT_VERSION),
  moduleId: z.literal(RACE_MODULE_ID),
  moduleVersion: z.literal(RACE_MODULE_VERSION),
  mode: z.enum(["SPRINT", "CIRCUIT"]),
  distance: z.number().finite().positive(),
  distanceUnit: z.enum(["METER", "KILOMETER", "ABSTRACT_UNIT"]),
  laps: positiveInteger,
  totalDistanceMilli: positiveInteger,
  completionReason: z.enum(["ALL_FINISHED", "TIME_LIMIT"]),
  winnerRunParticipantId: z.string().nullable(),
  tiedParticipantIds: z.array(z.string()),
  ranking: z.array(raceRankingEntrySchema).min(2).max(RACE_MAX_PARTICIPANTS),
  participants: z.array(raceParticipantResultSchema).min(2).max(RACE_MAX_PARTICIPANTS),
  totalTicks: positiveInteger,
  simulatedDurationMs: positiveInteger,
}).strict();
export type RaceResultV1 = z.infer<typeof raceResultSchema>;

const progressEntrySchema = z.object({
  runParticipantId: z.string().min(1),
  progressMilli: nonnegativeInteger,
  deltaMilli: nonnegativeInteger,
  currentLap: positiveInteger,
  lapsCompleted: nonnegativeInteger,
  finished: z.boolean(),
  finishTimeMicros: nonnegativeInteger.nullable(),
  rank: positiveInteger,
  tied: z.boolean(),
}).strict();

export const raceActionPayloads = {
  "race.advance": { version: 1, schema: z.object({ expectedTick: positiveInteger }).strict() },
} as const;

export const raceEventPayloads = {
  "race.started": { version: 1, schema: z.object({
    mode: z.enum(["SPRINT", "CIRCUIT"]), distance: z.number().finite().positive(),
    distanceUnit: z.enum(["METER", "KILOMETER", "ABSTRACT_UNIT"]), laps: positiveInteger,
    totalDistanceMilli: positiveInteger, maxTicks: positiveInteger,
    checkpoints: z.array(z.number().int().min(1).max(99)),
    participants: z.array(z.object({ runParticipantId: z.string().min(1), profile: raceProfileSchema }).strict()),
  }).strict() },
  "race.progress": { version: 1, schema: z.object({
    participants: z.array(progressEntrySchema), leaderRunParticipantIds: z.array(z.string()),
  }).strict() },
  "race.lead_changed": { version: 1, schema: z.object({
    previousLeaderRunParticipantIds: z.array(z.string()), newLeaderRunParticipantIds: z.array(z.string()),
  }).strict() },
  "race.checkpoint": { version: 1, schema: z.object({
    checkpointPercent: z.number().int().min(1).max(99), lap: positiveInteger, progressMilli: nonnegativeInteger,
  }).strict() },
  "race.finished": { version: 1, schema: z.object({
    finishTimeMicros: nonnegativeInteger, finishPosition: positiveInteger, tied: z.boolean(),
    totalDistanceMilli: positiveInteger, lapsCompleted: positiveInteger,
  }).strict() },
  "race.timeout": { version: 1, schema: z.object({
    maxTicks: positiveInteger, finishedCount: nonnegativeInteger, unfinishedCount: nonnegativeInteger,
  }).strict() },
  "race.completed": { version: 1, schema: z.object({
    completionReason: z.enum(["ALL_FINISHED", "TIME_LIMIT"]),
    winnerRunParticipantId: z.string().nullable(), tiedParticipantIds: z.array(z.string()),
    ranking: z.array(raceRankingEntrySchema),
  }).strict() },
} as const;

export const raceResultPayloads = {
  "race.result": { version: 1, schema: raceResultSchema },
} as const;
