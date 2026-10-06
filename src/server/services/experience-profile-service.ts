import { createHash } from "node:crypto";
import type { ExperienceProfileVersion, Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  EXPERIENCE_MAX_PAGE_SIZE, EXPERIENCE_PAGE_SIZE, canTransitionExperienceStatus,
  isExperienceProfileStatus, type ExperiencePresetType, type ExperienceProfileStatus,
  type ExperienceProfileStatusFilter, type ExperienceSort,
} from "@/lib/experiences/constants";
import {
  createExperienceProfileSchema, experienceDefinitionSchema, experienceRunSnapshotSchema,
  updateExperienceProfileSchema, type CreateExperienceProfileInput, type ExperienceAssetAssociation,
  type ExperienceDefinitionV1, type ExperienceWorldAssociation,
} from "@/lib/experiences/schemas";
import { worldBlueprintSchema } from "@/lib/worlds/schemas";
import { parseOrThrow } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

type SnapshotInput = Omit<CreateExperienceProfileInput, "status"> & { status: ExperienceProfileStatus };

export interface ExperienceAssetView extends ExperienceAssetAssociation {
  assetName: string;
  assetType: string;
}
export interface ExperienceEntityView { entityId: string; entityName: string; entityCategory: string }
export interface ExperienceWorldView extends ExperienceWorldAssociation { worldName: string }

export interface ExperienceProfileVersionView {
  id: string; experienceProfileId: string; version: number; schemaVersion: 1;
  name: string; description: string | null; status: ExperienceProfileStatus; tags: string[];
  preset: ExperiencePresetType; moduleCompatibility: string[]; modeCompatibility: string[];
  thumbnailReference?: string; definition: ExperienceDefinitionV1; contentHash: string;
  changeNote?: string; createdByName: string | null; createdAt: Date;
}

export interface ExperienceProfileView {
  id: string; workspaceId: string; name: string; slug: string; description: string | null;
  status: ExperienceProfileStatus; currentVersion: number; archivedFromStatus: ExperienceProfileStatus | null;
  preset: ExperiencePresetType; moduleCompatibility: string[]; modeCompatibility: string[];
  thumbnailReference: string | null; tags: { id: string; name: string; slug: string }[];
  assets: ExperienceAssetView[]; entities: ExperienceEntityView[]; worlds: ExperienceWorldView[];
  version: ExperienceProfileVersionView; createdByName: string | null;
  createdAt: Date; updatedAt: Date; archivedAt: Date | null;
}

export interface ListExperienceProfilesParams {
  search?: string; preset?: ExperiencePresetType; module?: string; mode?: string;
  status?: ExperienceProfileStatusFilter; tag?: string; sort?: ExperienceSort; page?: number; pageSize?: number;
}
export interface ListExperienceProfilesResult {
  items: ExperienceProfileView[]; total: number; page: number; pageSize: number; pageCount: number;
}

const experienceInclude = {
  createdBy: { select: { displayName: true } },
  versions: { include: { createdBy: { select: { displayName: true } } }, orderBy: { version: "desc" as const }, take: 1 },
  profileTags: { include: { tag: true } },
  eventBindings: true,
  assetLinks: { include: { asset: { select: { name: true, type: true } } } },
  entityLinks: { include: { entity: { select: { name: true, category: true } } } },
  worldLinks: { include: { world: { select: { name: true } } } },
} satisfies Prisma.ExperienceProfileInclude;
type ExperienceWithRelations = Prisma.ExperienceProfileGetPayload<{ include: typeof experienceInclude }>;

function storedStatus(value: string): ExperienceProfileStatus {
  if (!isExperienceProfileStatus(value)) throw new ValidationError("Stored Experience Profile status is invalid.");
  return value;
}
function storedPreset(value: string): ExperiencePresetType {
  const result = createExperienceProfileSchema.shape.definition.shape.preset.safeParse(value);
  if (!result.success) throw new ValidationError("Stored Experience Profile preset is invalid.");
  return result.data;
}
function parseJson<T>(value: string, schema: { parse(input: unknown): T }, label: string): T {
  try { return schema.parse(JSON.parse(value)); }
  catch { throw new ValidationError(`Stored Experience Profile ${label} is invalid.`); }
}
const stringArraySchema = { parse(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error("invalid");
  return value;
} };

function toVersionView(row: ExperienceProfileVersion & { createdBy: { displayName: string } | null }): ExperienceProfileVersionView {
  return {
    id: row.id, experienceProfileId: row.experienceProfileId, version: row.version, schemaVersion: 1,
    name: row.name, description: row.description, status: storedStatus(row.status),
    tags: parseJson(row.tags, stringArraySchema, "tags"), preset: storedPreset(row.preset),
    moduleCompatibility: parseJson(row.moduleCompatibility, stringArraySchema, "module compatibility"),
    modeCompatibility: parseJson(row.modeCompatibility, stringArraySchema, "mode compatibility"),
    thumbnailReference: row.thumbnailReference ?? undefined,
    definition: parseJson(row.definition, experienceDefinitionSchema, "definition"),
    contentHash: row.contentHash, changeNote: row.changeNote ?? undefined,
    createdByName: row.createdBy?.displayName ?? null, createdAt: row.createdAt,
  };
}

function toView(row: ExperienceWithRelations): ExperienceProfileView {
  const versionRow = row.versions[0];
  if (!versionRow || versionRow.version !== row.currentVersion) throw new ValidationError("The Experience Profile current version is unavailable.");
  const version = toVersionView(versionRow);
  const assetsById = new Map(version.definition.assetAssociations.map((item) => [item.identifier, item]));
  const worldsById = new Map(version.definition.worldAssociations.map((item) => [`${item.worldId}:${item.worldVersion}`, item]));
  return {
    id: row.id, workspaceId: row.workspaceId, name: row.name, slug: row.slug, description: row.description,
    status: storedStatus(row.status), currentVersion: row.currentVersion,
    archivedFromStatus: row.archivedFromStatus && isExperienceProfileStatus(row.archivedFromStatus) ? row.archivedFromStatus : null,
    preset: storedPreset(row.preset), moduleCompatibility: parseJson(row.moduleCompatibility, stringArraySchema, "module compatibility"),
    modeCompatibility: parseJson(row.modeCompatibility, stringArraySchema, "mode compatibility"),
    thumbnailReference: row.thumbnailReference,
    tags: row.profileTags.map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug })).sort((a, b) => a.name.localeCompare(b.name)),
    assets: row.assetLinks.map((link) => ({
      ...(assetsById.get(link.identifier) ?? { identifier: link.identifier, assetId: link.assetId, assetVersion: link.assetVersion, role: link.role as ExperienceAssetAssociation["role"] }),
      assetName: link.asset.name, assetType: link.asset.type,
    })).sort((a, b) => a.identifier.localeCompare(b.identifier)),
    entities: row.entityLinks.map((link) => ({ entityId: link.entityId, entityName: link.entity.name, entityCategory: link.entity.category })).sort((a, b) => a.entityName.localeCompare(b.entityName)),
    worlds: row.worldLinks.map((link) => ({
      ...(worldsById.get(`${link.worldId}:${link.worldVersion}`) ?? { worldId: link.worldId, worldVersion: link.worldVersion, preferredCameraZone: undefined, resultZonePreference: undefined, vfxSurfaceResponseCategory: undefined, ambientIntensity: 0.5, lightingCue: undefined, weatherPresentationCue: undefined }),
      worldName: link.world.name,
    })).sort((a, b) => a.worldName.localeCompare(b.worldName)),
    version, createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt, archivedAt: row.archivedAt,
  };
}

function orderByForSort(sort: ExperienceSort): Prisma.ExperienceProfileOrderByWithRelationInput[] {
  if (sort === "updated_asc") return [{ updatedAt: "asc" }, { id: "asc" }];
  if (sort === "name_asc") return [{ name: "asc" }, { id: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }, { id: "asc" }];
  return [{ updatedAt: "desc" }, { id: "asc" }];
}

export async function listExperienceProfiles(userId: string, workspaceId: string, params: ListExperienceProfilesParams = {}): Promise<ListExperienceProfilesResult> {
  await requireMembership(userId, workspaceId, "experience.view");
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(EXPERIENCE_MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? EXPERIENCE_PAGE_SIZE)));
  const where: Prisma.ExperienceProfileWhereInput = { workspaceId };
  const status = params.status ?? "CURRENT";
  if (status === "CURRENT") where.status = { not: "ARCHIVED" }; else if (status !== "ALL") where.status = status;
  if (params.preset) where.preset = params.preset;
  if (params.module) where.moduleCompatibility = { contains: JSON.stringify(params.module) };
  if (params.mode) where.modeCompatibility = { contains: JSON.stringify(params.mode) };
  if (params.tag) where.profileTags = { some: { tag: { slug: slugify(params.tag) } } };
  const search = params.search?.trim(); if (search) where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
  const [total, rows] = await Promise.all([
    prisma.experienceProfile.count({ where }),
    prisma.experienceProfile.findMany({ where, include: experienceInclude, orderBy: orderByForSort(params.sort ?? "updated_desc"), skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items: rows.map(toView), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getExperienceProfile(userId: string, workspaceId: string, experienceProfileId: string) {
  await requireMembership(userId, workspaceId, "experience.view");
  const row = await prisma.experienceProfile.findFirst({ where: { id: experienceProfileId, workspaceId }, include: experienceInclude });
  if (!row) throw new NotFoundError("Experience Profile not found.");
  return toView(row);
}

export async function listExperienceProfileVersions(userId: string, workspaceId: string, experienceProfileId: string) {
  await requireMembership(userId, workspaceId, "experience.view");
  const profile = await prisma.experienceProfile.findFirst({ where: { id: experienceProfileId, workspaceId }, select: { id: true } });
  if (!profile) throw new NotFoundError("Experience Profile not found.");
  const rows = await prisma.experienceProfileVersion.findMany({ where: { experienceProfileId }, include: { createdBy: { select: { displayName: true } } }, orderBy: { version: "desc" } });
  return rows.map(toVersionView);
}

export async function listExperienceTags(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "experience.view");
  return prisma.tag.findMany({ where: { workspaceId, experienceProfileTags: { some: {} } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
}

export async function listExperienceBindingOptions(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "experience.view");
  const rows = await prisma.experienceProfile.findMany({
    where: { workspaceId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, preset: true, currentVersion: true,
      versions: { where: { status: { not: "ARCHIVED" } }, select: { version: true, status: true, modeCompatibility: true, createdAt: true }, orderBy: { version: "desc" } } },
    orderBy: { name: "asc" },
  });
  return rows.flatMap((profile) => profile.versions.map((version) => ({
    experienceProfileId: profile.id, experienceProfileName: profile.name, preset: storedPreset(profile.preset),
    version: version.version, status: storedStatus(version.status),
    modeCompatibility: parseJson(version.modeCompatibility, stringArraySchema, "mode compatibility"),
    current: version.version === profile.currentVersion, createdAt: version.createdAt,
  })));
}

function uniqueTags(tags: string[]) {
  const bySlug = new Map<string, string>();
  for (const name of tags) { const slug = slugify(name); if (slug && !bySlug.has(slug)) bySlug.set(slug, name.trim()); }
  return [...bySlug].map(([slug, name]) => ({ slug, name }));
}

async function availableSlug(tx: Prisma.TransactionClient, workspaceId: string, name: string, profileId?: string) {
  const base = slugify(name) || "experience"; let candidate = base; let suffix = 2;
  while (await tx.experienceProfile.findFirst({ where: { workspaceId, slug: candidate, ...(profileId ? { id: { not: profileId } } : {}) }, select: { id: true } })) candidate = `${base}-${suffix++}`;
  return candidate;
}

async function validateReferences(tx: Prisma.TransactionClient, workspaceId: string, definition: ExperienceDefinitionV1) {
  const assetIds = [...new Set(definition.assetAssociations.map((item) => item.assetId))];
  if (assetIds.length) {
    const assets = await tx.asset.findMany({ where: { workspaceId, id: { in: assetIds } }, select: { id: true, type: true, status: true, versions: { select: { version: true } } } });
    if (assets.length !== assetIds.length) throw new ValidationError("Every associated Asset must belong to this workspace.");
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    for (const association of definition.assetAssociations) {
      const asset = byId.get(association.assetId);
      if (!asset || asset.status === "ARCHIVED") throw new ValidationError("Archived Assets cannot be added to an Experience Profile.");
      if (!asset.versions.some((version) => version.version === association.assetVersion)) throw new ValidationError(`Asset cue “${association.identifier}” references a missing version.`);
      if (association.role === "AUDIO" && asset.type !== "AUDIO") throw new ValidationError(`Audio cue “${association.identifier}” must reference an Audio Asset.`);
      if (association.role === "VFX" && asset.type !== "VFX") throw new ValidationError(`VFX cue “${association.identifier}” must reference a VFX Asset.`);
    }
  }

  const entityIds = [...new Set(definition.eventBindings.flatMap((binding) => binding.override?.kind === "ENTITY" ? [binding.override.value] : []))];
  if (entityIds.length) {
    const entities = await tx.entity.findMany({ where: { workspaceId, id: { in: entityIds }, status: { not: "ARCHIVED" } }, select: { id: true } });
    if (entities.length !== entityIds.length) throw new ValidationError("Every Entity override must reference an active Entity in this workspace.");
  }

  const worldZones = new Set<string>();
  for (const association of definition.worldAssociations) {
    const version = await tx.worldVersion.findFirst({ where: { worldId: association.worldId, version: association.worldVersion, world: { workspaceId, status: { not: "ARCHIVED" } } }, select: { blueprint: true } });
    if (!version) throw new ValidationError("Every World interaction must reference an active World version in this workspace.");
    let blueprint; try { blueprint = worldBlueprintSchema.parse(JSON.parse(version.blueprint)); } catch { throw new ValidationError("A referenced World blueprint is invalid."); }
    const zones = new Map(blueprint.zones.map((zone) => [zone.identifier, zone.type]));
    for (const zone of [association.preferredCameraZone, association.resultZonePreference]) {
      if (zone && !zones.has(zone)) throw new ValidationError(`World presentation references unknown zone “${zone}”.`);
      if (zone) worldZones.add(zone);
    }
  }
  for (const binding of definition.eventBindings) {
    const zone = binding.camera?.worldCameraZonePreference;
    if (zone && !worldZones.has(zone)) throw new ValidationError(`Camera cue references unavailable World zone “${zone}”.`);
  }
}

function canonicalJson(value: unknown): string {
  const canonicalize = (item: unknown): unknown => Array.isArray(item) ? item.map(canonicalize)
    : item && typeof item === "object" ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, canonicalize(nested)])) : item;
  return JSON.stringify(canonicalize(value));
}

function versionPayload(data: SnapshotInput) {
  return {
    name: data.name, description: data.description ?? null, status: data.status,
    tags: uniqueTags(data.tags).map((item) => item.name), thumbnailReference: data.thumbnailReference ?? null,
    definition: data.definition,
  };
}

function versionData(experienceProfileId: string, version: number, data: SnapshotInput, userId: string) {
  const payload = versionPayload(data);
  return {
    experienceProfileId, version, schemaVersion: 1, name: payload.name, description: payload.description,
    status: payload.status, tags: JSON.stringify(payload.tags), preset: payload.definition.preset,
    moduleCompatibility: JSON.stringify(payload.definition.moduleCompatibility),
    modeCompatibility: JSON.stringify(payload.definition.simulationModeCompatibility),
    thumbnailReference: payload.thumbnailReference, definition: JSON.stringify(payload.definition),
    contentHash: `sha256:${createHash("sha256").update(canonicalJson(payload)).digest("hex")}`,
    changeNote: data.changeNote ?? null, createdById: userId,
  };
}

async function replaceRelations(tx: Prisma.TransactionClient, workspaceId: string, profileId: string, data: SnapshotInput) {
  await tx.experienceProfileTag.deleteMany({ where: { experienceProfileId: profileId } });
  for (const tag of uniqueTags(data.tags)) {
    const row = await tx.tag.upsert({ where: { workspaceId_slug: { workspaceId, slug: tag.slug } }, create: { workspaceId, name: tag.name, slug: tag.slug }, update: {} });
    await tx.experienceProfileTag.create({ data: { experienceProfileId: profileId, tagId: row.id } });
  }
  await tx.experienceEventBinding.deleteMany({ where: { experienceProfileId: profileId } });
  await tx.experienceEventBinding.createMany({ data: data.definition.eventBindings.map((binding) => ({ experienceProfileId: profileId, identifier: binding.identifier, eventType: binding.eventType, priority: binding.priority, binding: JSON.stringify(binding) })) });
  await tx.experienceAsset.deleteMany({ where: { experienceProfileId: profileId } });
  if (data.definition.assetAssociations.length) await tx.experienceAsset.createMany({ data: data.definition.assetAssociations.map((association) => ({ experienceProfileId: profileId, ...association })) });
  await tx.experienceEntity.deleteMany({ where: { experienceProfileId: profileId } });
  const entityIds = [...new Set(data.definition.eventBindings.flatMap((binding) => binding.override?.kind === "ENTITY" ? [binding.override.value] : []))];
  if (entityIds.length) await tx.experienceEntity.createMany({ data: entityIds.map((entityId) => ({ experienceProfileId: profileId, entityId })) });
  await tx.experienceWorld.deleteMany({ where: { experienceProfileId: profileId } });
  if (data.definition.worldAssociations.length) await tx.experienceWorld.createMany({ data: data.definition.worldAssociations.map((world) => ({ experienceProfileId: profileId, worldId: world.worldId, worldVersion: world.worldVersion })) });
}

export async function createExperienceProfile(userId: string, workspaceId: string, input: unknown): Promise<ExperienceProfileView> {
  await requireMembership(userId, workspaceId, "experience.manage");
  const data = parseOrThrow(createExperienceProfileSchema, input, "The Experience Profile is invalid.");
  const created = await prisma.$transaction(async (tx) => {
    await validateReferences(tx, workspaceId, data.definition);
    const profile = await tx.experienceProfile.create({ data: {
      workspaceId, name: data.name, slug: await availableSlug(tx, workspaceId, data.name), description: data.description ?? null,
      status: data.status, preset: data.definition.preset, moduleCompatibility: JSON.stringify(data.definition.moduleCompatibility),
      modeCompatibility: JSON.stringify(data.definition.simulationModeCompatibility), thumbnailReference: data.thumbnailReference ?? null, createdById: userId,
    } });
    await tx.experienceProfileVersion.create({ data: versionData(profile.id, 1, data, userId) });
    await replaceRelations(tx, workspaceId, profile.id, data);
    return profile;
  });
  await recordAudit({ action: "experience.created", actorUserId: userId, workspaceId, entityType: "ExperienceProfile", entityId: created.id, metadata: { name: data.name, preset: data.definition.preset, version: 1 } });
  return getExperienceProfile(userId, workspaceId, created.id);
}

function versionToInput(profile: ExperienceProfileView): CreateExperienceProfileInput {
  const status = profile.status === "ARCHIVED" ? (profile.archivedFromStatus && profile.archivedFromStatus !== "ARCHIVED" ? profile.archivedFromStatus : "DRAFT") : profile.status;
  return { name: profile.version.name, description: profile.version.description ?? undefined, status, tags: profile.version.tags, thumbnailReference: profile.version.thumbnailReference, definition: profile.version.definition, changeNote: undefined };
}

async function appendVersion(userId: string, workspaceId: string, profile: ExperienceProfileView, data: SnapshotInput,
  options: { archivedAt?: Date | null; archivedFromStatus?: ExperienceProfileStatus | null } = {}) {
  const nextVersion = profile.currentVersion + 1;
  await prisma.$transaction(async (tx) => {
    await validateReferences(tx, workspaceId, data.definition);
    await tx.experienceProfile.update({ where: { id: profile.id }, data: {
      name: data.name, slug: await availableSlug(tx, workspaceId, data.name, profile.id), description: data.description ?? null,
      status: data.status, currentVersion: nextVersion, preset: data.definition.preset,
      moduleCompatibility: JSON.stringify(data.definition.moduleCompatibility), modeCompatibility: JSON.stringify(data.definition.simulationModeCompatibility),
      thumbnailReference: data.thumbnailReference ?? null,
      ...(options.archivedAt !== undefined ? { archivedAt: options.archivedAt } : {}),
      ...(options.archivedFromStatus !== undefined ? { archivedFromStatus: options.archivedFromStatus } : {}),
    } });
    await tx.experienceProfileVersion.create({ data: versionData(profile.id, nextVersion, data, userId) });
    await replaceRelations(tx, workspaceId, profile.id, data);
  });
  return nextVersion;
}

export async function updateExperienceProfile(userId: string, workspaceId: string, profileId: string, input: unknown) {
  await requireMembership(userId, workspaceId, "experience.manage");
  const current = await getExperienceProfile(userId, workspaceId, profileId);
  if (current.status === "ARCHIVED") throw new ValidationError("Restore this Experience Profile before editing it.");
  const patch = parseOrThrow(updateExperienceProfileSchema, input, "The Experience Profile update is invalid.");
  const supplied = input && typeof input === "object" && !Array.isArray(input) ? new Set(Object.keys(input)) : new Set<string>();
  const explicit = Object.fromEntries(Object.entries(patch).filter(([key]) => supplied.has(key)));
  const data = parseOrThrow(createExperienceProfileSchema, { ...versionToInput(current), ...explicit }, "The Experience Profile update is invalid.");
  if (!canTransitionExperienceStatus(current.status, data.status)) throw new ValidationError(`Experience Profile status cannot move from ${current.status} to ${data.status}.`);
  const version = await appendVersion(userId, workspaceId, current, data);
  await recordAudit({ action: "experience.updated", actorUserId: userId, workspaceId, entityType: "ExperienceProfile", entityId: profileId, metadata: { name: data.name, version, status: data.status } });
  return getExperienceProfile(userId, workspaceId, profileId);
}

export async function archiveExperienceProfile(userId: string, workspaceId: string, profileId: string) {
  await requireMembership(userId, workspaceId, "experience.manage");
  const current = await getExperienceProfile(userId, workspaceId, profileId); if (current.status === "ARCHIVED") return current;
  const data: SnapshotInput = { ...versionToInput(current), status: "ARCHIVED", changeNote: "Archived" };
  const version = await appendVersion(userId, workspaceId, current, data, { archivedAt: new Date(), archivedFromStatus: current.status });
  await recordAudit({ action: "experience.archived", actorUserId: userId, workspaceId, entityType: "ExperienceProfile", entityId: profileId, metadata: { name: current.name, version } });
  return getExperienceProfile(userId, workspaceId, profileId);
}

export async function restoreExperienceProfile(userId: string, workspaceId: string, profileId: string) {
  await requireMembership(userId, workspaceId, "experience.manage");
  const current = await getExperienceProfile(userId, workspaceId, profileId); if (current.status !== "ARCHIVED") return current;
  const status = current.archivedFromStatus && current.archivedFromStatus !== "ARCHIVED" ? current.archivedFromStatus : "DRAFT";
  const data = parseOrThrow(createExperienceProfileSchema, { ...versionToInput(current), status, changeNote: "Restored" }, "The archived Experience Profile cannot be restored.");
  const version = await appendVersion(userId, workspaceId, current, data, { archivedAt: null, archivedFromStatus: null });
  await recordAudit({ action: "experience.restored", actorUserId: userId, workspaceId, entityType: "ExperienceProfile", entityId: profileId, metadata: { name: current.name, version, status } });
  return getExperienceProfile(userId, workspaceId, profileId);
}

export async function deleteExperienceProfile(userId: string, workspaceId: string, profileId: string) {
  await requireMembership(userId, workspaceId, "experience.manage");
  const profile = await prisma.experienceProfile.findFirst({ where: { id: profileId, workspaceId }, select: { id: true, status: true, name: true, _count: { select: { simulations: true } } } });
  if (!profile) throw new NotFoundError("Experience Profile not found.");
  if (profile.status !== "ARCHIVED") throw new ConflictError("Archive this Experience Profile before deleting it permanently.");
  if (profile._count.simulations > 0) throw new ConflictError("This Experience Profile is still referenced by one or more Simulations.");
  await prisma.experienceProfile.delete({ where: { id: profile.id } });
  await recordAudit({ action: "experience.deleted", actorUserId: userId, workspaceId, entityType: "ExperienceProfile", entityId: profile.id, metadata: { name: profile.name } });
  return { id: profile.id };
}

export async function loadExperienceRunSnapshot(tx: Prisma.TransactionClient, workspaceId: string, profileId: string, version: number) {
  const row = await tx.experienceProfileVersion.findFirst({ where: { experienceProfileId: profileId, version, experienceProfile: { workspaceId } } });
  if (!row) throw new ValidationError("The selected Experience Profile version is unavailable for execution.");
  const profile = await tx.experienceProfile.findFirst({ where: { id: profileId, workspaceId }, select: { status: true } });
  if (!profile || profile.status === "ARCHIVED" || row.status === "ARCHIVED") throw new ValidationError("The selected Experience Profile is archived or unavailable for execution.");
  return experienceRunSnapshotSchema.parse({
    snapshotVersion: 1, experienceProfileId: profileId, version, contentHash: row.contentHash,
    name: row.name, preset: row.preset, definition: JSON.parse(row.definition),
  });
}
