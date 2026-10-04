import type { AssetVersion, Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  ASSET_MAX_PAGE_SIZE, ASSET_PAGE_SIZE, canTransitionAssetStatus,
  isAssetStatus, isAssetType, type AssetSort, type AssetStatus,
  type AssetStatusFilter, type AssetType,
} from "@/lib/assets/constants";
import {
  animationSpecificationSchema, assetAuthorSchema, assetEntityAssociationSchema,
  assetLicenseSchema, assetProvenanceSchema, createAssetSchema,
  modelSpecificationSchema, productionChecklistItemSchema, rigSpecificationSchema,
  updateAssetSchema, type CreateAssetInput,
} from "@/lib/assets/schemas";
import { parseOrThrow } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

type Provenance = CreateAssetInput["provenance"];
type LicenseInfo = CreateAssetInput["licenseInfo"];
type AuthorInfo = CreateAssetInput["authorInfo"];
type ModelSpecification = CreateAssetInput["modelSpecification"];
type RigSpecification = CreateAssetInput["rigSpecification"];
type AnimationSpecification = CreateAssetInput["animationSpecification"];
type ProductionChecklist = CreateAssetInput["productionChecklist"];
type EntityAssociationInput = CreateAssetInput["entityAssociations"][number];
type TechnicalMetadata = CreateAssetInput["technicalMetadata"];
type AssetSnapshotInput = Omit<CreateAssetInput, "status"> & { status: AssetStatus };

export interface AssetEntityView {
  entityId: string; entityName: string; entityCategory: string; purpose: string; version: number;
}
export interface AssetLineageView { id: string; name: string; type: AssetType; relationship: string }

export interface AssetVersionView {
  id: string; assetId: string; version: number; name: string; description: string | null;
  type: AssetType; status: AssetStatus; tags: string[]; provenance: Provenance;
  licenseInfo?: LicenseInfo; authorInfo?: AuthorInfo; externalReference?: string;
  thumbnailReference?: string; technicalMetadata: TechnicalMetadata;
  modelSpecification?: ModelSpecification; rigSpecification?: RigSpecification;
  animationSpecification?: AnimationSpecification; productionChecklist: ProductionChecklist;
  entityAssociations: EntityAssociationInput[]; derivedFromAssetIds: string[];
  changeNote?: string; createdByName: string | null; createdAt: Date;
}

export interface AssetView {
  id: string; workspaceId: string; name: string; description: string | null;
  type: AssetType; status: AssetStatus; currentVersion: number;
  archivedFromStatus: AssetStatus | null;
  tags: { id: string; name: string; slug: string }[];
  entities: AssetEntityView[]; parents: AssetLineageView[]; derivedAssets: AssetLineageView[];
  version: AssetVersionView; createdByName: string | null; createdAt: Date;
  updatedAt: Date; archivedAt: Date | null;
}

export interface ListAssetsParams {
  search?: string; type?: AssetType; status?: AssetStatusFilter; tag?: string;
  entityId?: string; sort?: AssetSort; page?: number; pageSize?: number;
}
export interface ListAssetsResult {
  items: AssetView[]; total: number; page: number; pageSize: number; pageCount: number;
}

const assetInclude = {
  createdBy: { select: { displayName: true } },
  versions: { include: { createdBy: { select: { displayName: true } } }, orderBy: { version: "desc" as const }, take: 1 },
  assetTags: { include: { tag: true } },
  entityLinks: { include: { entity: { select: { name: true, category: true } } } },
  parentLinks: { include: { parentAsset: { select: { id: true, name: true, type: true } } } },
  derivedLinks: { include: { derivedAsset: { select: { id: true, name: true, type: true } } } },
} satisfies Prisma.AssetInclude;
type AssetWithRelations = Prisma.AssetGetPayload<{ include: typeof assetInclude }>;

function parseJson<T>(value: string | null, schema: { parse(input: unknown): T }, fallback?: T): T {
  if (value == null && fallback !== undefined) return fallback;
  try { return schema.parse(JSON.parse(value ?? "null")); }
  catch { throw new ValidationError("Stored Asset metadata is invalid."); }
}
const stringArraySchema = { parse(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error("invalid");
  return value;
} };
const jsonRecordSchema = { parse(value: unknown): TechnicalMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
  return value as TechnicalMetadata;
} };
function storedType(value: string): AssetType {
  if (!isAssetType(value)) throw new ValidationError("Stored Asset type is invalid.");
  return value;
}
function storedStatus(value: string): AssetStatus {
  if (!isAssetStatus(value)) throw new ValidationError("Stored Asset status is invalid.");
  return value;
}

function toVersionView(row: AssetVersion & { createdBy: { displayName: string } | null }): AssetVersionView {
  return {
    id: row.id, assetId: row.assetId, version: row.version, name: row.name,
    description: row.description, type: storedType(row.type), status: storedStatus(row.status),
    tags: parseJson(row.tags, stringArraySchema),
    provenance: parseJson(row.provenance, assetProvenanceSchema),
    licenseInfo: row.licenseInfo ? parseJson(row.licenseInfo, assetLicenseSchema) : undefined,
    authorInfo: row.authorInfo ? parseJson(row.authorInfo, assetAuthorSchema) : undefined,
    externalReference: row.externalReference ?? undefined,
    thumbnailReference: row.thumbnailReference ?? undefined,
    technicalMetadata: parseJson(row.technicalMetadata, jsonRecordSchema, {}),
    modelSpecification: row.modelSpecification ? parseJson(row.modelSpecification, modelSpecificationSchema) : undefined,
    rigSpecification: row.rigSpecification ? parseJson(row.rigSpecification, rigSpecificationSchema) : undefined,
    animationSpecification: row.animationSpecification ? parseJson(row.animationSpecification, animationSpecificationSchema) : undefined,
    productionChecklist: parseJson(row.productionChecklist, { parse(value: unknown) { return productionChecklistItemSchema.array().parse(value); } }),
    entityAssociations: parseJson(row.entityAssociations, { parse(value: unknown) { return assetEntityAssociationSchema.array().parse(value); } }),
    derivedFromAssetIds: parseJson(row.derivedFromAssetIds, stringArraySchema),
    changeNote: row.changeNote ?? undefined, createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt,
  };
}

function toAssetView(row: AssetWithRelations): AssetView {
  const version = row.versions[0];
  if (!version || version.version !== row.currentVersion) throw new ValidationError("The Asset current version is unavailable.");
  return {
    id: row.id, workspaceId: row.workspaceId, name: row.name, description: row.description,
    type: storedType(row.type), status: storedStatus(row.status), currentVersion: row.currentVersion,
    archivedFromStatus: row.archivedFromStatus && isAssetStatus(row.archivedFromStatus) ? row.archivedFromStatus : null,
    tags: row.assetTags.map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug })).sort((a, b) => a.name.localeCompare(b.name)),
    entities: row.entityLinks.map((link) => ({ entityId: link.entityId, entityName: link.entity.name,
      entityCategory: link.entity.category, purpose: link.purpose, version: link.version }))
      .sort((a, b) => a.entityName.localeCompare(b.entityName)),
    parents: row.parentLinks.map((link) => ({ id: link.parentAsset.id, name: link.parentAsset.name,
      type: storedType(link.parentAsset.type), relationship: link.relationship })),
    derivedAssets: row.derivedLinks.map((link) => ({ id: link.derivedAsset.id, name: link.derivedAsset.name,
      type: storedType(link.derivedAsset.type), relationship: link.relationship })),
    version: toVersionView(version), createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt, archivedAt: row.archivedAt,
  };
}

function orderByForSort(sort: AssetSort): Prisma.AssetOrderByWithRelationInput[] {
  if (sort === "updated_asc") return [{ updatedAt: "asc" }, { id: "asc" }];
  if (sort === "name_asc") return [{ name: "asc" }, { id: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }, { id: "asc" }];
  return [{ updatedAt: "desc" }, { id: "asc" }];
}

export async function listAssets(userId: string, workspaceId: string, params: ListAssetsParams = {}): Promise<ListAssetsResult> {
  await requireMembership(userId, workspaceId, "asset.view");
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(ASSET_MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? ASSET_PAGE_SIZE)));
  const where: Prisma.AssetWhereInput = { workspaceId };
  const status = params.status ?? "CURRENT";
  if (status === "CURRENT") where.status = { not: "ARCHIVED" };
  else if (status !== "ALL") where.status = status;
  if (params.type) where.type = params.type;
  if (params.tag) where.assetTags = { some: { tag: { slug: slugify(params.tag) } } };
  if (params.entityId) where.entityLinks = { some: { entityId: params.entityId } };
  const search = params.search?.trim();
  if (search) where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
  const [total, rows] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({ where, include: assetInclude, orderBy: orderByForSort(params.sort ?? "updated_desc"),
      skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items: rows.map(toAssetView), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAsset(userId: string, workspaceId: string, assetId: string): Promise<AssetView> {
  await requireMembership(userId, workspaceId, "asset.view");
  const row = await prisma.asset.findFirst({ where: { id: assetId, workspaceId }, include: assetInclude });
  if (!row) throw new NotFoundError("Asset not found.");
  return toAssetView(row);
}

export async function listAssetVersions(userId: string, workspaceId: string, assetId: string): Promise<AssetVersionView[]> {
  await requireMembership(userId, workspaceId, "asset.view");
  const asset = await prisma.asset.findFirst({ where: { id: assetId, workspaceId }, select: { id: true } });
  if (!asset) throw new NotFoundError("Asset not found.");
  const rows = await prisma.assetVersion.findMany({ where: { assetId },
    include: { createdBy: { select: { displayName: true } } }, orderBy: { version: "desc" } });
  return rows.map(toVersionView);
}

export async function getAssetVersion(userId: string, workspaceId: string, assetId: string, version: number): Promise<AssetVersionView> {
  await requireMembership(userId, workspaceId, "asset.view");
  const row = await prisma.assetVersion.findFirst({ where: { assetId, version, asset: { workspaceId } },
    include: { createdBy: { select: { displayName: true } } } });
  if (!row) throw new NotFoundError("Asset version not found.");
  return toVersionView(row);
}

export async function listAssetTags(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "asset.view");
  return prisma.tag.findMany({ where: { workspaceId, assetTags: { some: {} } },
    select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
}

async function validateReferences(tx: Prisma.TransactionClient, workspaceId: string, data: AssetSnapshotInput, assetId?: string) {
  const entityIds = [...new Set(data.entityAssociations.map((item) => item.entityId))];
  if (entityIds.length) {
    const count = await tx.entity.count({ where: { workspaceId, id: { in: entityIds } } });
    if (count !== entityIds.length) throw new ValidationError("Every associated Entity must belong to this workspace.");
  }
  const parentIds = [...new Set(data.derivedFromAssetIds)];
  if (assetId && parentIds.includes(assetId)) throw new ValidationError("An Asset cannot derive from itself.");
  if (parentIds.length) {
    const count = await tx.asset.count({ where: { workspaceId, id: { in: parentIds } } });
    if (count !== parentIds.length) throw new ValidationError("Every parent Asset must belong to this workspace.");
  }
}

function uniqueTags(tags: string[]) {
  const bySlug = new Map<string, string>();
  for (const name of tags) { const slug = slugify(name); if (slug && !bySlug.has(slug)) bySlug.set(slug, name.trim()); }
  return [...bySlug].map(([slug, name]) => ({ slug, name }));
}

function versionData(assetId: string, version: number, data: AssetSnapshotInput, userId: string) {
  return {
    assetId, version, name: data.name, description: data.description ?? null, type: data.type,
    status: data.status, tags: JSON.stringify(uniqueTags(data.tags).map((tag) => tag.name)),
    provenance: JSON.stringify(data.provenance), licenseInfo: data.licenseInfo ? JSON.stringify(data.licenseInfo) : null,
    authorInfo: data.authorInfo ? JSON.stringify(data.authorInfo) : null,
    externalReference: data.externalReference ?? null, thumbnailReference: data.thumbnailReference ?? null,
    technicalMetadata: JSON.stringify(data.technicalMetadata),
    modelSpecification: data.modelSpecification ? JSON.stringify(data.modelSpecification) : null,
    rigSpecification: data.rigSpecification ? JSON.stringify(data.rigSpecification) : null,
    animationSpecification: data.animationSpecification ? JSON.stringify(data.animationSpecification) : null,
    productionChecklist: JSON.stringify(data.productionChecklist), entityAssociations: JSON.stringify(data.entityAssociations),
    derivedFromAssetIds: JSON.stringify([...new Set(data.derivedFromAssetIds)]), changeNote: data.changeNote ?? null,
    createdById: userId,
  };
}

async function replaceCurrentRelations(tx: Prisma.TransactionClient, workspaceId: string, assetId: string,
  version: number, data: AssetSnapshotInput) {
  await tx.assetTag.deleteMany({ where: { assetId } });
  for (const tag of uniqueTags(data.tags)) {
    const row = await tx.tag.upsert({ where: { workspaceId_slug: { workspaceId, slug: tag.slug } },
      create: { workspaceId, name: tag.name, slug: tag.slug }, update: {} });
    await tx.assetTag.create({ data: { assetId, tagId: row.id } });
  }
  await tx.assetEntity.deleteMany({ where: { assetId } });
  if (data.entityAssociations.length) await tx.assetEntity.createMany({ data: data.entityAssociations.map((association) => ({
    assetId, entityId: association.entityId, purpose: association.purpose.toUpperCase(), version,
  })) });
  await tx.assetRelationship.deleteMany({ where: { derivedAssetId: assetId } });
  if (data.derivedFromAssetIds.length) await tx.assetRelationship.createMany({ data: [...new Set(data.derivedFromAssetIds)]
    .map((parentAssetId) => ({ parentAssetId, derivedAssetId: assetId, relationship: "DERIVED_FROM" })) });
}

export async function createAsset(userId: string, workspaceId: string, input: unknown): Promise<AssetView> {
  await requireMembership(userId, workspaceId, "asset.manage");
  const data = parseOrThrow(createAssetSchema, input, "The Asset is invalid.");
  const created = await prisma.$transaction(async (tx) => {
    await validateReferences(tx, workspaceId, data);
    const asset = await tx.asset.create({ data: { workspaceId, name: data.name, description: data.description ?? null,
      type: data.type, status: data.status, createdById: userId } });
    await tx.assetVersion.create({ data: versionData(asset.id, 1, data, userId) });
    await replaceCurrentRelations(tx, workspaceId, asset.id, 1, data);
    return asset;
  });
  await recordAudit({ action: "asset.created", actorUserId: userId, workspaceId, entityType: "Asset",
    entityId: created.id, metadata: { name: data.name, type: data.type, version: 1 } });
  return getAsset(userId, workspaceId, created.id);
}

function versionToInput(asset: AssetView): CreateAssetInput {
  const version = asset.version;
  return {
    name: version.name, description: version.description ?? undefined, type: version.type,
    status: version.status === "ARCHIVED"
      ? (asset.archivedFromStatus && asset.archivedFromStatus !== "ARCHIVED" ? asset.archivedFromStatus : "DRAFT")
      : version.status,
    tags: version.tags, provenance: version.provenance, licenseInfo: version.licenseInfo,
    authorInfo: version.authorInfo, externalReference: version.externalReference,
    thumbnailReference: version.thumbnailReference, technicalMetadata: version.technicalMetadata,
    modelSpecification: version.modelSpecification, rigSpecification: version.rigSpecification,
    animationSpecification: version.animationSpecification, productionChecklist: version.productionChecklist,
    entityAssociations: asset.entities.map(({ entityId, purpose }) => ({ entityId, purpose })),
    derivedFromAssetIds: asset.parents.map(({ id }) => id), changeNote: undefined,
  };
}

async function appendVersion(userId: string, workspaceId: string, asset: AssetView, data: AssetSnapshotInput,
  options: { archivedAt?: Date | null; archivedFromStatus?: AssetStatus | null } = {}) {
  const nextVersion = asset.currentVersion + 1;
  await prisma.$transaction(async (tx) => {
    await validateReferences(tx, workspaceId, data, asset.id);
    await tx.asset.update({ where: { id: asset.id }, data: {
      name: data.name, description: data.description ?? null, type: data.type, status: data.status,
      currentVersion: nextVersion,
      ...(options.archivedAt !== undefined ? { archivedAt: options.archivedAt } : {}),
      ...(options.archivedFromStatus !== undefined ? { archivedFromStatus: options.archivedFromStatus } : {}),
    } });
    await tx.assetVersion.create({ data: versionData(asset.id, nextVersion, data, userId) });
    await replaceCurrentRelations(tx, workspaceId, asset.id, nextVersion, data);
  });
  return nextVersion;
}

export async function updateAsset(userId: string, workspaceId: string, assetId: string, input: unknown): Promise<AssetView> {
  await requireMembership(userId, workspaceId, "asset.manage");
  const current = await getAsset(userId, workspaceId, assetId);
  if (current.status === "ARCHIVED") throw new ValidationError("Restore this Asset before editing it.");
  const patch = parseOrThrow(updateAssetSchema, input, "The Asset update is invalid.");
  // Defaults inside nested Zod schemas are useful for create, but an update must
  // only replace keys that the caller actually supplied.
  const suppliedKeys = input && typeof input === "object" && !Array.isArray(input)
    ? new Set(Object.keys(input)) : new Set<string>();
  const explicitPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => suppliedKeys.has(key)));
  const data = parseOrThrow(createAssetSchema, { ...versionToInput(current), ...explicitPatch }, "The Asset update is invalid.");
  if (!canTransitionAssetStatus(current.status, data.status)) {
    throw new ValidationError(`Asset status cannot move from ${current.status} to ${data.status}.`);
  }
  const nextVersion = await appendVersion(userId, workspaceId, current, data);
  await recordAudit({ action: "asset.updated", actorUserId: userId, workspaceId, entityType: "Asset",
    entityId: assetId, metadata: { version: nextVersion, status: data.status } });
  return getAsset(userId, workspaceId, assetId);
}

export async function archiveAsset(userId: string, workspaceId: string, assetId: string): Promise<AssetView> {
  await requireMembership(userId, workspaceId, "asset.manage");
  const current = await getAsset(userId, workspaceId, assetId);
  if (current.status === "ARCHIVED") return current;
  const data: AssetSnapshotInput = { ...versionToInput(current), status: "ARCHIVED", changeNote: "Archived" };
  const nextVersion = await appendVersion(userId, workspaceId, current, data,
    { archivedAt: new Date(), archivedFromStatus: current.status });
  await recordAudit({ action: "asset.archived", actorUserId: userId, workspaceId, entityType: "Asset",
    entityId: assetId, metadata: { version: nextVersion } });
  return getAsset(userId, workspaceId, assetId);
}

export async function restoreAsset(userId: string, workspaceId: string, assetId: string): Promise<AssetView> {
  await requireMembership(userId, workspaceId, "asset.manage");
  const current = await getAsset(userId, workspaceId, assetId);
  if (current.status !== "ARCHIVED") return current;
  const status = current.archivedFromStatus && current.archivedFromStatus !== "ARCHIVED" ? current.archivedFromStatus : "DRAFT";
  const parsed = parseOrThrow(createAssetSchema, { ...versionToInput(current), status, changeNote: "Restored" },
    "The archived Asset cannot be restored.");
  const nextVersion = await appendVersion(userId, workspaceId, current, parsed,
    { archivedAt: null, archivedFromStatus: null });
  await recordAudit({ action: "asset.restored", actorUserId: userId, workspaceId, entityType: "Asset",
    entityId: assetId, metadata: { version: nextVersion, status } });
  return getAsset(userId, workspaceId, assetId);
}

/** Permanently remove an already archived Asset and its version history. */
export async function deleteAsset(userId: string, workspaceId: string, assetId: string): Promise<{ id: string }> {
  await requireMembership(userId, workspaceId, "asset.manage");
  const asset = await prisma.asset.findFirst({ where: { id: assetId, workspaceId }, select: { id: true, status: true } });
  if (!asset) throw new NotFoundError("Asset not found.");
  if (asset.status !== "ARCHIVED") throw new ConflictError("Archive this Asset before deleting it permanently.");
  await prisma.asset.delete({ where: { id: asset.id } });
  await recordAudit({ action: "asset.deleted", actorUserId: userId, workspaceId, entityType: "Asset", entityId: asset.id });
  return { id: asset.id };
}
