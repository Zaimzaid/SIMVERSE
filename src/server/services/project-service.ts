import type { Prisma } from "@prisma/client";

import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  DEFAULT_PROJECT_SORT,
  PROJECT_MAX_PAGE_SIZE,
  PROJECT_PAGE_SIZE,
  isProjectStatus,
  type ProjectSort,
  type ProjectStatus,
  type ProjectStatusFilter,
} from "@/lib/projects/constants";
import { slugify } from "@/lib/utils";
import {
  addProjectEntitiesSchema,
  createProjectSchema,
  parseOrThrow,
  updateProjectSchema,
} from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { parseMetadata, serializeMetadata } from "./serialization";
import { requireMembership } from "./workspace-service";

// ---------------------------------------------------------------------------
// View types (what the API / UI consume — never raw ORM rows).
// ---------------------------------------------------------------------------

export interface ProjectView {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  coverUrl: string | null;
  status: ProjectStatus;
  metadata: Record<string, unknown> | null;
  /** Real relation counts — never fabricated. */
  entityCount: number;
  simulationCount: number;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ListProjectsParams {
  search?: string;
  status?: ProjectStatusFilter;
  sort?: ProjectSort;
  page?: number;
  pageSize?: number;
}

export interface ListProjectsResult {
  items: ProjectView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const projectInclude = {
  createdBy: { select: { displayName: true } },
  _count: { select: { entityLinks: true, simulations: true } },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

function toProjectView(row: ProjectWithRelations): ProjectView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    coverUrl: row.coverUrl,
    status: isProjectStatus(row.status) ? row.status : "ACTIVE",
    metadata: parseMetadata(row.metadata),
    entityCount: row._count.entityLinks,
    simulationCount: row._count.simulations,
    createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List projects in the active workspace with search, status filter, sorting and
 * pagination. Requires project.view. Every query is scoped to workspaceId.
 */
export async function listProjects(
  userId: string,
  workspaceId: string,
  params: ListProjectsParams = {},
): Promise<ListProjectsResult> {
  await requireMembership(userId, workspaceId, "project.view");

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(PROJECT_MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? PROJECT_PAGE_SIZE)));
  const sort = params.sort ?? DEFAULT_PROJECT_SORT;

  const where: Prisma.ProjectWhereInput = { workspaceId };

  const statusFilter = params.status ?? "ACTIVE";
  if (statusFilter !== "ALL") where.status = statusFilter;

  const search = params.search?.trim();
  if (search) {
    where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
  }

  const [total, rows] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: orderByForSort(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toProjectView),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Get a single project that belongs to the active workspace. Requires project.view. */
export async function getProject(
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<ProjectView> {
  await requireMembership(userId, workspaceId, "project.view");
  const row = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    include: projectInclude,
  });
  if (!row) throw new NotFoundError("Project not found.");
  return toProjectView(row);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Create a project in the active workspace. Requires project.create. */
export async function createProject(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<ProjectView> {
  await requireMembership(userId, workspaceId, "project.create");
  const data = parseOrThrow(createProjectSchema, input);

  const created = await prisma.project.create({
    data: {
      workspaceId,
      name: data.name,
      slug: slugify(data.name),
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      coverUrl: data.coverUrl ?? null,
      status: "ACTIVE",
      metadata: serializeMetadata(data.metadata),
      createdById: userId,
    },
    include: projectInclude,
  });

  await recordAudit({
    action: "project.created",
    actorUserId: userId,
    workspaceId,
    entityType: "Project",
    entityId: created.id,
    metadata: { name: created.name },
  });

  return toProjectView(created);
}

/** Update a project's editable fields in the active workspace. Requires project.edit. */
export async function updateProject(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: unknown,
): Promise<ProjectView> {
  await requireMembership(userId, workspaceId, "project.edit");

  const existing = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Project not found.");

  const data = parseOrThrow(updateProjectSchema, input);
  const raw = asRecord(input);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);

  const scalar: Prisma.ProjectUpdateInput = {};
  if (has("name") && data.name !== undefined) {
    scalar.name = data.name;
    scalar.slug = slugify(data.name);
  }
  if (has("description")) scalar.description = data.description ?? null;
  if (has("imageUrl")) scalar.imageUrl = data.imageUrl ?? null;
  if (has("coverUrl")) scalar.coverUrl = data.coverUrl ?? null;
  if (has("metadata")) scalar.metadata = serializeMetadata(data.metadata);

  if (Object.keys(scalar).length > 0) {
    await prisma.project.update({ where: { id: projectId }, data: scalar });
  }

  await recordAudit({
    action: "project.updated",
    actorUserId: userId,
    workspaceId,
    entityType: "Project",
    entityId: projectId,
    metadata: { name: (scalar.name as string | undefined) ?? undefined },
  });

  return loadProjectView(projectId, workspaceId);
}

/** Archive a project (soft, reversible). Does NOT archive its entities or simulations. Requires project.archive. */
export async function archiveProject(
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<ProjectView> {
  return setArchived(userId, workspaceId, projectId, true);
}

/** Restore an archived project to ACTIVE. Requires project.archive. */
export async function restoreProject(
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<ProjectView> {
  return setArchived(userId, workspaceId, projectId, false);
}

async function setArchived(
  userId: string,
  workspaceId: string,
  projectId: string,
  archived: boolean,
): Promise<ProjectView> {
  await requireMembership(userId, workspaceId, "project.archive");

  const existing = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new NotFoundError("Project not found.");

  // Archiving a project only changes the PROJECT's status. Its Entities are
  // shared and untouched; its Simulations keep their own lifecycle. We never
  // cascade an archive to related records.
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: archived ? "ARCHIVED" : "ACTIVE",
      archivedAt: archived ? new Date() : null,
    },
  });

  await recordAudit({
    action: archived ? "project.archived" : "project.restored",
    actorUserId: userId,
    workspaceId,
    entityType: "Project",
    entityId: projectId,
    metadata: { name: existing.name },
  });

  return loadProjectView(projectId, workspaceId);
}

/**
 * Permanently delete a project. Requires project.delete AND that the project
 * belongs to the active workspace. Its entity LINKS and its Simulations (which
 * are owned by the project) are removed by cascade — but the shared Entities
 * themselves are never deleted.
 */
export async function deleteProject(
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<{ id: string }> {
  await requireMembership(userId, workspaceId, "project.delete");

  const existing = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new NotFoundError("Project not found.");

  await prisma.project.delete({ where: { id: projectId } });

  await recordAudit({
    action: "project.deleted",
    actorUserId: userId,
    workspaceId,
    entityType: "Project",
    entityId: projectId,
    metadata: { name: existing.name },
  });

  return { id: projectId };
}

// ---------------------------------------------------------------------------
// Project ↔ Entity relationships (reference links, never clones)
// ---------------------------------------------------------------------------

/**
 * Add existing entities to a project by reference. Requires project.entity.manage.
 *
 * SECURITY: the project must belong to the active workspace, and EVERY entity id
 * must belong to the same workspace — a Project in Workspace A can never reference
 * an Entity from Workspace B. Foreign/unknown ids are rejected uniformly (they
 * never reveal whether a record exists elsewhere). Duplicate links are skipped.
 */
export async function addProjectEntities(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: unknown,
): Promise<ProjectView> {
  await requireMembership(userId, workspaceId, "project.entity.manage");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true },
  });
  if (!project) throw new NotFoundError("Project not found.");

  const { entityIds } = parseOrThrow(addProjectEntitiesSchema, input);
  const requested = [...new Set(entityIds)];

  // Only entities that actually belong to THIS workspace are eligible.
  const owned = await prisma.entity.findMany({
    where: { id: { in: requested }, workspaceId },
    select: { id: true, name: true },
  });
  if (owned.length !== requested.length) {
    throw new ValidationError("Some of those entities do not belong to this workspace.", [
      { path: "entityIds", message: "One or more entities are invalid for this workspace." },
    ]);
  }

  // Skip entities already linked (no duplicate relations; SQLite has no createMany skipDuplicates).
  const existingLinks = await prisma.projectEntity.findMany({
    where: { projectId, entityId: { in: requested } },
    select: { entityId: true },
  });
  const already = new Set(existingLinks.map((l) => l.entityId));
  const toAdd = owned.filter((e) => !already.has(e.id));

  if (toAdd.length > 0) {
    await prisma.$transaction(
      toAdd.map((e) =>
        prisma.projectEntity.create({
          data: { projectId, entityId: e.id, addedById: userId },
        }),
      ),
    );

    await recordAudit({
      action: "project.entity_added",
      actorUserId: userId,
      workspaceId,
      entityType: "Project",
      entityId: projectId,
      metadata: {
        name: toAdd.length === 1 ? toAdd[0]!.name : project.name,
        count: toAdd.length,
        projectName: project.name,
      },
    });
  }

  return loadProjectView(projectId, workspaceId);
}

/**
 * Remove an entity from a project. Requires project.entity.manage. This deletes
 * only the LINK row — the Entity itself is never deleted or archived.
 */
export async function removeProjectEntity(
  userId: string,
  workspaceId: string,
  projectId: string,
  entityId: string,
): Promise<ProjectView> {
  await requireMembership(userId, workspaceId, "project.entity.manage");

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true },
  });
  if (!project) throw new NotFoundError("Project not found.");

  const link = await prisma.projectEntity.findUnique({
    where: { projectId_entityId: { projectId, entityId } },
    include: { entity: { select: { name: true } } },
  });

  // Only remove a link that exists; deleting the join row leaves the Entity intact.
  if (link) {
    await prisma.projectEntity.delete({
      where: { projectId_entityId: { projectId, entityId } },
    });

    await recordAudit({
      action: "project.entity_removed",
      actorUserId: userId,
      workspaceId,
      entityType: "Project",
      entityId: projectId,
      metadata: { name: link.entity.name, projectName: project.name },
    });
  }

  return loadProjectView(projectId, workspaceId);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadProjectView(projectId: string, workspaceId: string): Promise<ProjectView> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    include: projectInclude,
  });
  if (!row) throw new NotFoundError("Project not found.");
  return toProjectView(row);
}

function orderByForSort(sort: ProjectSort): Prisma.ProjectOrderByWithRelationInput {
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
