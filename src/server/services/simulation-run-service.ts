import type { Prisma, SimulationRun } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  assertRunTransition, CORE_ENGINE_VERSION, DEFAULT_FIXED_STEP_MS,
  ENGINE_STATE_VERSION, INPUT_SNAPSHOT_VERSION, RESULT_VERSION,
  isRunStatus, type RunStatus,
} from "@/lib/engine/constants";
import { initializeEngine, stepEngine } from "@/lib/engine/engine";
import { EngineExecutionError } from "@/lib/engine/module";
import { productionEngineRegistry, type EngineModuleRegistry } from "@/lib/engine/registry";
import { RNG_ALGORITHM_VERSION } from "@/lib/engine/rng";
import {
  engineActionSchema, engineEventSchema, engineStateSchema, inputSnapshotSchema,
  jsonRecordSchema, participantSnapshotSchema, resultEnvelopeSchema, stringifyBounded,
  type EngineStateV1, type InputSnapshotV1, type ParticipantSnapshotV1,
  type ResultEnvelopeV1,
} from "@/lib/engine/schemas";
import { prisma } from "@/server/db/client";
import { recordAudit, type AuditAction } from "./audit-service";
import { buildRunInputSnapshot } from "./simulation-run-snapshot-service";
import { requireMembership } from "./workspace-service";

const RUN_PAGE_SIZE = 25;
const MAX_EVENT_PAGE_SIZE = 100;
const MAX_BATCH_TICKS = 100;

const runDetailInclude = {
  participants: { orderBy: { position: "asc" } },
  _count: { select: { actions: true, events: true } },
} satisfies Prisma.SimulationRunInclude;
type RunDetailRow = Prisma.SimulationRunGetPayload<{ include: typeof runDetailInclude }>;

export interface RunSummary {
  id: string;
  workspaceId: string;
  simulationId: string;
  status: RunStatus;
  mode: string;
  resolvedSeed: string;
  moduleId: string;
  moduleVersion: string;
  currentTick: number;
  elapsedSimulationMs: number;
  eventCount: number;
  createdAt: Date;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
}

export interface RunView extends RunSummary {
  coreEngineVersion: string;
  rngAlgorithmVersion: string;
  configVersion: number;
  inputSnapshotVersion: number;
  inputSnapshot: InputSnapshotV1;
  stateVersion: number;
  state: EngineStateV1;
  fixedStepMs: number;
  resultVersion: number;
  result: ResultEnvelopeV1 | null;
  failureCode: string | null;
  failureMessage: string | null;
  actionCount: number;
  participants: ParticipantSnapshotV1[];
}

function statusOf(row: SimulationRun): RunStatus {
  if (!isRunStatus(row.status)) throw new ConflictError("Run status is invalid.");
  return row.status;
}

function readJson<T>(json: string, parse: (value: unknown) => T): T {
  try {
    return parse(JSON.parse(json));
  } catch {
    throw new ConflictError("Stored run data is invalid.");
  }
}

function toSummary(row: SimulationRun & { _count: { events: number } }): RunSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    simulationId: row.simulationId,
    status: statusOf(row),
    mode: row.mode,
    resolvedSeed: row.resolvedSeed,
    moduleId: row.moduleId,
    moduleVersion: row.moduleVersion,
    currentTick: row.currentTick,
    elapsedSimulationMs: row.elapsedSimulationMs,
    eventCount: row._count.events,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    pausedAt: row.pausedAt,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
    cancelledAt: row.cancelledAt,
  };
}

function toRunView(row: RunDetailRow): RunView {
  return {
    ...toSummary(row),
    coreEngineVersion: row.coreEngineVersion,
    rngAlgorithmVersion: row.rngAlgorithmVersion,
    moduleId: row.moduleId,
    moduleVersion: row.moduleVersion,
    configVersion: row.configVersion,
    inputSnapshotVersion: row.inputSnapshotVersion,
    inputSnapshot: readJson(row.inputSnapshot, inputSnapshotSchema.parse.bind(inputSnapshotSchema)),
    stateVersion: row.stateVersion,
    state: readJson(row.state, engineStateSchema.parse.bind(engineStateSchema)),
    fixedStepMs: row.fixedStepMs,
    resultVersion: row.resultVersion,
    result: row.result ? readJson(row.result, resultEnvelopeSchema.parse.bind(resultEnvelopeSchema)) : null,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    actionCount: row._count.actions,
    participants: row.participants.map((participant) =>
      readJson(participant.snapshot, participantSnapshotSchema.parse.bind(participantSnapshotSchema))),
  };
}

async function requireRunRow(workspaceId: string, runId: string): Promise<SimulationRun> {
  const run = await prisma.simulationRun.findFirst({ where: { id: runId, workspaceId } });
  if (!run) throw new NotFoundError("Run not found.");
  return run;
}

function moduleUnavailable(mode: string): ConflictError {
  return new ConflictError(`Execution module for mode '${mode}' is not available yet.`);
}

function moduleForRun(run: SimulationRun, registry: EngineModuleRegistry) {
  const module = registry.forRun(run.mode, run.moduleId, run.moduleVersion);
  if (!module || run.coreEngineVersion !== CORE_ENGINE_VERSION ||
      run.rngAlgorithmVersion !== RNG_ALGORITHM_VERSION || run.stateVersion !== ENGINE_STATE_VERSION ||
      run.inputSnapshotVersion !== INPUT_SNAPSHOT_VERSION) {
    throw moduleUnavailable(run.mode);
  }
  return module;
}

function isWriteConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "P2034" || code === "P2028" || code === "P2003";
}

export async function listSimulationRuns(
  userId: string, workspaceId: string, simulationId: string, page = 1,
): Promise<{ items: RunSummary[]; total: number; page: number; pageCount: number }> {
  await requireMembership(userId, workspaceId, "simulation.view");
  const simulation = await prisma.simulation.findFirst({ where: { id: simulationId, workspaceId }, select: { id: true } });
  if (!simulation) throw new NotFoundError("Simulation not found.");
  const safePage = Number.isSafeInteger(page) ? Math.max(1, page) : 1;
  const where = { workspaceId, simulationId };
  const [total, rows] = await Promise.all([
    prisma.simulationRun.count({ where }),
    prisma.simulationRun.findMany({
      where,
      include: { _count: { select: { events: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (safePage - 1) * RUN_PAGE_SIZE,
      take: RUN_PAGE_SIZE,
    }),
  ]);
  return { items: rows.map(toSummary), total, page: safePage, pageCount: Math.max(1, Math.ceil(total / RUN_PAGE_SIZE)) };
}

export async function getSimulationRun(userId: string, workspaceId: string, runId: string): Promise<RunView> {
  await requireMembership(userId, workspaceId, "simulation.view");
  const row = await prisma.simulationRun.findFirst({ where: { id: runId, workspaceId }, include: runDetailInclude });
  if (!row) throw new NotFoundError("Run not found.");
  return toRunView(row);
}

/** The registry argument is server-only injection for deterministic Core tests. */
export async function createSimulationRun(
  userId: string, workspaceId: string, simulationId: string,
  registry: EngineModuleRegistry = productionEngineRegistry,
): Promise<RunView> {
  await requireMembership(userId, workspaceId, "simulation.run");
  let runId: string;
  try {
    runId = await prisma.$transaction(async (tx) => {
      const input = await buildRunInputSnapshot(tx, workspaceId, simulationId);
      const module = registry.forMode(input.mode);
      if (!module) throw moduleUnavailable(input.mode);
      let state: EngineStateV1;
      try {
        state = initializeEngine(module, input, DEFAULT_FIXED_STEP_MS);
      } catch (error) {
        if (error instanceof EngineExecutionError && error.failureCode === "INVALID_EXECUTION_INPUT") {
          throw new ValidationError(error.safeMessage);
        }
        throw new ConflictError("Execution module could not initialize this simulation.");
      }
      const created = await tx.simulationRun.create({
        data: {
          workspaceId,
          simulationId,
          status: "CREATED",
          mode: input.mode,
          resolvedSeed: input.resolvedSeed,
          coreEngineVersion: CORE_ENGINE_VERSION,
          moduleId: module.id,
          moduleVersion: module.version,
          rngAlgorithmVersion: RNG_ALGORITHM_VERSION,
          configVersion: input.configVersion,
          configurationSnapshot: stringifyBounded(input.configuration),
          presentationSnapshot: stringifyBounded(input.presentation),
          inputSnapshotVersion: INPUT_SNAPSHOT_VERSION,
          inputSnapshot: stringifyBounded(input),
          stateVersion: ENGINE_STATE_VERSION,
          state: stringifyBounded(state),
          fixedStepMs: DEFAULT_FIXED_STEP_MS,
          resultVersion: RESULT_VERSION,
          createdById: userId,
          participants: {
            create: input.participants.map((participant) => ({
              id: participant.runParticipantId,
              sourceEntityId: participant.sourceEntityId,
              position: participant.position,
              role: participant.role,
              snapshotVersion: INPUT_SNAPSHOT_VERSION,
              snapshot: stringifyBounded(participant),
            })),
          },
        },
        select: { id: true },
      });
      return created.id;
    });
  } catch (error) {
    if (isWriteConflict(error)) throw new ConflictError("Run creation conflicted with another change.");
    throw error;
  }
  await recordAudit({
    action: "simulation_run.created", actorUserId: userId, workspaceId,
    entityType: "SimulationRun", entityId: runId, metadata: { simulationId },
  });
  return getSimulationRun(userId, workspaceId, runId);
}

async function transitionRun(
  userId: string, workspaceId: string, runId: string, to: RunStatus,
  auditAction: AuditAction, registry: EngineModuleRegistry,
): Promise<RunView> {
  await requireMembership(userId, workspaceId, "simulation.run");
  const run = await requireRunRow(workspaceId, runId);
  const from = statusOf(run);
  assertRunTransition(from, to);
  if (to === "RUNNING") moduleForRun(run, registry);
  const now = new Date();
  const data: Prisma.SimulationRunUpdateManyMutationInput = { status: to };
  if (to === "RUNNING") {
    if (from === "CREATED") data.startedAt = now;
    else data.pausedAt = null;
  } else if (to === "PAUSED") data.pausedAt = now;
  else if (to === "CANCELLED") data.cancelledAt = now;
  try {
    const updated = await prisma.simulationRun.updateMany({ where: { id: runId, workspaceId, status: from }, data });
    if (updated.count !== 1) throw new ConflictError("Run changed while this action was being applied.");
  } catch (error) {
    if (isWriteConflict(error)) throw new ConflictError("Run changed while this action was being applied.");
    throw error;
  }
  await recordAudit({ action: auditAction, actorUserId: userId, workspaceId, entityType: "SimulationRun", entityId: runId });
  return getSimulationRun(userId, workspaceId, runId);
}

export function startSimulationRun(
  userId: string, workspaceId: string, runId: string, registry = productionEngineRegistry,
): Promise<RunView> {
  return transitionRun(userId, workspaceId, runId, "RUNNING", "simulation_run.started", registry);
}

export function pauseSimulationRun(userId: string, workspaceId: string, runId: string): Promise<RunView> {
  return transitionRun(userId, workspaceId, runId, "PAUSED", "simulation_run.paused", productionEngineRegistry);
}

export function resumeSimulationRun(
  userId: string, workspaceId: string, runId: string, registry = productionEngineRegistry,
): Promise<RunView> {
  return transitionRun(userId, workspaceId, runId, "RUNNING", "simulation_run.resumed", registry);
}

export function cancelSimulationRun(userId: string, workspaceId: string, runId: string): Promise<RunView> {
  return transitionRun(userId, workspaceId, runId, "CANCELLED", "simulation_run.cancelled", productionEngineRegistry);
}

async function markRunFailed(
  userId: string, workspaceId: string, runId: string, failure: EngineExecutionError,
): Promise<RunView> {
  const updated = await prisma.simulationRun.updateMany({
    where: { id: runId, workspaceId, status: "RUNNING" },
    data: {
      status: "FAILED", failureCode: failure.failureCode,
      failureMessage: failure.safeMessage, failedAt: new Date(),
    },
  });
  if (updated.count === 1) {
    await recordAudit({ action: "simulation_run.failed", actorUserId: userId, workspaceId,
      entityType: "SimulationRun", entityId: runId, metadata: { code: failure.failureCode } });
  }
  return getSimulationRun(userId, workspaceId, runId);
}

/** Persist each tick atomically so a failed step retains the last complete state. */
export async function advanceSimulationRun(
  userId: string, workspaceId: string, runId: string, maxTicks = 1,
  registry: EngineModuleRegistry = productionEngineRegistry,
): Promise<RunView> {
  await requireMembership(userId, workspaceId, "simulation.run");
  if (!Number.isSafeInteger(maxTicks) || maxTicks < 1 || maxTicks > MAX_BATCH_TICKS) {
    throw new ValidationError(`Choose between 1 and ${MAX_BATCH_TICKS} ticks.`);
  }
  for (let index = 0; index < maxTicks; index += 1) {
    let completed = false;
    try {
      completed = await prisma.$transaction(async (tx) => {
        const run = await tx.simulationRun.findFirst({ where: { id: runId, workspaceId } });
        if (!run) throw new NotFoundError("Run not found.");
        if (statusOf(run) !== "RUNNING") throw new ConflictError("Run is not running.");
        const module = moduleForRun(run, registry);
        let outcome: ReturnType<typeof stepEngine>;
        try {
          outcome = stepEngine(
            module, JSON.parse(run.inputSnapshot), JSON.parse(run.state), run.fixedStepMs,
            run.lastActionSequence, run.lastEventSequence,
          );
        } catch (error) {
          if (error instanceof EngineExecutionError) throw error;
          throw new EngineExecutionError("INVALID_MODULE_OUTPUT", "Execution stopped because stored data is invalid.", { cause: error });
        }
        const done = outcome.result !== null;
        let serializedState: string;
        let serializedResult: string | null;
        let actionRows: Prisma.SimulationRunActionCreateManyInput[];
        let eventRows: Prisma.SimulationRunEventCreateManyInput[];
        try {
          serializedState = stringifyBounded(outcome.state);
          serializedResult = done ? stringifyBounded(outcome.result) : null;
          actionRows = outcome.actions.map((action) => ({
            runId, sequence: action.sequence, tick: action.tick, type: action.type,
            actorRunParticipantId: action.actorRunParticipantId,
            targetRunParticipantId: action.targetRunParticipantId,
            payloadVersion: action.payloadVersion, payload: stringifyBounded(action.payload, 100_000),
          }));
          eventRows = outcome.events.map((event) => ({
            runId, sequence: event.sequence, tick: event.tick,
            simulatedTimeMs: event.simulatedTimeMs, type: event.type,
            actorRunParticipantId: event.actorRunParticipantId,
            targetRunParticipantId: event.targetRunParticipantId,
            payloadVersion: event.payloadVersion, payload: stringifyBounded(event.payload, 100_000),
          }));
        } catch (error) {
          throw new EngineExecutionError(
            "INVALID_MODULE_OUTPUT", "Execution stopped because module data exceeded its size limit.",
            { cause: error },
          );
        }
        const updated = await tx.simulationRun.updateMany({
          where: {
            id: runId, workspaceId, status: "RUNNING", currentTick: run.currentTick,
            lastActionSequence: run.lastActionSequence, lastEventSequence: run.lastEventSequence,
          },
          data: {
            state: serializedState,
            currentTick: outcome.state.tick,
            elapsedSimulationMs: outcome.state.elapsedSimulationMs,
            lastActionSequence: outcome.lastActionSequence,
            lastEventSequence: outcome.lastEventSequence,
            ...(done ? { status: "COMPLETED", result: serializedResult, completedAt: new Date() } : {}),
          },
        });
        if (updated.count !== 1) throw new ConflictError("Run changed while a tick was being applied.");
        if (actionRows.length) await tx.simulationRunAction.createMany({ data: actionRows });
        if (eventRows.length) await tx.simulationRunEvent.createMany({ data: eventRows });
        return done;
      });
    } catch (error) {
      if (error instanceof EngineExecutionError) return markRunFailed(userId, workspaceId, runId, error);
      if (isWriteConflict(error)) throw new ConflictError("Run changed while a tick was being applied.");
      throw error;
    }
    if (completed) {
      await recordAudit({ action: "simulation_run.completed", actorUserId: userId, workspaceId,
        entityType: "SimulationRun", entityId: runId });
      break;
    }
  }
  return getSimulationRun(userId, workspaceId, runId);
}

/** Bounded headless helper for server jobs and tests; a worker can call batches later. */
export async function executeUntilComplete(
  userId: string, workspaceId: string, runId: string, maxTotalTicks = 10_000,
  registry: EngineModuleRegistry = productionEngineRegistry,
): Promise<RunView> {
  if (!Number.isSafeInteger(maxTotalTicks) || maxTotalTicks < 1 || maxTotalTicks > 10_000) {
    throw new ValidationError("Execution tick limit is invalid.");
  }
  let run = await getSimulationRun(userId, workspaceId, runId);
  let remaining = maxTotalTicks;
  while (run.status === "RUNNING" && remaining > 0) {
    const batch = Math.min(remaining, MAX_BATCH_TICKS);
    run = await advanceSimulationRun(userId, workspaceId, runId, batch, registry);
    remaining -= batch;
  }
  return run;
}

export async function listSimulationRunEvents(
  userId: string, workspaceId: string, runId: string, afterSequence = 0, limit = 50,
) {
  await requireMembership(userId, workspaceId, "simulation.view");
  await requireRunRow(workspaceId, runId);
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_EVENT_PAGE_SIZE) {
    throw new ValidationError("Event pagination is invalid.");
  }
  const rows = await prisma.simulationRunEvent.findMany({
    where: { runId, sequence: { gt: afterSequence } },
    orderBy: { sequence: "asc" }, take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    ...engineEventSchema.parse({
      sequence: row.sequence, tick: row.tick, simulatedTimeMs: row.simulatedTimeMs,
      type: row.type, actorRunParticipantId: row.actorRunParticipantId,
      targetRunParticipantId: row.targetRunParticipantId, payloadVersion: row.payloadVersion,
      payload: readJson(row.payload, jsonRecordSchema.parse.bind(jsonRecordSchema)),
    }),
    id: row.id,
  }));
  return { items, hasMore, nextAfterSequence: items.at(-1)?.sequence ?? afterSequence };
}

export async function listSimulationRunActions(
  userId: string, workspaceId: string, runId: string, afterSequence = 0, limit = 50,
) {
  await requireMembership(userId, workspaceId, "simulation.view");
  await requireRunRow(workspaceId, runId);
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_EVENT_PAGE_SIZE) {
    throw new ValidationError("Action pagination is invalid.");
  }
  const rows = await prisma.simulationRunAction.findMany({
    where: { runId, sequence: { gt: afterSequence } }, orderBy: { sequence: "asc" }, take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    ...engineActionSchema.parse({
      sequence: row.sequence, tick: row.tick, type: row.type,
      actorRunParticipantId: row.actorRunParticipantId,
      targetRunParticipantId: row.targetRunParticipantId, payloadVersion: row.payloadVersion,
      payload: readJson(row.payload, jsonRecordSchema.parse.bind(jsonRecordSchema)),
    }),
    id: row.id,
  }));
  return { items, hasMore, nextAfterSequence: items.at(-1)?.sequence ?? afterSequence };
}
