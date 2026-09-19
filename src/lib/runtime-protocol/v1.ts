import { z } from "zod";
import {
  CORE_ENGINE_VERSION,
  INPUT_SNAPSHOT_VERSION,
  RESULT_VERSION,
} from "@/lib/engine/constants";
import {
  engineEventSchema,
  inputSnapshotSchema,
  participantSnapshotSchema,
  resultEnvelopeSchema,
  type EngineEvent,
  type InputSnapshotV1,
  type ParticipantSnapshotV1,
  type ResultEnvelopeV1,
} from "@/lib/engine/schemas";
import { RNG_ALGORITHM_VERSION } from "@/lib/engine/rng";
import {
  BATTLE_MODULE_ID,
  BATTLE_MODULE_VERSION,
  BATTLE_RESULT_VERSION,
} from "@/lib/modules/battle/config";
import {
  battleEventPayloads,
  battleResultSchema,
} from "@/lib/modules/battle/schemas";
import { SEED_REGEX } from "@/lib/simulations/seed";
import {
  animationProfileSchema,
  VISUAL_ARCHETYPES,
  VISUAL_SOURCE_TYPES,
} from "@/lib/visuals/profile";

export const RUNTIME_PROTOCOL_VERSION_V1 = "1.0.0" as const;
export const RUNTIME_PACKAGE_TYPE_V1 = "SimulationRuntimePackageV1" as const;
export const RUNTIME_SEED_SOURCE_V1 = "RUN_INPUT_SNAPSHOT" as const;

export type RuntimeProtocolErrorCode =
  | "RUN_NOT_COMPLETED"
  | "UNSUPPORTED_MODULE"
  | "UNSUPPORTED_VERSION"
  | "MISSING_RESULT"
  | "CORRUPT_HISTORY"
  | "INVALID_PACKAGE";

export class RuntimeProtocolError extends Error {
  constructor(
    readonly code: RuntimeProtocolErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RuntimeProtocolError";
  }
}

const isoDateSchema = z.string().datetime({ offset: true });
const nullableReferenceSchema = z.string().min(1).max(1_400_000).nullable();

export const runtimeWorldBindingV1Schema = z.object({
  worldId: z.string().min(1).max(200),
  version: z.string().min(1).max(100),
  manifestReference: z.string().min(1).max(2048),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  spawnSet: z.string().min(1).max(200).nullable(),
  environmentPreset: z.string().min(1).max(200).nullable(),
}).strict();
export type RuntimeWorldBindingV1 = z.infer<typeof runtimeWorldBindingV1Schema>;

const runtimeVisualSnapshotV1Schema = z.object({
  snapshotVersion: z.literal(1),
  profileRevision: z.number().int().positive(),
  sourceType: z.enum(VISUAL_SOURCE_TYPES),
  archetype: z.enum(VISUAL_ARCHETYPES),
  portraitReference: nullableReferenceSchema,
  modelReference: nullableReferenceSchema,
  transform: z.object({
    scale: z.number().finite().min(0.05).max(20),
    rotationDegrees: z.object({
      x: z.number().finite().min(-360).max(360),
      y: z.number().finite().min(-360).max(360),
      z: z.number().finite().min(-360).max(360),
    }).strict(),
    offsetMeters: z.object({
      x: z.number().finite().min(-100).max(100),
      y: z.number().finite().min(-100).max(100),
      z: z.number().finite().min(-100).max(100),
    }).strict(),
  }).strict(),
  animationMapping: animationProfileSchema,
}).strict();

const runtimeParticipantV1Schema = z.object({
  runParticipantId: z.string().min(1).max(200),
  position: z.number().int().nonnegative(),
  sourceEntityId: z.string().min(1).max(200),
  role: z.string().min(1).max(120).nullable(),
  identity: z.object({
    displayName: z.string().min(1).max(200),
    shortName: z.string().min(1).max(100).nullable(),
    category: z.string().min(1).max(120),
    imageReference: nullableReferenceSchema,
    primaryColor: z.string().min(1).max(100).nullable(),
    secondaryColor: z.string().min(1).max(100).nullable(),
  }).strict(),
  visual: runtimeVisualSnapshotV1Schema.nullable(),
}).strict();

const runtimeEventBase = {
  eventId: z.string().min(1).max(200),
  sequence: z.number().int().positive(),
  tick: z.number().int().positive(),
  simulatedTimeMs: z.number().int().nonnegative(),
  actorRunParticipantId: z.string().min(1).max(200).nullable(),
  targetRunParticipantId: z.string().min(1).max(200).nullable(),
};

function battleEventSchema<Type extends keyof typeof battleEventPayloads>(type: Type) {
  const definition = battleEventPayloads[type];
  return z.object({
    ...runtimeEventBase,
    type: z.literal(type),
    payloadVersion: z.literal(definition.version),
    payload: definition.schema,
  }).strict();
}

export const runtimeBattleEventV1Schema = z.union([
  battleEventSchema("battle.started"),
  battleEventSchema("battle.defend"),
  battleEventSchema("battle.attack"),
  battleEventSchema("battle.dodged"),
  battleEventSchema("battle.critical_hit"),
  battleEventSchema("battle.damage"),
  battleEventSchema("battle.eliminated"),
  battleEventSchema("battle.timeout"),
  battleEventSchema("battle.completed"),
]);

const runtimeResultV1Schema = z.object({
  envelopeVersion: z.literal(RESULT_VERSION),
  type: z.literal("battle.result"),
  summary: resultEnvelopeSchema.shape.summary,
  metrics: resultEnvelopeSchema.shape.metrics,
  payloadVersion: z.literal(BATTLE_RESULT_VERSION),
  payload: battleResultSchema,
}).strict();

function addIssue(
  context: z.core.$RefinementCtx<unknown>,
  path: PropertyKey[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

function hasSensitiveCredentials(reference: string | null): boolean {
  if (!reference || reference.startsWith("/") || reference.startsWith("data:")) return false;
  try {
    const url = new URL(reference);
    if (url.username || url.password) return true;
    return [...url.searchParams.keys()].some((key) =>
      /(?:token|secret|signature|credential|api[_-]?key|access[_-]?key)/i.test(key));
  } catch {
    return false;
  }
}

function allKnown(ids: readonly string[], participantIds: ReadonlySet<string>): boolean {
  return ids.every((id) => participantIds.has(id));
}

export const simulationRuntimePackageV1Schema = z.object({
  packageType: z.literal(RUNTIME_PACKAGE_TYPE_V1),
  protocolVersion: z.literal(RUNTIME_PROTOCOL_VERSION_V1),
  run: z.object({
    runId: z.string().min(1).max(200),
    simulationId: z.string().min(1).max(200),
    simulationName: z.string().min(1).max(200),
    status: z.literal("COMPLETED"),
    mode: z.literal("battle"),
    createdAt: isoDateSchema,
    startedAt: isoDateSchema,
    completedAt: isoDateSchema,
    fixedStepMs: z.number().int().positive(),
    totalTicks: z.number().int().positive(),
    simulatedDurationMs: z.number().int().positive(),
  }).strict(),
  module: z.object({
    id: z.literal(BATTLE_MODULE_ID),
    version: z.literal(BATTLE_MODULE_VERSION),
  }).strict(),
  versions: z.object({
    coreEngine: z.literal(CORE_ENGINE_VERSION),
    rngAlgorithm: z.literal(RNG_ALGORITHM_VERSION),
    inputSnapshot: z.literal(INPUT_SNAPSHOT_VERSION),
    resultEnvelope: z.literal(RESULT_VERSION),
  }).strict(),
  seedProvenance: z.object({
    resolvedSeed: z.string().regex(SEED_REGEX),
    source: z.literal(RUNTIME_SEED_SOURCE_V1),
  }).strict(),
  participants: z.array(runtimeParticipantV1Schema).min(2).max(500),
  world: runtimeWorldBindingV1Schema.nullable(),
  events: z.array(runtimeBattleEventV1Schema).min(1).max(10_000),
  result: runtimeResultV1Schema,
  presentation: z.object({
    profileVersion: z.literal(1),
    displayTitle: z.string().min(1).max(200),
    themeColor: z.string().min(1).max(100).nullable(),
    showLabels: z.boolean(),
    showLeaderboard: z.boolean(),
  }).strict(),
}).strict().superRefine((value, context) => {
  const participantIds = new Set(value.participants.map((participant) => participant.runParticipantId));
  const positions = new Set(value.participants.map((participant) => participant.position));
  const sourceEntityIds = new Set(value.participants.map((participant) => participant.sourceEntityId));
  if (participantIds.size !== value.participants.length) {
    addIssue(context, ["participants"], "Run participant IDs must be unique.");
  }
  if (positions.size !== value.participants.length ||
      value.participants.some((participant, index) => participant.position !== index)) {
    addIssue(context, ["participants"], "Participant positions must be unique and contiguous from zero.");
  }
  if (sourceEntityIds.size !== value.participants.length) {
    addIssue(context, ["participants"], "Historical source Entity IDs must be unique.");
  }

  value.participants.forEach((participant, index) => {
    const references = [
      participant.identity.imageReference,
      participant.visual?.portraitReference ?? null,
      participant.visual?.modelReference ?? null,
    ];
    if (references.some(hasSensitiveCredentials)) {
      addIssue(context, ["participants", index], "Asset references must not contain credentials or access tokens.");
    }
  });
  if (value.world && hasSensitiveCredentials(value.world.manifestReference)) {
    addIssue(context, ["world", "manifestReference"], "World references must not contain credentials or access tokens.");
  }

  const eventIds = new Set<string>();
  let previousTick = 0;
  let previousTime = 0;
  value.events.forEach((event, index) => {
    if (eventIds.has(event.eventId)) addIssue(context, ["events", index, "eventId"], "Event IDs must be unique.");
    eventIds.add(event.eventId);
    if (event.sequence !== index + 1) {
      addIssue(context, ["events", index, "sequence"], "Event sequences must be contiguous and ordered from one.");
    }
    if (event.tick < previousTick || event.simulatedTimeMs < previousTime) {
      addIssue(context, ["events", index], "Event tick and simulated time must be monotonic.");
    }
    if (event.tick > value.run.totalTicks || event.simulatedTimeMs > value.run.simulatedDurationMs) {
      addIssue(context, ["events", index], "Event time exceeds the completed Run boundary.");
    }
    previousTick = event.tick;
    previousTime = event.simulatedTimeMs;
    if (event.actorRunParticipantId && !participantIds.has(event.actorRunParticipantId)) {
      addIssue(context, ["events", index, "actorRunParticipantId"], "Event actor is not a Run participant.");
    }
    if (event.targetRunParticipantId && !participantIds.has(event.targetRunParticipantId)) {
      addIssue(context, ["events", index, "targetRunParticipantId"], "Event target is not a Run participant.");
    }
    if (event.actorRunParticipantId && event.actorRunParticipantId === event.targetRunParticipantId) {
      addIssue(context, ["events", index], "Event actor and target must be different participants.");
    }
    if (event.type === "battle.started") {
      const ids = battleEventPayloads["battle.started"].schema.parse(event.payload).participantIds;
      if (new Set(ids).size !== ids.length || ids.length !== participantIds.size || !allKnown(ids, participantIds)) {
        addIssue(context, ["events", index, "payload", "participantIds"], "Battle start participants do not match the Run.");
      }
    }
  });

  if (value.events[0]?.type !== "battle.started") {
    addIssue(context, ["events", 0], "The first Battle event must be battle.started.");
  }
  const completedEvents = value.events.filter((event) => event.type === "battle.completed");
  const completedEvent = value.events.at(-1);
  if (completedEvents.length !== 1 || completedEvent?.type !== "battle.completed") {
    addIssue(context, ["events"], "A completed Battle must end with exactly one battle.completed event.");
  }

  const result = value.result.payload;
  const resultReferences = [
    ...result.ranking,
    ...result.eliminationOrder,
    ...result.tiedParticipantIds,
    ...result.participantMetrics.map((metric) => metric.runParticipantId),
    ...(result.winnerRunParticipantId ? [result.winnerRunParticipantId] : []),
  ];
  if (!allKnown(resultReferences, participantIds)) {
    addIssue(context, ["result", "payload"], "Result references an unknown Run participant.");
  }
  if (new Set(result.ranking).size !== result.ranking.length || result.ranking.length !== participantIds.size) {
    addIssue(context, ["result", "payload", "ranking"], "Result ranking must contain each participant exactly once.");
  }
  if (new Set(result.eliminationOrder).size !== result.eliminationOrder.length ||
      new Set(result.tiedParticipantIds).size !== result.tiedParticipantIds.length ||
      new Set(result.participantMetrics.map((metric) => metric.runParticipantId)).size !== result.participantMetrics.length ||
      result.participantMetrics.length !== participantIds.size) {
    addIssue(context, ["result", "payload"], "Result participant lists must be unique and complete where required.");
  }
  if ((result.winnerRunParticipantId === null) !== (result.tiedParticipantIds.length > 0)) {
    addIssue(context, ["result", "payload"], "Result winner and ties are inconsistent.");
  }
  if (result.totalTicks !== value.run.totalTicks || result.simulatedDurationMs !== value.run.simulatedDurationMs) {
    addIssue(context, ["result", "payload"], "Result timing does not match the completed Run.");
  }

  if (completedEvent?.type === "battle.completed") {
    const payload = battleEventPayloads["battle.completed"].schema.parse(completedEvent.payload);
    if (payload.completionReason !== result.completionReason ||
        payload.winnerRunParticipantId !== result.winnerRunParticipantId ||
        JSON.stringify(payload.tiedParticipantIds) !== JSON.stringify(result.tiedParticipantIds) ||
        JSON.stringify(payload.ranking) !== JSON.stringify(result.ranking)) {
      addIssue(context, ["events", value.events.length - 1], "Completion event does not match the authoritative result.");
    }
  }

  const created = Date.parse(value.run.createdAt);
  const started = Date.parse(value.run.startedAt);
  const completed = Date.parse(value.run.completedAt);
  if (!(created <= started && started <= completed)) {
    addIssue(context, ["run"], "Run timestamps are not chronological.");
  }
});

export type SimulationRuntimePackageV1 = z.infer<typeof simulationRuntimePackageV1Schema>;

export interface RuntimePackageSourceEventV1 extends EngineEvent {
  id: string;
}

export interface RuntimePackageSourceRunV1 {
  id: string;
  simulationId: string;
  status: string;
  mode: string;
  resolvedSeed: string;
  coreEngineVersion: string;
  moduleId: string;
  moduleVersion: string;
  rngAlgorithmVersion: string;
  inputSnapshotVersion: number;
  inputSnapshot: InputSnapshotV1;
  fixedStepMs: number;
  currentTick: number;
  elapsedSimulationMs: number;
  resultVersion: number;
  result: ResultEnvelopeV1 | null;
  createdAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  participants: ParticipantSnapshotV1[];
}

export interface RuntimePackageSourceV1 {
  run: RuntimePackageSourceRunV1;
  events: RuntimePackageSourceEventV1[];
  world?: RuntimeWorldBindingV1 | null;
}

function fail(code: RuntimeProtocolErrorCode, message: string, cause?: unknown): never {
  throw new RuntimeProtocolError(code, message, cause ? { cause } : undefined);
}

function parseSource<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) fail("CORRUPT_HISTORY", message, result.error);
  return result.data;
}

function toIso(value: Date | string | null, label: string): string {
  if (value === null) fail("CORRUPT_HISTORY", `${label} is missing from the completed Run.`);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) fail("CORRUPT_HISTORY", `${label} is invalid.`);
  return date.toISOString();
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)]));
  }
  return value;
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

/** Canonical validator for untrusted Runtime Protocol v1 JSON. */
export function parseSimulationRuntimePackageV1(value: unknown): SimulationRuntimePackageV1 {
  const result = simulationRuntimePackageV1Schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    fail("INVALID_PACKAGE", `Runtime Protocol v1 package is invalid. ${path}${issue?.message ?? "Unknown error."}`, result.error);
  }
  return result.data;
}

/** Stable, human-readable JSON used for checked fixtures and cross-runtime transport. */
export function serializeSimulationRuntimePackageV1(value: unknown): string {
  const parsed = parseSimulationRuntimePackageV1(value);
  return `${JSON.stringify(canonicalValue(parsed), null, 2)}\n`;
}

/** JSON Schema is generated from the canonical Zod contract; it is never hand-maintained. */
export function simulationRuntimePackageJsonSchemaV1(): Record<string, unknown> {
  const generated = z.toJSONSchema(simulationRuntimePackageV1Schema, {
    target: "draft-2020-12",
    reused: "ref",
  }) as Record<string, unknown>;
  return {
    $id: "https://simverse.example/protocol/runtime/v1/simulation-runtime-package.schema.json",
    title: RUNTIME_PACKAGE_TYPE_V1,
    description: "Generated transport shape. The SIMVERSE Zod validator also enforces relational integrity.",
    ...generated,
  };
}

/**
 * The only Runtime Protocol v1 package builder. It projects immutable persisted
 * Run history without consulting current Entity state or recomputing mechanics.
 */
export function buildSimulationRuntimePackageV1(source: RuntimePackageSourceV1): SimulationRuntimePackageV1 {
  const { run } = source;
  if (run.status !== "COMPLETED") {
    fail("RUN_NOT_COMPLETED", "Runtime Protocol v1 requires a completed Run.");
  }
  if (run.mode !== "battle" || run.moduleId !== BATTLE_MODULE_ID) {
    fail("UNSUPPORTED_MODULE", "Runtime Protocol v1 currently supports Battle runs only.");
  }
  if (run.moduleVersion !== BATTLE_MODULE_VERSION) {
    fail("UNSUPPORTED_VERSION", `Battle module version '${run.moduleVersion}' is not supported by Runtime Protocol v1.`);
  }
  if (run.coreEngineVersion !== CORE_ENGINE_VERSION ||
      run.rngAlgorithmVersion !== RNG_ALGORITHM_VERSION ||
      run.inputSnapshotVersion !== INPUT_SNAPSHOT_VERSION ||
      run.resultVersion !== RESULT_VERSION) {
    fail("UNSUPPORTED_VERSION", "The Run uses a Core, RNG, snapshot, or result version unsupported by Runtime Protocol v1.");
  }
  if (!run.result) fail("MISSING_RESULT", "The completed Run has no authoritative result.");

  const input = parseSource(inputSnapshotSchema, run.inputSnapshot, "The stored Run input snapshot is invalid.");
  const participants = run.participants.map((participant) =>
    parseSource(participantSnapshotSchema, participant, "A stored Run participant snapshot is invalid."));
  const resultEnvelope = parseSource(resultEnvelopeSchema, run.result, "The stored Run result envelope is invalid.");
  if (input.simulationId !== run.simulationId || input.mode !== run.mode || input.resolvedSeed !== run.resolvedSeed) {
    fail("CORRUPT_HISTORY", "Run identity or seed does not match its immutable input snapshot.");
  }
  if (!canonicalEqual(input.participants, participants)) {
    fail("CORRUPT_HISTORY", "Run participant rows do not match the immutable input snapshot.");
  }
  if (resultEnvelope.resultType !== "battle.result" || resultEnvelope.modulePayloadVersion !== BATTLE_RESULT_VERSION) {
    fail("UNSUPPORTED_VERSION", "The Battle result payload version is unsupported by Runtime Protocol v1.");
  }
  const battleResult = parseSource(battleResultSchema, resultEnvelope.modulePayload, "The authoritative Battle result is invalid.");

  const events = source.events.map((event) => {
    const { id, ...storedEnvelope } = event;
    const envelope = parseSource(engineEventSchema, storedEnvelope, "A stored Run event envelope is invalid.");
    return {
      eventId: id,
      ...envelope,
    };
  });

  const candidate = {
    packageType: RUNTIME_PACKAGE_TYPE_V1,
    protocolVersion: RUNTIME_PROTOCOL_VERSION_V1,
    run: {
      runId: run.id,
      simulationId: run.simulationId,
      simulationName: input.simulationName,
      status: "COMPLETED" as const,
      mode: "battle" as const,
      createdAt: toIso(run.createdAt, "Run creation time"),
      startedAt: toIso(run.startedAt, "Run start time"),
      completedAt: toIso(run.completedAt, "Run completion time"),
      fixedStepMs: run.fixedStepMs,
      totalTicks: run.currentTick,
      simulatedDurationMs: run.elapsedSimulationMs,
    },
    module: { id: BATTLE_MODULE_ID, version: BATTLE_MODULE_VERSION },
    versions: {
      coreEngine: CORE_ENGINE_VERSION,
      rngAlgorithm: RNG_ALGORITHM_VERSION,
      inputSnapshot: INPUT_SNAPSHOT_VERSION,
      resultEnvelope: RESULT_VERSION,
    },
    seedProvenance: {
      resolvedSeed: run.resolvedSeed,
      source: RUNTIME_SEED_SOURCE_V1,
    },
    participants: participants.map((participant) => {
      const visual = participant.visualProfileVersion === 1 && participant.visualProfile?.enabled
        ? participant.visualProfile
        : null;
      return {
        runParticipantId: participant.runParticipantId,
        position: participant.position,
        sourceEntityId: participant.sourceEntityId,
        role: participant.role,
        identity: {
          displayName: participant.name,
          shortName: participant.shortName,
          category: participant.category,
          imageReference: participant.imageUrl,
          primaryColor: participant.primaryColor,
          secondaryColor: participant.secondaryColor,
        },
        visual: visual ? {
          snapshotVersion: participant.visualProfileVersion,
          profileRevision: visual.profileRevision,
          sourceType: visual.sourceType,
          archetype: visual.archetype,
          portraitReference: visual.portraitUrl ?? null,
          modelReference: visual.modelUrl ?? null,
          transform: {
            scale: visual.scale,
            rotationDegrees: { x: visual.rotationX, y: visual.rotationY, z: visual.rotationZ },
            offsetMeters: { x: visual.offsetX, y: visual.offsetY, z: visual.offsetZ },
          },
          animationMapping: visual.animationProfile,
        } : null,
      };
    }),
    world: source.world ?? null,
    events,
    result: {
      envelopeVersion: resultEnvelope.version,
      type: "battle.result" as const,
      summary: resultEnvelope.summary,
      metrics: resultEnvelope.metrics,
      payloadVersion: BATTLE_RESULT_VERSION,
      payload: battleResult,
    },
    presentation: {
      profileVersion: 1 as const,
      displayTitle: input.presentation.displayTitle ?? input.simulationName,
      themeColor: input.presentation.themeColor,
      showLabels: input.presentation.showLabels,
      showLeaderboard: input.presentation.showLeaderboard,
    },
  };

  return parseSimulationRuntimePackageV1(candidate);
}
