import type { Prisma } from "@prisma/client";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  SimulationConfigV1,
  SimulationPresentationConfig,
  defaultModeConfig,
  normalizeConfigInput,
  normalizePresentationInput,
  parseStoredConfig,
  parseStoredPresentation,
} from "@/lib/simulations/config";
import {
  DEFAULT_SIMULATION_SORT,
  SIMULATION_CONFIG_VERSION,
  SIMULATION_MAX_PAGE_SIZE,
  SIMULATION_PAGE_SIZE,
  isSimulationStatus,
  type SimulationSort,
  type SimulationStatus,
  type SimulationStatusFilter,
} from "@/lib/simulations/constants";
import { resolveMode } from "@/lib/simulations/modes";
import { generateSeed } from "@/lib/simulations/seed";
import { slugify } from "@/lib/utils";
import {
  createSimulationSchema,
  duplicateSimulationSchema,
  parseOrThrow,
  updateSimulationSchema,
  type SimulationParticipantInput,
} from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { parseMetadata, serializeMetadata } from "./serialization";
import { validateSimulationForReady } from "./simulation-validation-service";
import { requireMembership } from "./workspace-service";

// ---------------------------------------------------------------------------
// View types (what the API / UI consume — never raw ORM rows).
// ---------------------------------------------------------------------------

/** Lightweight entity summary shown on a participant card. */
export interface SimulationParticipantEntity {
  id: string;
  name: string;
  shortName: string | null;
  category: string;
  imageUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  status: string;
}

export interface SimulationParticipantView {
  entityId: string;
  position: number;
  role: string | null;
  overrides: Record<string, unknown> | null;
  /** The referenced entity (null only if it somehow no longer resolves). */
  entity: SimulationParticipantEntity | null;
}

/** Compact shape for library cards and lists. */
export interface SimulationSummary {
  id: string;
  workspaceId: string;
  projectId: string;
  projectName: string | null;
  name: string;
  description: string | null;
  mode: string;
  modeLabel: string;
  status: SimulationStatus;
  seed: string | null;
  worldId: string | null;
  worldVersion: number | null;
  worldName: string | null;
  worldStatus: string | null;
  participantCount: number;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

/** Full shape for the detail page + builder (adds config, presentation, participants). */
export interface SimulationView extends SimulationSummary {
  configVersion: number;
  configuration: SimulationConfigV1;
  presentation: SimulationPresentationConfig;
  metadata: Record<string, unknown> | null;
  participants: SimulationParticipantView[];
}

export interface ListSimulationsParams {
  search?: string;
  projectId?: string;
  mode?: string;
  status?: SimulationStatusFilter;
  sort?: SimulationSort;
  page?: number;
  pageSize?: number;
}

export interface ListSimulationsResult {
  items: SimulationSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const simulationListInclude = {
  project: { select: { name: true } },
  world: { select: { name: true, status: true } },
  createdBy: { select: { displayName: true } },
  _count: { select: { entityLinks: true } },
} satisfies Prisma.SimulationInclude;

const simulationDetailInclude = {
  project: { select: { name: true } },
  world: { select: { name: true, status: true } },
  createdBy: { select: { displayName: true } },
  entityLinks: {
    orderBy: { position: "asc" },
    include: {
      entity: {
        select: {
          id: true,
          name: true,
          shortName: true,
          category: true,
          imageUrl: true,
          primaryColor: true,
          secondaryColor: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.SimulationInclude;

type SimulationListRow = Prisma.SimulationGetPayload<{ include: typeof simulationListInclude }>;
type SimulationDetailRow = Prisma.SimulationGetPayload<{ include: typeof simulationDetailInclude }>;

function toSimulationSummary(row: SimulationListRow): SimulationSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    name: row.name,
    description: row.description,
    mode: row.mode,
    modeLabel: resolveMode(row.mode).label,
    status: isSimulationStatus(row.status) ? row.status : "DRAFT",
    seed: row.seed,
    worldId: row.worldId,
    worldVersion: row.worldVersion,
    worldName: row.world?.name ?? null,
    worldStatus: row.world?.status ?? null,
    participantCount: row._count.entityLinks,
    createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function toSimulationView(row: SimulationDetailRow): SimulationView {
  const participants: SimulationParticipantView[] = row.entityLinks.map((link) => ({
    entityId: link.entityId,
    position: link.position,
    role: link.role,
    overrides: parseMetadata(link.overrides),
    entity: link.entity
      ? {
          id: link.entity.id,
          name: link.entity.name,
          shortName: link.entity.shortName,
          category: link.entity.category,
          imageUrl: link.entity.imageUrl,
          primaryColor: link.entity.primaryColor,
          secondaryColor: link.entity.secondaryColor,
          status: link.entity.status,
        }
      : null,
  }));

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    name: row.name,
    description: row.description,
    mode: row.mode,
    modeLabel: resolveMode(row.mode).label,
    status: isSimulationStatus(row.status) ? row.status : "DRAFT",
    seed: row.seed,
    worldId: row.worldId,
    worldVersion: row.worldVersion,
    worldName: row.world?.name ?? null,
    worldStatus: row.world?.status ?? null,
    participantCount: participants.length,
    createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    configVersion: row.configVersion,
    configuration: parseStoredConfig(row.configuration, row.mode),
    presentation: parseStoredPresentation(row.presentation),
    metadata: parseMetadata(row.metadata),
    participants,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List simulations in the active workspace with search, filters, sorting and
 * pagination. Requires simulation.view. Every query is scoped to workspaceId.
 * By default archived simulations are hidden (pass status ALL to include them).
 */
export async function listSimulations(
  userId: string,
  workspaceId: string,
  params: ListSimulationsParams = {},
): Promise<ListSimulationsResult> {
  await requireMembership(userId, workspaceId, "simulation.view");

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(
    SIMULATION_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(params.pageSize ?? SIMULATION_PAGE_SIZE)),
  );
  const sort = params.sort ?? DEFAULT_SIMULATION_SORT;

  const where: Prisma.SimulationWhereInput = { workspaceId };

  // Status: an explicit status filters to exactly that; "ALL" removes the
  // constraint; the default hides archived blueprints.
  const statusFilter = params.status;
  if (statusFilter === "ALL") {
    // no status constraint
  } else if (statusFilter) {
    where.status = statusFilter;
  } else {
    where.status = { not: "ARCHIVED" };
  }

  if (params.projectId) where.projectId = params.projectId;

  if (params.mode) {
    const mode = slugify(params.mode);
    if (mode) where.mode = mode;
  }

  const search = params.search?.trim();
  if (search) {
    where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
  }

  const [total, rows] = await Promise.all([
    prisma.simulation.count({ where }),
    prisma.simulation.findMany({
      where,
      include: simulationListInclude,
      orderBy: orderByForSort(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toSimulationSummary),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Get a single simulation that belongs to the active workspace. Requires simulation.view. */
export async function getSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.view");
  return loadSimulationView(simulationId, workspaceId);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create a simulation *configuration* in the active workspace. Requires
 * simulation.create. Always starts as DRAFT. The project must belong to the
 * workspace and every participant must be a workspace entity. Config and
 * presentation are validated server-side (never persisted as raw client JSON).
 */
export async function createSimulation(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.create");
  const data = parseOrThrow(createSimulationSchema, input);

  // The project must belong to this workspace (never trust the client's id).
  await assertProjectInWorkspace(workspaceId, data.projectId, "projectId");

  const mode = data.mode; // already slugified by the schema
  const config = normalizeConfigInput(mode, data.configuration ?? {});
  const presentation = normalizePresentationInput(data.presentation ?? {});
  const participants = await resolveParticipants(workspaceId, data.participants ?? []);
  const worldBinding = await resolveWorldBinding(workspaceId, data.worldId ?? null, data.worldVersion ?? null);
  const seed = data.seed ?? generateSeed();

  const created = await prisma.$transaction(async (tx) => {
    return tx.simulation.create({
      data: {
        workspaceId,
        projectId: data.projectId,
        name: data.name,
        description: data.description ?? null,
        mode,
        status: "DRAFT",
        seed,
        configVersion: SIMULATION_CONFIG_VERSION,
        configuration: JSON.stringify(config),
        presentation: JSON.stringify(presentation),
        metadata: serializeMetadata(data.metadata),
        worldId: worldBinding?.worldId ?? null,
        worldVersion: worldBinding?.worldVersion ?? null,
        createdById: userId,
        entityLinks: {
          create: participants.map((p) => ({
            entityId: p.entityId,
            position: p.position,
            role: p.role,
            overrides: p.overrides,
          })),
        },
      },
      include: simulationDetailInclude,
    });
  });

  await recordAudit({
    action: "simulation.created",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: created.id,
    metadata: { name: created.name, mode },
  });

  return toSimulationView(created);
}

/**
 * Update a simulation's editable fields. Requires simulation.edit. If a
 * validity-affecting field changes (mode/project/config/participants) and the
 * simulation was READY, it is returned to DRAFT so READY always reflects a
 * validated blueprint. Status is never set directly here — use the dedicated
 * markReady/markDraft actions.
 */
export async function updateSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
  input: unknown,
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.edit");

  const existing = await prisma.simulation.findFirst({
    where: { id: simulationId, workspaceId },
    select: { id: true, status: true, mode: true, configuration: true, worldId: true, worldVersion: true },
  });
  if (!existing) throw new NotFoundError("Simulation not found.");

  const data = parseOrThrow(updateSimulationSchema, input);
  const raw = asRecord(input);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);

  const scalar: Prisma.SimulationUpdateInput = {};

  if (has("name") && data.name !== undefined) scalar.name = data.name;
  if (has("description")) scalar.description = data.description ?? null;

  if (has("projectId") && data.projectId !== undefined) {
    await assertProjectInWorkspace(workspaceId, data.projectId, "projectId");
    scalar.project = { connect: { id: data.projectId } };
  }

  const effectiveMode = has("mode") && data.mode !== undefined ? data.mode : existing.mode;
  const modeChanged = has("mode") && data.mode !== undefined && data.mode !== existing.mode;
  if (has("mode") && data.mode !== undefined) scalar.mode = data.mode;

  if (has("seed")) {
    // An explicit empty seed means "auto" — regenerate a fresh valid label.
    scalar.seed = data.seed ?? generateSeed();
  }

  if (has("metadata")) scalar.metadata = serializeMetadata(data.metadata);

  if (has("worldId") || has("worldVersion")) {
    const binding = await resolveWorldBinding(workspaceId, data.worldId ?? null, data.worldVersion ?? null);
    scalar.world = binding ? { connect: { id: binding.worldId } } : { disconnect: true };
    scalar.worldVersion = binding?.worldVersion ?? null;
  }

  // Configuration: validate against the EFFECTIVE mode. When the mode changed
  // without a new config, keep the general settings and reset only the
  // mode-specific placeholders to that mode's defaults.
  if (has("configuration")) {
    scalar.configuration = JSON.stringify(normalizeConfigInput(effectiveMode, data.configuration ?? {}));
    scalar.configVersion = SIMULATION_CONFIG_VERSION;
  } else if (modeChanged) {
    const current = parseStoredConfig(existing.configuration, existing.mode);
    const next: SimulationConfigV1 = {
      version: SIMULATION_CONFIG_VERSION,
      general: current.general,
      mode: defaultModeConfig(effectiveMode),
    };
    scalar.configuration = JSON.stringify(next);
    scalar.configVersion = SIMULATION_CONFIG_VERSION;
  }

  if (has("presentation")) {
    scalar.presentation = JSON.stringify(normalizePresentationInput(data.presentation ?? {}));
  }

  const willReplaceParticipants = has("participants");
  const participants = willReplaceParticipants
    ? await resolveParticipants(workspaceId, data.participants ?? [])
    : [];

  // A validated (READY) blueprint returns to DRAFT when its validity could change.
  const validityTouched =
    has("mode") || has("projectId") || has("configuration") || has("participants") || has("worldId") || has("worldVersion");
  if (existing.status === "READY" && validityTouched) scalar.status = "DRAFT";

  await prisma.$transaction(async (tx) => {
    if (Object.keys(scalar).length > 0) {
      await tx.simulation.update({ where: { id: simulationId }, data: scalar });
    }
    if (willReplaceParticipants) {
      await tx.simulationEntity.deleteMany({ where: { simulationId } });
      if (participants.length > 0) {
        await tx.simulationEntity.createMany({
          data: participants.map((p) => ({ simulationId, ...p })),
        });
      }
    }
  });

  await recordAudit({
    action: "simulation.updated",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: simulationId,
    metadata: { name: (scalar.name as string | undefined) ?? undefined },
  });

  return loadSimulationView(simulationId, workspaceId);
}

/**
 * Duplicate a simulation: copies configuration, presentation and participant
 * references (never clones entities). Always gets a NEW seed and starts as DRAFT.
 * Requires simulation.duplicate.
 */
export async function duplicateSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
  input: unknown = {},
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.duplicate");
  const { name } = parseOrThrow(duplicateSimulationSchema, input);

  const source = await prisma.simulation.findFirst({
    where: { id: simulationId, workspaceId },
    include: { entityLinks: true },
  });
  if (!source) throw new NotFoundError("Simulation not found.");

  const copyName = (name ?? `${source.name} Copy`).slice(0, 80);
  const newSeed = generateSeed();

  const created = await prisma.$transaction(async (tx) => {
    return tx.simulation.create({
      data: {
        workspaceId,
        projectId: source.projectId,
        name: copyName,
        description: source.description,
        mode: source.mode,
        status: "DRAFT",
        seed: newSeed,
        configVersion: source.configVersion,
        configuration: source.configuration,
        presentation: source.presentation,
        metadata: source.metadata,
        worldId: source.worldId,
        worldVersion: source.worldVersion,
        createdById: userId,
        entityLinks: {
          create: source.entityLinks.map((link) => ({
            entityId: link.entityId,
            position: link.position,
            role: link.role,
            overrides: link.overrides,
          })),
        },
      },
      include: simulationDetailInclude,
    });
  });

  await recordAudit({
    action: "simulation.duplicated",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: created.id,
    metadata: { name: created.name, sourceId: simulationId },
  });

  return toSimulationView(created);
}

/** Archive a simulation (soft, reversible). Requires simulation.archive. */
export async function archiveSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.archive");

  const existing = await prisma.simulation.findFirst({
    where: { id: simulationId, workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new NotFoundError("Simulation not found.");

  await prisma.simulation.update({
    where: { id: simulationId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await recordAudit({
    action: "simulation.archived",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: simulationId,
    metadata: { name: existing.name },
  });

  return loadSimulationView(simulationId, workspaceId);
}

/**
 * Restore an archived simulation. Requires simulation.archive. The restored
 * status is re-derived from validation: READY if the blueprint still passes,
 * otherwise DRAFT — so status stays truthful after a round-trip.
 */
export async function restoreSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.archive");

  const view = await loadSimulationView(simulationId, workspaceId);
  const status: SimulationStatus = validateSimulationForReady(view).ok ? "READY" : "DRAFT";

  await prisma.simulation.update({
    where: { id: simulationId },
    data: { status, archivedAt: null },
  });

  await recordAudit({
    action: "simulation.restored",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: simulationId,
    metadata: { name: view.name },
  });

  return loadSimulationView(simulationId, workspaceId);
}

/**
 * Permanently delete a simulation. Requires simulation.delete AND that it
 * belongs to the active workspace. Participant LINK rows cascade away; the
 * referenced Entities are never deleted.
 */
export async function deleteSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<{ id: string }> {
  await requireMembership(userId, workspaceId, "simulation.delete");

  const existing = await prisma.simulation.findFirst({
    where: { id: simulationId, workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new NotFoundError("Simulation not found.");

  const runCount = await prisma.simulationRun.count({ where: { simulationId } });
  if (runCount > 0) {
    throw new ConflictError("A simulation with historical runs cannot be deleted. Archive it instead.");
  }

  try {
    await prisma.simulation.delete({ where: { id: simulationId } });
  } catch (error) {
    // A run created after the count still wins through the FK restriction.
    if ((error as { code?: unknown } | null)?.code === "P2003") {
      throw new ConflictError("A simulation with historical runs cannot be deleted. Archive it instead.");
    }
    throw error;
  }

  await recordAudit({
    action: "simulation.deleted",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: simulationId,
    metadata: { name: existing.name },
  });

  return { id: simulationId };
}

// ---------------------------------------------------------------------------
// Status transitions (dedicated actions — not part of the write schema).
// ---------------------------------------------------------------------------

/**
 * Mark a simulation READY. Requires simulation.edit. Runs the READY validation
 * service; on failure it throws a ValidationError carrying the structured issues
 * so the builder can point at the offending step. READY reflects a complete,
 * valid CONFIGURATION — execution also needs a registered mode module.
 */
export async function markSimulationReady(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.edit");

  const view = await loadSimulationView(simulationId, workspaceId);
  const result = validateSimulationForReady(view);
  if (!result.ok) {
    throw new ValidationError(
      "This simulation isn’t ready yet.",
      result.issues.map((issue) => ({ path: issue.field, message: issue.message })),
    );
  }

  await prisma.simulation.update({
    where: { id: simulationId },
    data: { status: "READY" },
  });

  await recordAudit({
    action: "simulation.ready",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: simulationId,
    metadata: { name: view.name },
  });

  return loadSimulationView(simulationId, workspaceId);
}

/** Return a simulation to DRAFT. Requires simulation.edit. */
export async function markSimulationDraft(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  await requireMembership(userId, workspaceId, "simulation.edit");

  const existing = await prisma.simulation.findFirst({
    where: { id: simulationId, workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new NotFoundError("Simulation not found.");

  await prisma.simulation.update({
    where: { id: simulationId },
    data: { status: "DRAFT" },
  });

  await recordAudit({
    action: "simulation.draft",
    actorUserId: userId,
    workspaceId,
    entityType: "Simulation",
    entityId: simulationId,
    metadata: { name: existing.name },
  });

  return loadSimulationView(simulationId, workspaceId);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadSimulationView(simulationId: string, workspaceId: string): Promise<SimulationView> {
  const row = await prisma.simulation.findFirst({
    where: { id: simulationId, workspaceId },
    include: simulationDetailInclude,
  });
  if (!row) throw new NotFoundError("Simulation not found.");
  return toSimulationView(row);
}

/** Confirm a project id belongs to the active workspace; otherwise reject uniformly. */
async function assertProjectInWorkspace(
  workspaceId: string,
  projectId: string,
  field: string,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) {
    throw new ValidationError("That project is not available in this workspace.", [
      { path: field, message: "Choose a project from this workspace." },
    ]);
  }
}

async function resolveWorldBinding(workspaceId: string, worldId: string | null, worldVersion: number | null) {
  if (worldId === null && worldVersion === null) return null;
  if (!worldId || !worldVersion) throw new ValidationError("Select both a World and an immutable World version.", [
    { path: "worldId", message: "Choose a complete World version binding." },
  ]);
  const version = await prisma.worldVersion.findFirst({
    where: { worldId, version: worldVersion, world: { workspaceId } },
    select: { world: { select: { status: true } } },
  });
  if (!version || version.world.status === "ARCHIVED") throw new ValidationError("That World version is not available in this workspace.", [
    { path: "worldId", message: "Choose an active World and version from this workspace." },
  ]);
  return { worldId, worldVersion };
}

/**
 * Validate participant selections and return canonical link rows.
 *
 * SECURITY: every entity id MUST belong to the active workspace — a simulation
 * can never reference an entity from another workspace. Foreign/unknown ids are
 * rejected uniformly. Duplicates are collapsed (an entity appears at most once)
 * and ordering is taken from array order (position 0..n-1), so the builder's
 * order is authoritative.
 */
async function resolveParticipants(
  workspaceId: string,
  inputs: SimulationParticipantInput[],
): Promise<{ entityId: string; position: number; role: string | null; overrides: string | null }[]> {
  if (inputs.length === 0) return [];

  const ids = [...new Set(inputs.map((i) => i.entityId))];
  const owned = await prisma.entity.findMany({
    where: { id: { in: ids }, workspaceId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((e) => e.id));
  if (ownedIds.size !== ids.length) {
    throw new ValidationError("Some participants are not valid entities in this workspace.", [
      { path: "participants", message: "One or more selected entities are invalid for this workspace." },
    ]);
  }

  const seen = new Set<string>();
  const rows: { entityId: string; position: number; role: string | null; overrides: string | null }[] = [];
  for (const input of inputs) {
    if (seen.has(input.entityId)) continue;
    seen.add(input.entityId);
    rows.push({
      entityId: input.entityId,
      position: rows.length,
      role: input.role ?? null,
      overrides: serializeMetadata(input.overrides),
    });
  }
  return rows;
}

function orderByForSort(sort: SimulationSort): Prisma.SimulationOrderByWithRelationInput {
  switch (sort) {
    case "name_asc":
      return { name: "asc" };
    case "name_desc":
      return { name: "desc" };
    case "created_asc":
      return { createdAt: "asc" };
    case "created_desc":
      return { createdAt: "desc" };
    case "updated_desc":
    default:
      return { updatedAt: "desc" };
  }
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}
