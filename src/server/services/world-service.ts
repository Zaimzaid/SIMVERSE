import { createHash } from "node:crypto";
import type { Prisma, WorldVersion } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  WORLD_MAX_PAGE_SIZE, WORLD_PAGE_SIZE, canTransitionWorldStatus, isWorldStatus,
  type WorldBiome, type WorldSort, type WorldStatus, type WorldStatusFilter, type WorldVisibility,
} from "@/lib/worlds/constants";
import {
  createWorldSchema, updateWorldSchema, worldAssetAssociationSchema, worldBlueprintSchema,
  worldEntityAssociationSchema, worldRunSnapshotSchema, type CreateWorldInput,
  type WorldAssetAssociation, type WorldBlueprintV1, type WorldEntityAssociation,
} from "@/lib/worlds/schemas";
import { parseOrThrow } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

type WorldSnapshotInput = Omit<CreateWorldInput, "status"> & { status: WorldStatus };

export interface WorldAssetView extends WorldAssetAssociation {
  assetName: string;
  assetType: string;
}

export interface WorldEntityView extends WorldEntityAssociation {
  entityName: string;
  entityCategory: string;
}

export interface WorldVersionView {
  id: string; worldId: string; version: number; blueprintVersion: 1;
  name: string; description: string | null; category: string; status: WorldStatus;
  tags: string[]; biome: WorldBiome; customBiome?: string; thumbnailReference?: string;
  visibility: WorldVisibility; blueprint: WorldBlueprintV1;
  assetAssociations: WorldAssetAssociation[]; entityAssociations: WorldEntityAssociation[];
  contentHash: string; changeNote?: string; createdByName: string | null; createdAt: Date;
}

export interface WorldView {
  id: string; workspaceId: string; name: string; slug: string; description: string | null;
  category: string; status: WorldStatus; currentVersion: number;
  archivedFromStatus: WorldStatus | null; biome: WorldBiome; thumbnailReference: string | null;
  visibility: WorldVisibility; tags: { id: string; name: string; slug: string }[];
  assets: WorldAssetView[]; entities: WorldEntityView[]; version: WorldVersionView;
  createdByName: string | null; createdAt: Date; updatedAt: Date; archivedAt: Date | null;
}

export interface ListWorldsParams {
  search?: string; biome?: WorldBiome; category?: string; status?: WorldStatusFilter;
  tag?: string; sort?: WorldSort; page?: number; pageSize?: number;
}
export interface ListWorldsResult {
  items: WorldView[]; total: number; page: number; pageSize: number; pageCount: number;
}

const worldInclude = {
  createdBy: { select: { displayName: true } },
  versions: { include: { createdBy: { select: { displayName: true } } }, orderBy: { version: "desc" as const }, take: 1 },
  worldTags: { include: { tag: true } },
  assetLinks: { include: { asset: { select: { name: true, type: true } } } },
  entityLinks: { include: { entity: { select: { name: true, category: true } } } },
} satisfies Prisma.WorldInclude;
type WorldWithRelations = Prisma.WorldGetPayload<{ include: typeof worldInclude }>;

function storedStatus(value: string): WorldStatus {
  if (!isWorldStatus(value)) throw new ValidationError("Stored World status is invalid.");
  return value;
}
function storedBiome(value: string): WorldBiome {
  const result = createWorldSchema.shape.biome.safeParse(value);
  if (!result.success) throw new ValidationError("Stored World biome is invalid.");
  return result.data;
}
function storedVisibility(value: string): WorldVisibility {
  if (value !== "PRIVATE" && value !== "WORKSPACE") throw new ValidationError("Stored World visibility is invalid.");
  return value;
}
function parseJson<T>(value: string, schema: { parse(input: unknown): T }, label: string): T {
  try { return schema.parse(JSON.parse(value)); }
  catch { throw new ValidationError(`Stored World ${label} is invalid.`); }
}
const stringArraySchema = { parse(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error("invalid");
  return value;
} };

function toVersionView(row: WorldVersion & { createdBy: { displayName: string } | null }): WorldVersionView {
  const blueprint = parseJson(row.blueprint, worldBlueprintSchema, "blueprint");
  const customBiome = typeof blueprint.presentation.metadata.customBiome === "string"
    ? blueprint.presentation.metadata.customBiome : undefined;
  return {
    id: row.id, worldId: row.worldId, version: row.version, blueprintVersion: 1,
    name: row.name, description: row.description, category: row.category,
    status: storedStatus(row.status), tags: parseJson(row.tags, stringArraySchema, "tags"),
    biome: storedBiome(row.biome), customBiome, thumbnailReference: row.thumbnailReference ?? undefined,
    visibility: storedVisibility(row.visibility), blueprint,
    assetAssociations: parseJson(row.assetAssociations, worldAssetAssociationSchema.array(), "Asset associations"),
    entityAssociations: parseJson(row.entityAssociations, worldEntityAssociationSchema.array(), "Entity associations"),
    contentHash: row.contentHash, changeNote: row.changeNote ?? undefined,
    createdByName: row.createdBy?.displayName ?? null, createdAt: row.createdAt,
  };
}

function toWorldView(row: WorldWithRelations): WorldView {
  const versionRow = row.versions[0];
  if (!versionRow || versionRow.version !== row.currentVersion) throw new ValidationError("The World current version is unavailable.");
  const version = toVersionView(versionRow);
  const associationById = new Map(version.assetAssociations.map((association) => [association.identifier, association]));
  const entityByKey = new Map(version.entityAssociations.map((association) => [`${association.entityId}:${association.relationship}`, association]));
  return {
    id: row.id, workspaceId: row.workspaceId, name: row.name, slug: row.slug,
    description: row.description, category: row.category, status: storedStatus(row.status),
    currentVersion: row.currentVersion,
    archivedFromStatus: row.archivedFromStatus && isWorldStatus(row.archivedFromStatus) ? row.archivedFromStatus : null,
    biome: storedBiome(row.biome), thumbnailReference: row.thumbnailReference,
    visibility: storedVisibility(row.visibility),
    tags: row.worldTags.map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug })).sort((a, b) => a.name.localeCompare(b.name)),
    assets: row.assetLinks.map((link) => ({
      ...(associationById.get(link.identifier) ?? { identifier: link.identifier, assetId: link.assetId, assetVersion: link.assetVersion, role: link.role as WorldAssetAssociation["role"], placementGroup: undefined, category: undefined, configuration: {} }),
      assetName: link.asset.name, assetType: link.asset.type,
    })).sort((a, b) => a.identifier.localeCompare(b.identifier)),
    entities: row.entityLinks.map((link) => ({
      ...(entityByKey.get(`${link.entityId}:${link.relationship}`) ?? { entityId: link.entityId, relationship: link.relationship as WorldEntityAssociation["relationship"], configuration: {} }),
      entityName: link.entity.name, entityCategory: link.entity.category,
    })).sort((a, b) => a.entityName.localeCompare(b.entityName)),
    version, createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt, archivedAt: row.archivedAt,
  };
}

function orderByForSort(sort: WorldSort): Prisma.WorldOrderByWithRelationInput[] {
  if (sort === "updated_asc") return [{ updatedAt: "asc" }, { id: "asc" }];
  if (sort === "name_asc") return [{ name: "asc" }, { id: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }, { id: "asc" }];
  return [{ updatedAt: "desc" }, { id: "asc" }];
}

export async function listWorlds(userId: string, workspaceId: string, params: ListWorldsParams = {}): Promise<ListWorldsResult> {
  await requireMembership(userId, workspaceId, "world.view");
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(WORLD_MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? WORLD_PAGE_SIZE)));
  const where: Prisma.WorldWhereInput = { workspaceId };
  const status = params.status ?? "CURRENT";
  if (status === "CURRENT") where.status = { not: "ARCHIVED" };
  else if (status !== "ALL") where.status = status;
  if (params.biome) where.biome = params.biome;
  if (params.category) where.category = slugify(params.category);
  if (params.tag) where.worldTags = { some: { tag: { slug: slugify(params.tag) } } };
  const search = params.search?.trim();
  if (search) where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
  const [total, rows] = await Promise.all([
    prisma.world.count({ where }),
    prisma.world.findMany({ where, include: worldInclude, orderBy: orderByForSort(params.sort ?? "updated_desc"), skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items: rows.map(toWorldView), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getWorld(userId: string, workspaceId: string, worldId: string): Promise<WorldView> {
  await requireMembership(userId, workspaceId, "world.view");
  const row = await prisma.world.findFirst({ where: { id: worldId, workspaceId }, include: worldInclude });
  if (!row) throw new NotFoundError("World not found.");
  return toWorldView(row);
}

export async function listWorldVersions(userId: string, workspaceId: string, worldId: string): Promise<WorldVersionView[]> {
  await requireMembership(userId, workspaceId, "world.view");
  const world = await prisma.world.findFirst({ where: { id: worldId, workspaceId }, select: { id: true } });
  if (!world) throw new NotFoundError("World not found.");
  const rows = await prisma.worldVersion.findMany({ where: { worldId }, include: { createdBy: { select: { displayName: true } } }, orderBy: { version: "desc" } });
  return rows.map(toVersionView);
}

export async function getWorldVersion(userId: string, workspaceId: string, worldId: string, version: number): Promise<WorldVersionView> {
  await requireMembership(userId, workspaceId, "world.view");
  const row = await prisma.worldVersion.findFirst({ where: { worldId, version, world: { workspaceId } }, include: { createdBy: { select: { displayName: true } } } });
  if (!row) throw new NotFoundError("World version not found.");
  return toVersionView(row);
}

export async function listWorldTags(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "world.view");
  return prisma.tag.findMany({ where: { workspaceId, worldTags: { some: {} } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
}

export async function listWorldBindingOptions(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "world.view");
  const rows = await prisma.world.findMany({
    where: { workspaceId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, biome: true, currentVersion: true,
      versions: { select: { version: true, status: true, createdAt: true }, orderBy: { version: "desc" } } },
    orderBy: { name: "asc" },
  });
  return rows.flatMap((world) => world.versions.map((version) => ({
    worldId: world.id, worldName: world.name, biome: storedBiome(world.biome),
    version: version.version, status: storedStatus(version.status), current: version.version === world.currentVersion,
    createdAt: version.createdAt,
  })));
}

function uniqueTags(tags: string[]) {
  const bySlug = new Map<string, string>();
  for (const name of tags) { const slug = slugify(name); if (slug && !bySlug.has(slug)) bySlug.set(slug, name.trim()); }
  return [...bySlug].map(([slug, name]) => ({ slug, name }));
}

async function availableSlug(tx: Prisma.TransactionClient, workspaceId: string, name: string, worldId?: string) {
  const base = slugify(name) || "world"; let candidate = base; let suffix = 2;
  while (await tx.world.findFirst({ where: { workspaceId, slug: candidate, ...(worldId ? { id: { not: worldId } } : {}) }, select: { id: true } })) candidate = `${base}-${suffix++}`;
  return candidate;
}

async function validateReferences(tx: Prisma.TransactionClient, workspaceId: string, data: WorldSnapshotInput) {
  const assetIds = [...new Set(data.assetAssociations.map((item) => item.assetId))];
  if (assetIds.length) {
    const assets = await tx.asset.findMany({ where: { workspaceId, id: { in: assetIds } }, select: { id: true, type: true, status: true, versions: { select: { version: true } } } });
    if (assets.length !== assetIds.length) throw new ValidationError("Every associated Asset must belong to this workspace.");
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    for (const association of data.assetAssociations) {
      const asset = byId.get(association.assetId);
      if (!asset || asset.status === "ARCHIVED") throw new ValidationError("Archived Assets cannot be added to a World.");
      if (!asset.versions.some((version) => version.version === association.assetVersion)) throw new ValidationError(`Asset placement “${association.identifier}” references a missing version.`);
      if (association.role.startsWith("AUDIO_") && asset.type !== "AUDIO") throw new ValidationError(`Audio placement “${association.identifier}” must reference an Audio Asset.`);
    }
  }
  const entityIds = [...new Set(data.entityAssociations.map((item) => item.entityId))];
  if (entityIds.length) {
    const entities = await tx.entity.findMany({ where: { workspaceId, id: { in: entityIds } }, select: { id: true, status: true } });
    if (entities.length !== entityIds.length) throw new ValidationError("Every associated Entity must belong to this workspace.");
    if (entities.some((entity) => entity.status === "ARCHIVED")) throw new ValidationError("Archived Entities cannot be added to a World.");
  }
}

function versionPayload(data: WorldSnapshotInput) {
  const blueprint = data.customBiome
    ? { ...data.blueprint, presentation: { ...data.blueprint.presentation, metadata: { ...data.blueprint.presentation.metadata, customBiome: data.customBiome } } }
    : data.blueprint;
  return {
    name: data.name, description: data.description ?? null, category: data.category, status: data.status,
    tags: uniqueTags(data.tags).map((item) => item.name), biome: data.biome,
    thumbnailReference: data.thumbnailReference ?? null, visibility: data.visibility,
    blueprint, assetAssociations: data.assetAssociations, entityAssociations: data.entityAssociations,
  };
}

function canonicalJson(value: unknown): string {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      );
    }
    return item;
  };
  return JSON.stringify(canonicalize(value));
}

function versionData(worldId: string, version: number, data: WorldSnapshotInput, userId: string) {
  const payload = versionPayload(data); const serialized = canonicalJson(payload);
  return {
    worldId, version, blueprintVersion: 1, name: payload.name, description: payload.description,
    category: payload.category, status: payload.status, tags: JSON.stringify(payload.tags), biome: payload.biome,
    thumbnailReference: payload.thumbnailReference, visibility: payload.visibility,
    blueprint: JSON.stringify(payload.blueprint), assetAssociations: JSON.stringify(payload.assetAssociations),
    entityAssociations: JSON.stringify(payload.entityAssociations),
    contentHash: `sha256:${createHash("sha256").update(serialized).digest("hex")}`,
    changeNote: data.changeNote ?? null, createdById: userId,
  };
}

async function replaceRelations(tx: Prisma.TransactionClient, workspaceId: string, worldId: string, data: WorldSnapshotInput) {
  await tx.worldTag.deleteMany({ where: { worldId } });
  for (const tag of uniqueTags(data.tags)) {
    const row = await tx.tag.upsert({ where: { workspaceId_slug: { workspaceId, slug: tag.slug } }, create: { workspaceId, name: tag.name, slug: tag.slug }, update: {} });
    await tx.worldTag.create({ data: { worldId, tagId: row.id } });
  }
  await tx.worldAsset.deleteMany({ where: { worldId } });
  if (data.assetAssociations.length) await tx.worldAsset.createMany({ data: data.assetAssociations.map((association) => ({
    worldId, identifier: association.identifier, assetId: association.assetId, assetVersion: association.assetVersion,
    role: association.role, placement: association.placement ? JSON.stringify({ ...association.placement, placementGroup: association.placementGroup, category: association.category }) : null,
    configuration: JSON.stringify(association.configuration),
  })) });
  await tx.worldEntity.deleteMany({ where: { worldId } });
  if (data.entityAssociations.length) await tx.worldEntity.createMany({ data: data.entityAssociations.map((association) => ({
    worldId, entityId: association.entityId, relationship: association.relationship,
    configuration: JSON.stringify(association.configuration),
  })) });
}

export async function createWorld(userId: string, workspaceId: string, input: unknown): Promise<WorldView> {
  await requireMembership(userId, workspaceId, "world.manage");
  const data = parseOrThrow(createWorldSchema, input, "The World Blueprint is invalid.");
  const created = await prisma.$transaction(async (tx) => {
    await validateReferences(tx, workspaceId, data);
    const world = await tx.world.create({ data: {
      workspaceId, name: data.name, slug: await availableSlug(tx, workspaceId, data.name),
      description: data.description ?? null, category: data.category, status: data.status, biome: data.biome,
      thumbnailReference: data.thumbnailReference ?? null, visibility: data.visibility, createdById: userId,
    } });
    await tx.worldVersion.create({ data: versionData(world.id, 1, data, userId) });
    await replaceRelations(tx, workspaceId, world.id, data);
    return world;
  });
  await recordAudit({ action: "world.created", actorUserId: userId, workspaceId, entityType: "World", entityId: created.id, metadata: { name: data.name, biome: data.biome, version: 1 } });
  return getWorld(userId, workspaceId, created.id);
}

function versionToInput(world: WorldView): CreateWorldInput {
  return {
    name: world.version.name, description: world.version.description ?? undefined, category: world.version.category,
    status: world.status === "ARCHIVED" ? (world.archivedFromStatus && world.archivedFromStatus !== "ARCHIVED" ? world.archivedFromStatus : "DRAFT") : world.status,
    tags: world.version.tags, biome: world.version.biome, customBiome: world.version.customBiome,
    thumbnailReference: world.version.thumbnailReference, visibility: world.version.visibility,
    blueprint: world.version.blueprint, assetAssociations: world.version.assetAssociations,
    entityAssociations: world.version.entityAssociations, changeNote: undefined,
  };
}

async function appendVersion(userId: string, workspaceId: string, world: WorldView, data: WorldSnapshotInput,
  options: { archivedAt?: Date | null; archivedFromStatus?: WorldStatus | null } = {}) {
  const nextVersion = world.currentVersion + 1;
  await prisma.$transaction(async (tx) => {
    await validateReferences(tx, workspaceId, data);
    await tx.world.update({ where: { id: world.id }, data: {
      name: data.name, slug: await availableSlug(tx, workspaceId, data.name, world.id), description: data.description ?? null,
      category: data.category, status: data.status, currentVersion: nextVersion, biome: data.biome,
      thumbnailReference: data.thumbnailReference ?? null, visibility: data.visibility,
      ...(options.archivedAt !== undefined ? { archivedAt: options.archivedAt } : {}),
      ...(options.archivedFromStatus !== undefined ? { archivedFromStatus: options.archivedFromStatus } : {}),
    } });
    await tx.worldVersion.create({ data: versionData(world.id, nextVersion, data, userId) });
    await replaceRelations(tx, workspaceId, world.id, data);
  });
  return nextVersion;
}

export async function updateWorld(userId: string, workspaceId: string, worldId: string, input: unknown): Promise<WorldView> {
  await requireMembership(userId, workspaceId, "world.manage");
  const current = await getWorld(userId, workspaceId, worldId);
  if (current.status === "ARCHIVED") throw new ValidationError("Restore this World before editing it.");
  const patch = parseOrThrow(updateWorldSchema, input, "The World update is invalid.");
  const suppliedKeys = input && typeof input === "object" && !Array.isArray(input) ? new Set(Object.keys(input)) : new Set<string>();
  const explicitPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => suppliedKeys.has(key)));
  const data = parseOrThrow(createWorldSchema, { ...versionToInput(current), ...explicitPatch }, "The World update is invalid.");
  if (!canTransitionWorldStatus(current.status, data.status)) throw new ValidationError(`World status cannot move from ${current.status} to ${data.status}.`);
  const nextVersion = await appendVersion(userId, workspaceId, current, data);
  await recordAudit({ action: "world.updated", actorUserId: userId, workspaceId, entityType: "World", entityId: worldId, metadata: { version: nextVersion, status: data.status } });
  return getWorld(userId, workspaceId, worldId);
}

export async function archiveWorld(userId: string, workspaceId: string, worldId: string): Promise<WorldView> {
  await requireMembership(userId, workspaceId, "world.manage");
  const current = await getWorld(userId, workspaceId, worldId); if (current.status === "ARCHIVED") return current;
  const data: WorldSnapshotInput = { ...versionToInput(current), status: "ARCHIVED", changeNote: "Archived" };
  const version = await appendVersion(userId, workspaceId, current, data, { archivedAt: new Date(), archivedFromStatus: current.status });
  await recordAudit({ action: "world.archived", actorUserId: userId, workspaceId, entityType: "World", entityId: worldId, metadata: { version } });
  return getWorld(userId, workspaceId, worldId);
}

export async function restoreWorld(userId: string, workspaceId: string, worldId: string): Promise<WorldView> {
  await requireMembership(userId, workspaceId, "world.manage");
  const current = await getWorld(userId, workspaceId, worldId); if (current.status !== "ARCHIVED") return current;
  const status = current.archivedFromStatus && current.archivedFromStatus !== "ARCHIVED" ? current.archivedFromStatus : "DRAFT";
  const data = parseOrThrow(createWorldSchema, { ...versionToInput(current), status, changeNote: "Restored" }, "The archived World cannot be restored.");
  const version = await appendVersion(userId, workspaceId, current, data, { archivedAt: null, archivedFromStatus: null });
  await recordAudit({ action: "world.restored", actorUserId: userId, workspaceId, entityType: "World", entityId: worldId, metadata: { version, status } });
  return getWorld(userId, workspaceId, worldId);
}

/** Permanently remove an archived World when no Simulation still pins it. */
export async function deleteWorld(userId: string, workspaceId: string, worldId: string): Promise<{ id: string }> {
  await requireMembership(userId, workspaceId, "world.manage");
  const world = await prisma.world.findFirst({ where: { id: worldId, workspaceId }, select: { id: true, status: true, name: true, _count: { select: { simulations: true } } } });
  if (!world) throw new NotFoundError("World not found.");
  if (world.status !== "ARCHIVED") throw new ConflictError("Archive this World before deleting it permanently.");
  if (world._count.simulations > 0) throw new ConflictError("This World is still referenced by one or more Simulations.");
  await prisma.world.delete({ where: { id: world.id } });
  await recordAudit({ action: "world.deleted", actorUserId: userId, workspaceId, entityType: "World", entityId: world.id, metadata: { name: world.name } });
  return { id: world.id };
}

/** Internal execution helper: load only the already-pinned immutable version. */
export async function loadWorldRunSnapshot(tx: Prisma.TransactionClient, workspaceId: string, worldId: string, version: number) {
  const row = await tx.worldVersion.findFirst({ where: { worldId, version, world: { workspaceId } } });
  if (!row) throw new ValidationError("The selected World version is unavailable for execution.");
  const world = await tx.world.findFirst({ where: { id: worldId, workspaceId }, select: { status: true } });
  if (!world || world.status === "ARCHIVED") throw new ValidationError("The selected World is archived or unavailable for execution.");
  return worldRunSnapshotSchema.parse({
    snapshotVersion: 1, worldId, version, contentHash: row.contentHash, name: row.name,
    category: row.category, biome: row.biome, thumbnailReference: row.thumbnailReference,
    blueprint: JSON.parse(row.blueprint), assetAssociations: JSON.parse(row.assetAssociations),
    entityAssociations: JSON.parse(row.entityAssociations),
  });
}
