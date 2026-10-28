import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  EARTH_BOUNDARY_QUALITIES,
  EARTH_GEOMETRY_MAX_BYTES,
  EARTH_PLACE_KINDS,
  EARTH_VERIFICATION_STATUSES,
  type EarthBoundaryQuality,
  type EarthPlaceKind,
  type EarthVerificationStatus,
} from "@/lib/earth/constants";
import {
  earthCountryListQuerySchema,
  earthIssueListQuerySchema,
  earthPlaceIdSchema,
  earthPlaceListQuerySchema,
  type EarthIssueListQuery,
  type EarthPlaceListQuery,
} from "@/lib/earth/schemas";
import type {
  EarthBoundaryView,
  EarthDatasetAttribution,
  EarthPlaceDetail,
  EarthPlaceSummary,
} from "@/lib/earth/types";
import { normalizeEarthPlaceName } from "@/lib/earth/import";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { requireMembership } from "./workspace-service";

const activeRevisionInclude = {
  revisions: {
    where: { isCurrent: true, datasetVersion: { status: "ACTIVE" } },
    orderBy: { revision: "desc" as const },
    take: 1,
    include: { datasetVersion: { include: { dataset: true } } },
  },
  parent: { select: { publicId: true } },
} satisfies Prisma.EarthGeoPlaceInclude;

type PlaceWithRevision = Prisma.EarthGeoPlaceGetPayload<{ include: typeof activeRevisionInclude }>;

async function authorize(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "workspace.view");
}

function isPlaceKind(value: string): value is EarthPlaceKind {
  return (EARTH_PLACE_KINDS as readonly string[]).includes(value);
}

function isBoundaryQuality(value: string): value is EarthBoundaryQuality {
  return (EARTH_BOUNDARY_QUALITIES as readonly string[]).includes(value);
}

function isVerificationStatus(value: string): value is EarthVerificationStatus {
  return (EARTH_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

function attribution(place: PlaceWithRevision): EarthDatasetAttribution {
  const revision = place.revisions[0];
  if (!revision) throw new NotFoundError("Geographic place has no active revision.");
  const version = revision.datasetVersion;
  return {
    provider: version.dataset.name,
    releaseType: version.dataset.releaseType,
    version: version.versionKey,
    sourceRevision: version.sourceRevision,
    sourceUrl: version.dataset.sourceUrl,
    licenseName: version.dataset.licenseName,
    licenseUrl: version.dataset.licenseUrl,
    attribution: version.dataset.attribution,
  };
}

function nullablePair(first: number | null, second: number | null): [number, number] | null {
  return first === null || second === null ? null : [first, second];
}

function summary(place: PlaceWithRevision): EarthPlaceSummary {
  const revision = place.revisions[0];
  if (!revision || !isPlaceKind(place.kind) || !isBoundaryQuality(revision.boundaryQuality)
    || !isVerificationStatus(revision.verificationStatus)) {
    throw new NotFoundError("Geographic place has no supported active revision.");
  }
  const bbox = revision.bboxWest === null || revision.bboxSouth === null
    || revision.bboxEast === null || revision.bboxNorth === null
    ? null
    : [revision.bboxWest, revision.bboxSouth, revision.bboxEast, revision.bboxNorth] as [number, number, number, number];
  const geometryType = revision.geometryType;
  if (!["Point", "Polygon", "MultiPolygon", "None"].includes(geometryType)) {
    throw new NotFoundError("Geographic place geometry is unsupported.");
  }
  return {
    id: place.publicId,
    parentId: place.parent?.publicId ?? null,
    kind: place.kind,
    name: place.name,
    isoAlpha2: place.isoAlpha2,
    isoAlpha3: place.isoAlpha3,
    adminLevel: place.adminLevel,
    geometryType: geometryType as EarthPlaceSummary["geometryType"],
    boundaryQuality: revision.boundaryQuality,
    verificationStatus: revision.verificationStatus,
    coordinateReferenceSystem: revision.coordinateReferenceSystem,
    bbox,
    label: nullablePair(revision.labelLongitude, revision.labelLatitude),
    contentHash: revision.contentHash,
    dataset: attribution(place),
  };
}

const activePlaceWhere: Prisma.EarthGeoPlaceWhereInput = {
  revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
};

export async function listEarthCountries(
  userId: string,
  workspaceId: string,
  input: unknown = {},
): Promise<{ items: EarthPlaceSummary[]; total: number; limit: number }> {
  await authorize(userId, workspaceId);
  const query = parseOrThrow(earthCountryListQuerySchema, input, "Invalid country query.");
  const where: Prisma.EarthGeoPlaceWhereInput = { AND: [activePlaceWhere, { kind: "COUNTRY" }] };
  const [places, total] = await Promise.all([
    prisma.earthGeoPlace.findMany({ where, include: activeRevisionInclude, orderBy: { name: "asc" }, take: query.limit }),
    prisma.earthGeoPlace.count({ where }),
  ]);
  return { items: places.map(summary), total, limit: query.limit };
}

export async function listEarthPlaces(
  userId: string,
  workspaceId: string,
  input: unknown = {},
): Promise<{ items: EarthPlaceSummary[]; total: number; limit: number }> {
  await authorize(userId, workspaceId);
  const query: EarthPlaceListQuery = parseOrThrow(earthPlaceListQuerySchema, input, "Invalid geography query.");
  let parentDatabaseId: string | undefined;
  if (query.parentId) {
    const parent = await prisma.earthGeoPlace.findFirst({
      where: { publicId: query.parentId, ...activePlaceWhere },
      select: { id: true },
    });
    if (!parent) throw new NotFoundError("Geographic place not found.");
    parentDatabaseId = parent.id;
  }
  const normalizedSearch = query.q ? normalizeEarthPlaceName(query.q) : undefined;
  if (query.q && !normalizedSearch) throw new ValidationError("Search must contain letters or numbers.");
  const where: Prisma.EarthGeoPlaceWhereInput = {
    AND: [
      activePlaceWhere,
      parentDatabaseId ? { parentId: parentDatabaseId } : {},
      query.kind ? { kind: query.kind } : {},
      normalizedSearch ? { normalizedName: { contains: normalizedSearch } } : {},
    ],
  };
  const [places, total] = await Promise.all([
    prisma.earthGeoPlace.findMany({
      where,
      include: activeRevisionInclude,
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      take: query.limit,
    }),
    prisma.earthGeoPlace.count({ where }),
  ]);
  return { items: places.map(summary), total, limit: query.limit };
}

export async function listEarthSubdivisions(
  userId: string,
  workspaceId: string,
  countryPublicId: string,
  input: unknown = {},
) {
  await authorize(userId, workspaceId);
  const publicId = parseOrThrow(earthPlaceIdSchema, countryPublicId, "Invalid country identifier.");
  const country = await prisma.earthGeoPlace.findFirst({
    where: { publicId, kind: "COUNTRY", ...activePlaceWhere },
    select: { id: true },
  });
  if (!country) throw new NotFoundError("Country not found.");
  return listEarthPlaces(userId, workspaceId, { ...input as object, parentId: publicId, kind: "ADMIN1" });
}

async function findPlace(publicIdInput: string): Promise<PlaceWithRevision> {
  const publicId = parseOrThrow(earthPlaceIdSchema, publicIdInput, "Invalid place identifier.");
  const place = await prisma.earthGeoPlace.findFirst({
    where: { publicId, ...activePlaceWhere },
    include: activeRevisionInclude,
  });
  if (!place) throw new NotFoundError("Geographic place not found.");
  return place;
}

async function hierarchyFor(place: PlaceWithRevision): Promise<EarthPlaceSummary[]> {
  const chain: EarthPlaceSummary[] = [summary(place)];
  let parentDatabaseId = place.parentId;
  for (let depth = 0; parentDatabaseId && depth < 8; depth += 1) {
    const parent = await prisma.earthGeoPlace.findFirst({
      where: { id: parentDatabaseId, ...activePlaceWhere },
      include: activeRevisionInclude,
    });
    if (!parent) break;
    chain.unshift(summary(parent));
    parentDatabaseId = parent.parentId;
  }
  return chain;
}

export async function getEarthPlace(
  userId: string,
  workspaceId: string,
  publicId: string,
): Promise<EarthPlaceDetail> {
  await authorize(userId, workspaceId);
  const place = await findPlace(publicId);
  const childCount = await prisma.earthGeoPlace.count({ where: { parentId: place.id, ...activePlaceWhere } });
  const view = summary(place);
  return {
    ...view,
    hierarchy: await hierarchyFor(place),
    childCount,
    hasBoundary: view.geometryType === "Polygon" || view.geometryType === "MultiPolygon",
  };
}

export async function getEarthPlaceHierarchy(
  userId: string,
  workspaceId: string,
  publicId: string,
): Promise<{ items: EarthPlaceSummary[] }> {
  await authorize(userId, workspaceId);
  return { items: await hierarchyFor(await findPlace(publicId)) };
}

export async function getEarthPlaceBoundary(
  userId: string,
  workspaceId: string,
  publicId: string,
): Promise<{ feature: EarthBoundaryView; bytes: number; maxBytes: number }> {
  await authorize(userId, workspaceId);
  const place = await findPlace(publicId);
  const view = summary(place);
  const revision = place.revisions[0];
  if (!revision) throw new NotFoundError("Geographic place has no active revision.");
  const bytes = Buffer.byteLength(revision.geometryGeoJson ?? "", "utf8");
  if (bytes > EARTH_GEOMETRY_MAX_BYTES) {
    throw new ValidationError("Boundary exceeds the Phase 2 response limit. Request a generalized representation.");
  }
  let geometry: EarthBoundaryView["geometry"] = null;
  if (revision.geometryGeoJson) {
    const parsed = JSON.parse(revision.geometryGeoJson) as { type?: unknown; coordinates?: unknown };
    if (!["Point", "Polygon", "MultiPolygon"].includes(String(parsed.type))) {
      throw new NotFoundError("Geographic geometry is unavailable.");
    }
    geometry = { type: parsed.type as "Point" | "Polygon" | "MultiPolygon", coordinates: parsed.coordinates };
  }
  return {
    feature: {
      type: "Feature",
      id: view.id,
      properties: {
        name: view.name,
        kind: view.kind,
        boundaryQuality: view.boundaryQuality,
        verificationStatus: view.verificationStatus,
        coordinateReferenceSystem: view.coordinateReferenceSystem,
        contentHash: view.contentHash,
        datasetVersion: view.dataset.version,
        attribution: view.dataset.attribution,
      },
      geometry,
    },
    bytes,
    maxBytes: EARTH_GEOMETRY_MAX_BYTES,
  };
}

export async function listEarthBoundaryIssues(
  userId: string,
  workspaceId: string,
  input: unknown = {},
): Promise<{ items: EarthPlaceSummary[]; total: number; limit: number }> {
  await authorize(userId, workspaceId);
  const query: EarthIssueListQuery = parseOrThrow(earthIssueListQuerySchema, input, "Invalid geography issue query.");
  const issueRevision: Prisma.EarthGeoPlaceRevisionWhereInput = {
    isCurrent: true,
    datasetVersion: { status: "ACTIVE" },
    ...(query.boundaryQuality
      ? { boundaryQuality: query.boundaryQuality }
      : { boundaryQuality: { notIn: ["VERIFIED_BOUNDARY", "GENERALIZED_BOUNDARY"] } }),
    ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
  };
  const where: Prisma.EarthGeoPlaceWhereInput = { revisions: { some: issueRevision } };
  const [places, total] = await Promise.all([
    prisma.earthGeoPlace.findMany({ where, include: activeRevisionInclude, orderBy: { name: "asc" }, take: query.limit }),
    prisma.earthGeoPlace.count({ where }),
  ]);
  return { items: places.map(summary), total, limit: query.limit };
}

export async function getEarthGeographyCatalogStatus(userId: string, workspaceId: string) {
  await authorize(userId, workspaceId);
  const [datasets, placeCount, latestImports] = await Promise.all([
    prisma.earthGeoDataset.findMany({
      include: { versions: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { providerKey: "asc" },
    }),
    prisma.earthGeoPlace.count({ where: activePlaceWhere }),
    prisma.earthGeoImport.findMany({
      include: { datasetVersion: { include: { dataset: true } } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);
  return {
    coordinateReferenceSystem: "EPSG:4326",
    placeCount,
    datasets: datasets.map((dataset) => ({
      provider: dataset.name,
      releaseType: dataset.releaseType,
      sourceUrl: dataset.sourceUrl,
      licenseName: dataset.licenseName,
      licenseUrl: dataset.licenseUrl,
      attribution: dataset.attribution,
      versions: dataset.versions.map((version) => ({
        version: version.versionKey,
        sourceRevision: version.sourceRevision,
        status: version.status,
        manifestChecksum: version.manifestChecksum,
        importedAt: version.importedAt?.toISOString() ?? null,
      })),
    })),
    latestImports: latestImports.map((run) => ({
      provider: run.datasetVersion.dataset.name,
      version: run.datasetVersion.versionKey,
      status: run.status,
      recordsRead: run.recordsRead,
      recordsCreated: run.recordsCreated,
      recordsUpdated: run.recordsUpdated,
      recordsSkipped: run.recordsSkipped,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    })),
  };
}
