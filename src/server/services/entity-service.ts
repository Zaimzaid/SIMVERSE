import type { Prisma } from "@prisma/client";

import { NotFoundError, ValidationError, type FieldIssue } from "@/lib/errors";
import {
  coerceAttributeValue,
  isEmptyValue,
  parseAttributeOptions,
  parseStoredAttributeValue,
} from "@/lib/entities/attribute-values";
import {
  DEFAULT_ENTITY_SORT,
  ENTITY_PAGE_SIZE,
  ENTITY_MAX_PAGE_SIZE,
  isEntityStatus,
  type AttributeDataType,
  type EntitySort,
  type EntityStatus,
  type EntityStatusFilter,
} from "@/lib/entities/constants";
import { slugify } from "@/lib/utils";
import type { EntityAttributeInput } from "@/lib/validation";
import { createEntitySchema, duplicateEntitySchema, parseOrThrow, updateEntitySchema } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

const METADATA_MAX = 20_000;

// ---------------------------------------------------------------------------
// View types (what the API / UI consume — never raw ORM rows).
// ---------------------------------------------------------------------------

export interface EntityTagView {
  id: string;
  name: string;
  slug: string;
}

export interface EntityAttributeView {
  attributeDefinitionId: string;
  key: string;
  name: string;
  dataType: AttributeDataType;
  unit: string | null;
  minimum: number | null;
  maximum: number | null;
  /** typed value (number/boolean/string) for display */
  value: string | number | boolean;
  /** canonical stored string (for editing round-trips) */
  rawValue: string;
}

export interface EntityView {
  id: string;
  workspaceId: string;
  name: string;
  shortName: string | null;
  description: string | null;
  category: string;
  imageUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  status: EntityStatus;
  metadata: Record<string, unknown> | null;
  tags: EntityTagView[];
  attributes: EntityAttributeView[];
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ListEntitiesParams {
  search?: string;
  category?: string;
  status?: EntityStatusFilter;
  tag?: string;
  sort?: EntitySort;
  page?: number;
  pageSize?: number;
}

export interface ListEntitiesResult {
  items: EntityView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const entityInclude = {
  attributeValues: { include: { attributeDefinition: true } },
  entityTags: { include: { tag: true } },
  createdBy: { select: { displayName: true } },
} satisfies Prisma.EntityInclude;

type EntityWithRelations = Prisma.EntityGetPayload<{ include: typeof entityInclude }>;

function toEntityView(row: EntityWithRelations): EntityView {
  const attributes: EntityAttributeView[] = row.attributeValues
    .map((av) => {
      const dataType = av.attributeDefinition.dataType as AttributeDataType;
      return {
        attributeDefinitionId: av.attributeDefinitionId,
        key: av.attributeDefinition.key,
        name: av.attributeDefinition.name,
        dataType,
        unit: av.attributeDefinition.unit,
        minimum: av.attributeDefinition.minimum,
        maximum: av.attributeDefinition.maximum,
        value: parseStoredAttributeValue(dataType, av.value),
        rawValue: av.value,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const tags: EntityTagView[] = row.entityTags
    .map((et) => ({ id: et.tag.id, name: et.tag.name, slug: et.tag.slug }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    shortName: row.shortName,
    description: row.description,
    category: row.category,
    imageUrl: row.imageUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    status: isEntityStatus(row.status) ? row.status : "ACTIVE",
    metadata: parseMetadata(row.metadata),
    tags,
    attributes,
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
 * List entities in the active workspace with search, filtering, sorting and
 * pagination. Requires entity.view. Every query is scoped to workspaceId, so a
 * user can never see another workspace's entities.
 */
export async function listEntities(
  userId: string,
  workspaceId: string,
  params: ListEntitiesParams = {},
): Promise<ListEntitiesResult> {
  await requireMembership(userId, workspaceId, "entity.view");

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(ENTITY_MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? ENTITY_PAGE_SIZE)));
  const sort = params.sort ?? DEFAULT_ENTITY_SORT;

  const where: Prisma.EntityWhereInput = { workspaceId };

  const statusFilter = params.status ?? "ACTIVE";
  if (statusFilter !== "ALL") where.status = statusFilter;

  if (params.category) {
    const category = slugify(params.category);
    if (category) where.category = category;
  }

  if (params.tag) {
    const slug = slugify(params.tag);
    if (slug) where.entityTags = { some: { tag: { slug } } };
  }

  const search = params.search?.trim();
  if (search) {
    // SQLite LIKE is case-insensitive for ASCII; no `mode` (Postgres-only) is used.
    where.OR = [
      { name: { contains: search } },
      { shortName: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.entity.count({ where }),
    prisma.entity.findMany({
      where,
      include: entityInclude,
      orderBy: orderByForSort(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toEntityView),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Get a single entity that belongs to the active workspace. Requires entity.view. */
export async function getEntity(
  userId: string,
  workspaceId: string,
  entityId: string,
): Promise<EntityView> {
  await requireMembership(userId, workspaceId, "entity.view");
  const row = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    include: entityInclude,
  });
  if (!row) throw new NotFoundError("Entity not found.");
  return toEntityView(row);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Create an entity in the active workspace. Requires entity.create. */
export async function createEntity(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<EntityView> {
  await requireMembership(userId, workspaceId, "entity.create");
  const data = parseOrThrow(createEntitySchema, input);

  const status: EntityStatus = data.status ?? "ACTIVE";
  const metadata = serializeMetadata(data.metadata);

  const created = await prisma.$transaction(async (tx) => {
    const tagIds = await resolveTagIds(tx, workspaceId, data.tags ?? []);
    const attributeValues = await resolveAttributeValues(tx, workspaceId, data.attributes ?? []);

    return tx.entity.create({
      data: {
        workspaceId,
        name: data.name,
        shortName: data.shortName ?? null,
        description: data.description ?? null,
        category: data.category,
        imageUrl: data.imageUrl ?? null,
        primaryColor: data.primaryColor ?? null,
        secondaryColor: data.secondaryColor ?? null,
        status,
        archivedAt: status === "ARCHIVED" ? new Date() : null,
        metadata,
        createdById: userId,
        attributeValues: { create: attributeValues },
        entityTags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: entityInclude,
    });
  });

  await recordAudit({
    action: "entity.created",
    actorUserId: userId,
    workspaceId,
    entityType: "Entity",
    entityId: created.id,
    metadata: { name: created.name, category: created.category },
  });

  return toEntityView(created);
}

/** Update an entity in the active workspace. Requires entity.edit. */
export async function updateEntity(
  userId: string,
  workspaceId: string,
  entityId: string,
  input: unknown,
): Promise<EntityView> {
  await requireMembership(userId, workspaceId, "entity.edit");

  const existing = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Entity not found.");

  const data = parseOrThrow(updateEntitySchema, input);
  const raw = asRecord(input);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);

  const scalar: Prisma.EntityUpdateInput = {};
  if (has("name") && data.name !== undefined) scalar.name = data.name;
  if (has("category") && data.category !== undefined) scalar.category = data.category;
  if (has("shortName")) scalar.shortName = data.shortName ?? null;
  if (has("description")) scalar.description = data.description ?? null;
  if (has("imageUrl")) scalar.imageUrl = data.imageUrl ?? null;
  if (has("primaryColor")) scalar.primaryColor = data.primaryColor ?? null;
  if (has("secondaryColor")) scalar.secondaryColor = data.secondaryColor ?? null;
  if (has("metadata")) scalar.metadata = serializeMetadata(data.metadata);
  if (has("status") && data.status) {
    scalar.status = data.status;
    scalar.archivedAt = data.status === "ARCHIVED" ? new Date() : null;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(scalar).length > 0) {
      await tx.entity.update({ where: { id: entityId }, data: scalar });
    }

    if (has("attributes")) {
      const attributeValues = await resolveAttributeValues(tx, workspaceId, data.attributes ?? []);
      await tx.entityAttributeValue.deleteMany({ where: { entityId } });
      if (attributeValues.length > 0) {
        await tx.entityAttributeValue.createMany({
          data: attributeValues.map((v) => ({ entityId, ...v })),
        });
      }
    }

    if (has("tags")) {
      const tagIds = await resolveTagIds(tx, workspaceId, data.tags ?? []);
      await tx.entityTag.deleteMany({ where: { entityId } });
      if (tagIds.length > 0) {
        await tx.entityTag.createMany({ data: tagIds.map((tagId) => ({ entityId, tagId })) });
      }
    }
  });

  await recordAudit({
    action: "entity.updated",
    actorUserId: userId,
    workspaceId,
    entityType: "Entity",
    entityId,
    metadata: { name: (scalar.name as string | undefined) ?? undefined },
  });

  return loadEntityView(entityId, workspaceId);
}

/**
 * Duplicate an entity, copying its category, description, colors, image,
 * attributes, tags and metadata. A fresh id/timestamps are generated; the copy
 * is always ACTIVE and named "<name> Copy" unless a name is supplied.
 * Requires entity.duplicate.
 */
export async function duplicateEntity(
  userId: string,
  workspaceId: string,
  entityId: string,
  input: unknown = {},
): Promise<EntityView> {
  await requireMembership(userId, workspaceId, "entity.duplicate");
  const { name } = parseOrThrow(duplicateEntitySchema, input);

  const source = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    include: { attributeValues: true, entityTags: true },
  });
  if (!source) throw new NotFoundError("Entity not found.");

  const copyName = (name ?? `${source.name} Copy`).slice(0, 80);

  const created = await prisma.$transaction(async (tx) => {
    return tx.entity.create({
      data: {
        workspaceId,
        name: copyName,
        shortName: source.shortName,
        description: source.description,
        category: source.category,
        imageUrl: source.imageUrl,
        primaryColor: source.primaryColor,
        secondaryColor: source.secondaryColor,
        status: "ACTIVE",
        archivedAt: null,
        metadata: source.metadata,
        createdById: userId,
        attributeValues: {
          create: source.attributeValues.map((av) => ({
            attributeDefinitionId: av.attributeDefinitionId,
            value: av.value,
          })),
        },
        entityTags: {
          create: source.entityTags.map((et) => ({ tagId: et.tagId })),
        },
      },
      include: entityInclude,
    });
  });

  await recordAudit({
    action: "entity.duplicated",
    actorUserId: userId,
    workspaceId,
    entityType: "Entity",
    entityId: created.id,
    metadata: { name: created.name, sourceId: entityId },
  });

  return toEntityView(created);
}

/** Archive an entity (soft, reversible). Requires entity.archive. */
export async function archiveEntity(
  userId: string,
  workspaceId: string,
  entityId: string,
): Promise<EntityView> {
  return setArchived(userId, workspaceId, entityId, true);
}

/** Restore an archived entity to ACTIVE. Requires entity.archive. */
export async function restoreEntity(
  userId: string,
  workspaceId: string,
  entityId: string,
): Promise<EntityView> {
  return setArchived(userId, workspaceId, entityId, false);
}

async function setArchived(
  userId: string,
  workspaceId: string,
  entityId: string,
  archived: boolean,
): Promise<EntityView> {
  await requireMembership(userId, workspaceId, "entity.archive");

  const existing = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new NotFoundError("Entity not found.");

  await prisma.entity.update({
    where: { id: entityId },
    data: {
      status: archived ? "ARCHIVED" : "ACTIVE",
      archivedAt: archived ? new Date() : null,
    },
  });

  await recordAudit({
    action: archived ? "entity.archived" : "entity.restored",
    actorUserId: userId,
    workspaceId,
    entityType: "Entity",
    entityId,
    metadata: { name: existing.name },
  });

  return loadEntityView(entityId, workspaceId);
}

/**
 * Permanently delete an entity. Requires entity.delete AND that the entity
 * belongs to the active workspace (no other workspace can delete it). Related
 * attribute values and tag links are removed by cascade; workspace-level
 * attribute definitions and tags are preserved.
 */
export async function deleteEntity(
  userId: string,
  workspaceId: string,
  entityId: string,
): Promise<{ id: string }> {
  await requireMembership(userId, workspaceId, "entity.delete");

  const existing = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new NotFoundError("Entity not found.");

  await prisma.entity.delete({ where: { id: entityId } });

  await recordAudit({
    action: "entity.deleted",
    actorUserId: userId,
    workspaceId,
    entityType: "Entity",
    entityId,
    metadata: { name: existing.name },
  });

  return { id: entityId };
}

/** Distinct tags in the workspace (for filters + suggestions). Requires entity.view. */
export async function listWorkspaceTags(
  userId: string,
  workspaceId: string,
): Promise<EntityTagView[]> {
  await requireMembership(userId, workspaceId, "entity.view");
  const tags = await prisma.tag.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
}

/** Distinct category keys present in the workspace (for the category filter). Requires entity.view. */
export async function listWorkspaceCategories(
  userId: string,
  workspaceId: string,
): Promise<string[]> {
  await requireMembership(userId, workspaceId, "entity.view");
  const rows = await prisma.entity.findMany({
    where: { workspaceId },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadEntityView(entityId: string, workspaceId: string): Promise<EntityView> {
  const row = await prisma.entity.findFirst({
    where: { id: entityId, workspaceId },
    include: entityInclude,
  });
  if (!row) throw new NotFoundError("Entity not found.");
  return toEntityView(row);
}

function orderByForSort(sort: EntitySort): Prisma.EntityOrderByWithRelationInput {
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

/** Upsert tags by slug within the workspace and return their ids (de-duplicated). */
async function resolveTagIds(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  labels: string[],
): Promise<string[]> {
  const bySlug = new Map<string, string>();
  for (const label of labels) {
    const slug = slugify(label);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, label.trim());
  }

  const ids: string[] = [];
  for (const [slug, name] of bySlug) {
    const tag = await tx.tag.upsert({
      where: { workspaceId_slug: { workspaceId, slug } },
      update: {},
      create: { workspaceId, slug, name },
    });
    ids.push(tag.id);
  }
  return ids;
}

/**
 * Validate attribute inputs against their definitions and return canonical
 * rows to persist. Every referenced definition MUST belong to this workspace
 * (foreign definitions are rejected — a core isolation guarantee). Empty values
 * are skipped (i.e. the attribute is left unset / cleared).
 */
async function resolveAttributeValues(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  inputs: EntityAttributeInput[],
): Promise<{ attributeDefinitionId: string; value: string }[]> {
  if (inputs.length === 0) return [];

  const ids = [...new Set(inputs.map((i) => i.attributeDefinitionId))];
  const defs = await tx.attributeDefinition.findMany({ where: { id: { in: ids }, workspaceId } });
  const defById = new Map(defs.map((d) => [d.id, d]));

  const issues: FieldIssue[] = [];
  const seen = new Set<string>();
  const out: { attributeDefinitionId: string; value: string }[] = [];

  inputs.forEach((input, index) => {
    const def = defById.get(input.attributeDefinitionId);
    if (!def) {
      issues.push({ path: `attributes.${index}.attributeDefinitionId`, message: "Unknown attribute for this workspace." });
      return;
    }
    if (isEmptyValue(input.value)) return; // clearing / unset
    if (seen.has(def.id)) {
      issues.push({ path: `attributes.${index}`, message: "This attribute is assigned more than once." });
      return;
    }

    const result = coerceAttributeValue(
      {
        dataType: def.dataType as AttributeDataType,
        minimum: def.minimum,
        maximum: def.maximum,
        options: parseAttributeOptions(def.options),
      },
      input.value,
    );
    if (!result.ok) {
      issues.push({ path: `attributes.${index}.value`, message: `${def.name}: ${result.message}` });
      return;
    }

    seen.add(def.id);
    out.push({ attributeDefinitionId: def.id, value: result.value });
  });

  if (issues.length > 0) throw new ValidationError("Some attribute values are invalid.", issues);
  return out;
}

function serializeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const json = JSON.stringify(metadata);
  if (json.length > METADATA_MAX) {
    throw new ValidationError("Additional info is too large.", [
      { path: "metadata", message: "Additional info is too large." },
    ]);
  }
  return json;
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}
