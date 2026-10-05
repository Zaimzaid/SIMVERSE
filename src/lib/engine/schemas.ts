import { z } from "zod";
import { SEED_REGEX } from "@/lib/simulations/seed";
import { SIMULATION_DIFFICULTIES, SIMULATION_SPEEDS } from "@/lib/simulations/config";
import { ENGINE_STATE_VERSION, INPUT_SNAPSHOT_VERSION, RESULT_VERSION } from "./constants";
import { rngStateSchema } from "./rng";
import { visualProfileSnapshotSchema } from "@/lib/visuals/profile";
import { worldRunSnapshotSchema } from "@/lib/worlds/schemas";

export const jsonRecordSchema = z.record(z.string(), z.json());
export type JsonRecord = z.infer<typeof jsonRecordSchema>;

const attributeSnapshotSchema = z.object({
  definitionId: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  dataType: z.string().min(1),
  unit: z.string().nullable(),
  minimum: z.number().finite().nullable(),
  maximum: z.number().finite().nullable(),
  options: z.array(z.string()).nullable(),
  defaultValue: z.string().nullable(),
  isBuiltIn: z.boolean(),
  value: z.string(),
}).strict();

const tagSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
}).strict();

export const participantSnapshotSchema = z.object({
  runParticipantId: z.string().min(1),
  sourceEntityId: z.string().min(1),
  position: z.number().int().nonnegative(),
  role: z.string().nullable(),
  overrides: jsonRecordSchema.nullable(),
  name: z.string().min(1),
  shortName: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().min(1),
  status: z.string().min(1),
  imageUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
  metadata: jsonRecordSchema.nullable(),
  // Optional for Phase 3-5 snapshot compatibility. New runs freeze versioned
  // visual identity here rather than reading the mutable Entity during replay.
  visualProfileVersion: z.literal(1).optional(),
  visualProfile: visualProfileSnapshotSchema.nullable().optional(),
  tags: z.array(tagSnapshotSchema),
  attributes: z.array(attributeSnapshotSchema),
}).strict();
export type ParticipantSnapshotV1 = z.infer<typeof participantSnapshotSchema>;

export const configurationSnapshotSchema = z.object({
  version: z.literal(1),
  general: z.object({
    speed: z.enum(SIMULATION_SPEEDS),
    roundLimit: z.number().int().positive().nullable(),
    randomEvents: z.boolean(),
    allowTies: z.boolean(),
    difficulty: z.enum(SIMULATION_DIFFICULTIES),
  }).strict(),
  mode: jsonRecordSchema,
}).strict();

export const presentationSnapshotSchema = z.object({
  displayTitle: z.string().nullable(),
  themeColor: z.string().nullable(),
  showLabels: z.boolean(),
  showLeaderboard: z.boolean(),
}).strict();

export const inputSnapshotSchema = z.object({
  version: z.literal(INPUT_SNAPSHOT_VERSION),
  simulationId: z.string().min(1),
  simulationName: z.string().min(1),
  mode: z.string().min(1),
  configVersion: z.literal(1),
  configuration: configurationSnapshotSchema,
  presentation: presentationSnapshotSchema,
  resolvedSeed: z.string().regex(SEED_REGEX),
  participants: z.array(participantSnapshotSchema).max(500),
  // Optional so Phase 3–7A Runs remain valid. New World-bound Runs freeze the
  // complete immutable World version instead of reading current World state.
  world: worldRunSnapshotSchema.nullable().optional(),
}).strict();
export type InputSnapshotV1 = z.infer<typeof inputSnapshotSchema>;

export const engineStateSchema = z.object({
  version: z.literal(ENGINE_STATE_VERSION),
  tick: z.number().int().nonnegative(),
  elapsedSimulationMs: z.number().int().nonnegative(),
  rng: rngStateSchema,
  globalState: jsonRecordSchema,
  participantStates: z.record(z.string(), jsonRecordSchema),
  moduleState: jsonRecordSchema,
}).strict();
export type EngineStateV1 = z.infer<typeof engineStateSchema>;

const envelopeBase = z.object({
  sequence: z.number().int().positive(),
  tick: z.number().int().positive(),
  type: z.string().trim().min(1).max(120),
  actorRunParticipantId: z.string().nullable(),
  targetRunParticipantId: z.string().nullable(),
  payloadVersion: z.number().int().positive(),
  payload: jsonRecordSchema,
});

export const engineActionSchema = envelopeBase.strict();
export type EngineAction = z.infer<typeof engineActionSchema>;
export const engineEventSchema = envelopeBase.extend({
  simulatedTimeMs: z.number().int().nonnegative(),
}).strict();
export type EngineEvent = z.infer<typeof engineEventSchema>;

export const resultEnvelopeSchema = z.object({
  version: z.literal(RESULT_VERSION),
  resultType: z.string().trim().min(1).max(120),
  summary: z.string().max(1000),
  metrics: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])),
  modulePayloadVersion: z.number().int().positive(),
  modulePayload: jsonRecordSchema,
}).strict();
export type ResultEnvelopeV1 = z.infer<typeof resultEnvelopeSchema>;

/** Prevent a module or stored record from growing an unbounded JSON column. */
export function stringifyBounded(value: unknown, maxCharacters = 8_000_000): string {
  const text = JSON.stringify(value);
  if (!text || text.length > maxCharacters) throw new Error("Versioned payload exceeds its size limit.");
  return text;
}
