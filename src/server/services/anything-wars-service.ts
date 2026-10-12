import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  ANYTHING_WARS_EVENT_MODES,
  ANYTHING_WARS_PRODUCT_ID,
  anythingWarsMetadata,
  anythingWarsExecutionIssue,
  isAnythingWarsEventMode,
  isAnythingWarsMetadata,
} from "@/lib/anything-wars/constants";
import {
  QUICK_CREATIONS_PROJECT_PURPOSE,
  QUICK_CREATIONS_PROJECT_VERSION,
  quickWarConfiguration,
  quickWarInputSchema,
  quickWarName,
} from "@/lib/anything-wars/quick";
import { defaultPresentation } from "@/lib/simulations/config";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { parseMetadata } from "./serialization";
import { addProjectEntities, createProject } from "./project-service";
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
  startSimulationRun,
  type RunSummary,
} from "./simulation-run-service";
import { requireMembership } from "./workspace-service";

const RECENT_EVENT_LIMIT = 12;
const PRODUCT_METADATA_FILTER = `"product":"${ANYTHING_WARS_PRODUCT_ID}"`;
const QUICK_PROJECT_METADATA_FILTER = `"purpose":"${QUICK_CREATIONS_PROJECT_PURPOSE}"`;

export interface AnythingWarsEventSummary {
  simulation: SimulationView;
  latestRun: RunSummary | null;
  resultSummary: string | null;
}

async function resolveQuickCreationsProject(userId: string, workspaceId: string) {
  const candidates = await prisma.project.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
      metadata: { contains: QUICK_PROJECT_METADATA_FILTER },
    },
    select: { id: true, metadata: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const existing = candidates.find((candidate) => {
    const metadata = parseMetadata(candidate.metadata);
    return metadata?.purpose === QUICK_CREATIONS_PROJECT_PURPOSE &&
      metadata.version === QUICK_CREATIONS_PROJECT_VERSION;
  });
  if (existing) return existing.id;

  const created = await createProject(userId, workspaceId, {
    name: "Quick Creations",
    description: "SIMVERSE keeps Quick War competitors and events organized here automatically.",
    metadata: {
      purpose: QUICK_CREATIONS_PROJECT_PURPOSE,
      version: QUICK_CREATIONS_PROJECT_VERSION,
    },
  });
  return created.id;
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

/**
 * Beginner path: resolve safe defaults and organization, then compose the same
 * canonical Simulation -> READY -> SimulationRun -> RUNNING services used by
 * Custom War. No mechanics or historical state lives in the Product layer.
 */
export async function createQuickAnythingWarsRun(
  userId: string,
  workspaceId: string,
  input: unknown,
) {
  await requireMembership(userId, workspaceId, "simulation.create");
  await requireMembership(userId, workspaceId, "simulation.run");
  const data = parseOrThrow(quickWarInputSchema, input, "Choose a supported type and valid competitors.");

  const entities = await prisma.entity.findMany({
    where: { workspaceId, status: "ACTIVE", id: { in: data.participantIds } },
    select: { id: true, name: true },
  });
  if (entities.length !== data.participantIds.length) {
    throw new ValidationError("Some competitors are not available in this workspace.", [
      { path: "participantIds", message: "Choose active competitors from this workspace." },
    ]);
  }
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const ordered = data.participantIds.map((id) => byId.get(id)!);
  const configuration = quickWarConfiguration(data.mode, ordered.length);
  const issue = anythingWarsExecutionIssue(data.mode, configuration.mode, ordered.length);
  if (issue) throw new ValidationError(issue, [{ path: "participantIds", message: issue }]);

  const projectId = await resolveQuickCreationsProject(userId, workspaceId);
  await addProjectEntities(userId, workspaceId, projectId, { entityIds: data.participantIds });

  const created = await createAnythingWarsEvent(userId, workspaceId, {
    projectId,
    name: quickWarName(data.mode, ordered.map((entity) => entity.name)),
    description: "Created with Anything Wars Quick War.",
    mode: data.mode,
    participants: data.participantIds.map((entityId) => ({ entityId })),
    configuration,
    presentation: defaultPresentation(),
    metadata: { creationFlow: "quick" },
  });
  const simulation = await markAnythingWarsEventReady(userId, workspaceId, created.id);
  const run = await createAnythingWarsRun(userId, workspaceId, simulation.id);
  const startedRun = await startSimulationRun(userId, workspaceId, run.id);
  return { simulation, run: startedRun };
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
