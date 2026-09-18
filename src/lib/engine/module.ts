import type { z } from "zod";
import type { SeededRng } from "./rng";
import type {
  EngineAction, InputSnapshotV1, JsonRecord, ResultEnvelopeV1,
} from "./schemas";

export interface EngineContext {
  readonly input: InputSnapshotV1;
  readonly tick: number;
  readonly simulatedTimeMs: number;
  readonly fixedStepMs: number;
  readonly rng: SeededRng;
}

export interface PayloadDefinition {
  version: number;
  schema: z.ZodType<JsonRecord>;
}

export interface ProposedEnvelope {
  type: string;
  actorRunParticipantId?: string | null;
  targetRunParticipantId?: string | null;
  payloadVersion: number;
  payload: JsonRecord;
}

export interface RuleEvaluation {
  state: JsonRecord;
  events: ProposedEnvelope[];
}

export type ProposedResult = Omit<ResultEnvelopeV1, "version">;

/** Core calls these hooks in a stable order; the module owns all mode mechanics. */
export interface EngineModule {
  readonly mode: string;
  readonly id: string;
  readonly version: string;
  readonly stateSchema: z.ZodType<JsonRecord>;
  readonly actionPayloads: Readonly<Record<string, PayloadDefinition>>;
  readonly eventPayloads: Readonly<Record<string, PayloadDefinition>>;
  readonly resultPayloads: Readonly<Record<string, PayloadDefinition>>;

  initialize(context: EngineContext): JsonRecord;
  planActions(context: EngineContext, state: JsonRecord): ProposedEnvelope[];
  evaluateRules(context: EngineContext, state: JsonRecord, action: EngineAction): RuleEvaluation;
  isComplete(context: EngineContext, state: JsonRecord): boolean;
  buildResult(context: EngineContext, state: JsonRecord): ProposedResult;
}

export class EngineExecutionError extends Error {
  constructor(
    readonly failureCode: "INVALID_MODULE_OUTPUT" | "MODULE_EXECUTION_FAILED",
    readonly safeMessage: string,
    options?: ErrorOptions,
  ) {
    super(safeMessage, options);
    this.name = "EngineExecutionError";
  }
}
