import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  ANYTHING_WARS_EVENT_MODES,
  ANYTHING_WARS_PRODUCT_ID,
  anythingWarsMetadata,
  anythingWarsExecutionIssue,
  isAnythingWarsEventMode,
  isAnythingWarsMetadata,
} from "@/lib/anything-wars/constants";
import { prisma } from "@/server/db/client";
import { parseMetadata } from "./serialization";
import {
  createSimulation,
  getSimulation,
  markSimulationReady,
  updateSimulation,
  type SimulationView,
} from "./simulation-service";
import {
  createSimulationRun,
  getSimulationRun,
  listSimulationRuns,
  type RunSummary,
} from "./simulation-run-service";
import { requireMembership } from "./workspace-service";

const RECENT_EVENT_LIMIT = 12;
const PRODUCT_METADATA_FILTER = `"product":"${ANYTHING_WARS_PRODUCT_ID}"`;

export interface AnythingWarsEventSummary {
  simulation: SimulationView;
  latestRun: RunSummary | null;
  resultSummary: string | null;
}

function inputRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Anything Wars event input is invalid.");
  }
  return input as Record<string, unknown>;
}

function sourceMetadata(input: Record<string, unknown>): Record<string, unknown> | null {
  const metadata = input.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : null;
}

function requireSupportedMode(value: unknown): asserts value is string {
  const mode = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!isAnythingWarsEventMode(mode)) {
    throw new ValidationError("Anything Wars v0 supports Battle, Race, and Survival events. Tournaments use the Tournament flow.", [
      { path: "mode", message: "Choose Battle, Race, or Survival." },
    ]);
  }
}

/** Create a normal Simulation while applying the product marker at this UI boundary. */
export async function createAnythingWarsEvent(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<SimulationView> {
  const record = inputRecord(input);
  requireSupportedMode(record.mode);
  return createSimulation(userId, workspaceId, {
    ...record,
    metadata: anythingWarsMetadata(sourceMetadata(record)),
  });
}

/** Update only a workspace-authorized, product-marked event and preserve its marker. */
export async function updateAnythingWarsEvent(
  userId: string,
  workspaceId: string,
  simulationId: string,
  input: unknown,
): Promise<SimulationView> {
  const current = await getAnythingWarsEvent(userId, workspaceId, simulationId);
  const record = inputRecord(input);
  const effectiveMode = typeof record.mode === "string" ? record.mode.trim().toLowerCase() : current.mode;
  requireSupportedMode(effectiveMode);
  return updateSimulation(userId, workspaceId, simulationId, {
    ...record,
    metadata: anythingWarsMetadata(sourceMetadata(record) ?? current.metadata),
  });
}

/** Safe product lookup: foreign and non-product IDs both resolve as Not Found. */
export async function getAnythingWarsEvent(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  const simulation = await getSimulation(userId, workspaceId, simulationId);
  if (!isAnythingWarsMetadata(simulation.metadata) || !isAnythingWarsEventMode(simulation.mode)) {
    throw new NotFoundError("Anything Wars event not found.");
  }
  return simulation;
}

export async function markAnythingWarsEventReady(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  const event = await getAnythingWarsEvent(userId, workspaceId, simulationId);
  const issue = anythingWarsExecutionIssue(event.mode, event.configuration.mode, event.participants.length);
  if (issue) {
    throw new ValidationError(issue, [{ path: "participants", message: issue }]);
  }
  return markSimulationReady(userId, workspaceId, simulationId);
}

export async function createAnythingWarsRun(
  userId: string,
  workspaceId: string,
  simulationId: string,
) {
  await getAnythingWarsEvent(userId, workspaceId, simulationId);
  return createSimulationRun(userId, workspaceId, simulationId);
}

/** Real workspace data only; no product counters or outcomes are fabricated. */
export async function listAnythingWarsEvents(
  userId: string,
  workspaceId: string,
  limit = RECENT_EVENT_LIMIT,
): Promise<AnythingWarsEventSummary[]> {
  await requireMembership(userId, workspaceId, "simulation.view");
  const safeLimit = Math.min(RECENT_EVENT_LIMIT, Math.max(1, Math.floor(limit)));
  const candidates = await prisma.simulation.findMany({
    where: {
      workspaceId,
      status: { not: "ARCHIVED" },
      mode: { in: [...ANYTHING_WARS_EVENT_MODES] },
      metadata: { contains: PRODUCT_METADATA_FILTER },
    },
    select: { id: true, metadata: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: safeLimit,
  });
  const ids = candidates
    .filter((candidate) => isAnythingWarsMetadata(parseMetadata(candidate.metadata)))
    .map((candidate) => candidate.id);

  return Promise.all(ids.map(async (simulationId) => {
    const [simulation, runs] = await Promise.all([
      getSimulation(userId, workspaceId, simulationId),
      listSimulationRuns(userId, workspaceId, simulationId, 1),
    ]);
    const latestRun = runs.items[0] ?? null;
    let resultSummary: string | null = null;
    if (latestRun?.status === "COMPLETED") {
      const run = await getSimulationRun(userId, workspaceId, latestRun.id);
      resultSummary = run.result?.summary ?? null;
    }
    return { simulation, latestRun, resultSummary };
  }));
}
