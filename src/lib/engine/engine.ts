import { ENGINE_STATE_VERSION, RESULT_VERSION } from "./constants";
import { nextClock } from "./clock";
import { EngineExecutionError, type EngineContext, type EngineModule, type PayloadDefinition, type ProposedEnvelope } from "./module";
import { SeededRng } from "./rng";
import {
  engineActionSchema, engineEventSchema, engineStateSchema, inputSnapshotSchema,
  jsonRecordSchema, resultEnvelopeSchema,
  type EngineAction, type EngineEvent, type EngineStateV1, type InputSnapshotV1,
  type JsonRecord, type ResultEnvelopeV1,
} from "./schemas";

const MAX_ACTIONS_PER_TICK = 100;
const MAX_EVENTS_PER_TICK = 1_000;

function invalidOutput(): never {
  throw new EngineExecutionError("INVALID_MODULE_OUTPUT", "Execution stopped because a module returned invalid data.");
}

function callModule<T>(callback: () => T): T {
  try {
    return callback();
  } catch (error) {
    if (error instanceof EngineExecutionError) throw error;
    throw new EngineExecutionError(
      "MODULE_EXECUTION_FAILED",
      "Execution stopped after a module error.",
      { cause: error },
    );
  }
}

function validatedState(module: EngineModule, value: unknown): JsonRecord {
  const parsed = module.stateSchema.safeParse(value);
  if (!parsed.success) return invalidOutput();
  const json = jsonRecordSchema.safeParse(parsed.data);
  if (!json.success) return invalidOutput();
  return json.data;
}

function validatedPayload(definition: PayloadDefinition | undefined, value: unknown, version: number): JsonRecord {
  if (!definition || definition.version !== version) return invalidOutput();
  const parsed = definition.schema.safeParse(value);
  if (!parsed.success) return invalidOutput();
  const json = jsonRecordSchema.safeParse(parsed.data);
  if (!json.success) return invalidOutput();
  return json.data;
}

function validateParticipantReference(id: string | null | undefined, input: InputSnapshotV1): string | null {
  if (id == null) return null;
  if (!input.participants.some((participant) => participant.runParticipantId === id)) return invalidOutput();
  return id;
}

function validateProposal(
  proposal: ProposedEnvelope,
  definitions: Readonly<Record<string, PayloadDefinition>>,
  input: InputSnapshotV1,
): Omit<EngineAction, "sequence" | "tick"> {
  if (!proposal || typeof proposal !== "object" || typeof proposal.type !== "string") return invalidOutput();
  return {
    type: proposal.type,
    actorRunParticipantId: validateParticipantReference(proposal.actorRunParticipantId, input),
    targetRunParticipantId: validateParticipantReference(proposal.targetRunParticipantId, input),
    payloadVersion: proposal.payloadVersion,
    payload: validatedPayload(definitions[proposal.type], proposal.payload, proposal.payloadVersion),
  };
}

export function initializeEngine(module: EngineModule, rawInput: unknown, fixedStepMs: number): EngineStateV1 {
  const input = inputSnapshotSchema.parse(rawInput);
  if (module.mode !== input.mode || !Number.isSafeInteger(fixedStepMs) || fixedStepMs < 1) return invalidOutput();
  const rng = SeededRng.fromSeed(input.resolvedSeed);
  const context: EngineContext = { input, tick: 0, simulatedTimeMs: 0, fixedStepMs, rng };
  const moduleState = validatedState(module, callModule(() => module.initialize(context)));
  return engineStateSchema.parse({
    version: ENGINE_STATE_VERSION,
    tick: 0,
    elapsedSimulationMs: 0,
    rng: rng.snapshot(),
    globalState: {},
    participantStates: {},
    moduleState,
  });
}

export interface StepOutcome {
  state: EngineStateV1;
  actions: EngineAction[];
  events: EngineEvent[];
  result: ResultEnvelopeV1 | null;
  lastActionSequence: number;
  lastEventSequence: number;
}

/** One deterministic, headless tick. Persistence is handled by the service. */
export function stepEngine(
  module: EngineModule,
  rawInput: unknown,
  rawState: unknown,
  fixedStepMs: number,
  lastActionSequence: number,
  lastEventSequence: number,
): StepOutcome {
  const input = inputSnapshotSchema.parse(rawInput);
  const previous = engineStateSchema.parse(rawState);
  if (module.mode !== input.mode || previous.elapsedSimulationMs !== previous.tick * fixedStepMs) return invalidOutput();
  const clock = nextClock(previous.tick, fixedStepMs);
  const rng = new SeededRng(previous.rng);
  const context: EngineContext = { input, tick: clock.tick, simulatedTimeMs: clock.simulatedTimeMs, fixedStepMs, rng };

  let moduleState = validatedState(module, previous.moduleState);
  const proposedActions = callModule(() => module.planActions(context, moduleState));
  if (!Array.isArray(proposedActions) || proposedActions.length > MAX_ACTIONS_PER_TICK) return invalidOutput();

  const actions: EngineAction[] = [];
  const events: EngineEvent[] = [];
  for (const proposal of proposedActions) {
    const canonical = validateProposal(proposal, module.actionPayloads, input);
    const action = engineActionSchema.parse({ ...canonical, tick: clock.tick, sequence: ++lastActionSequence });
    actions.push(action);
    const evaluated = callModule(() => module.evaluateRules(context, moduleState, action));
    if (!evaluated || !Array.isArray(evaluated.events) || evaluated.events.length + events.length > MAX_EVENTS_PER_TICK) {
      return invalidOutput();
    }
    moduleState = validatedState(module, evaluated.state);
    for (const eventProposal of evaluated.events) {
      const event = validateProposal(eventProposal, module.eventPayloads, input);
      events.push(engineEventSchema.parse({
        ...event,
        tick: clock.tick,
        simulatedTimeMs: clock.simulatedTimeMs,
        sequence: ++lastEventSequence,
      }));
    }
  }

  const complete = callModule(() => module.isComplete(context, moduleState));
  if (typeof complete !== "boolean") return invalidOutput();
  let result: ResultEnvelopeV1 | null = null;
  if (complete) {
    const proposed = callModule(() => module.buildResult(context, moduleState));
    if (!proposed || typeof proposed.resultType !== "string") return invalidOutput();
    result = resultEnvelopeSchema.parse({
      ...proposed,
      version: RESULT_VERSION,
      modulePayload: validatedPayload(
        module.resultPayloads[proposed.resultType], proposed.modulePayload, proposed.modulePayloadVersion,
      ),
    });
  }

  return {
    state: engineStateSchema.parse({
      ...previous,
      tick: clock.tick,
      elapsedSimulationMs: clock.simulatedTimeMs,
      rng: rng.snapshot(),
      moduleState,
    }),
    actions,
    events,
    result,
    lastActionSequence,
    lastEventSequence,
  };
}
