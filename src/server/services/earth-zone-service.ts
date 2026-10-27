import { randomBytes } from "node:crypto";
import type { EarthDevelopmentZoneVersion, Prisma } from "@prisma/client";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  createEarthZoneSchema,
  createEarthZoneVersionSchema,
  decodeEarthParcelCursor,
  earthParcelGridQuerySchema,
  earthParcelIdSchema,
  earthParcelViewportQuerySchema,
  encodeEarthParcelCursor,
  earthZoneIdSchema,
  earthZoneListQuerySchema,
  earthZoneVersionIdSchema,
  type EarthParcelView,
  type EarthZoneDetail,
  type EarthZoneProvenance,
  type EarthZoneRestrictions,
  type EarthZoneStatus,
  type EarthZoneSummary,
  type EarthZoneVersionDefinition,
} from "@/lib/earth/land";
import {
  EARTH_PARCEL_ALGORITHM_VERSION,
  EARTH_PARCEL_VIEWPORT_MAX_RESULTS,
  EARTH_PARCEL_VIEWPORT_MIN_ZOOM,
  earthGeometryBbox,
  generateParcelViewport,
  geometryContainsGeometry,
  geometryContainsPoint,
  parcelPublicId,
  parcelCanonicalKey,
  parseUtmSrid,
  projectWgs84ToUtm,
  sha256Content,
  validateEarthAreaGeometry,
  deriveParcelCandidate,
  type EarthAreaGeometry,
  type EarthParcelCandidate,
  type EarthParcelZoneDefinition,
  type EarthZoneExclusion,
} from "@/lib/earth/parcels";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

export const EARTH_VIRTUAL_LAND_NOTICE = "SIMVERSE plots are virtual only and grant no rights in real-world land.";

const zoneInclude = {
  place: { select: { publicId: true, name: true, kind: true } },
  activeVersion: true,
} satisfies Prisma.EarthDevelopmentZoneInclude;

type ZoneWithActiveVersion = Prisma.EarthDevelopmentZoneGetPayload<{ include: typeof zoneInclude }>;

function randomPublicId(prefix: "zone" | "zonev"): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}
function isZoneStatus(value: string): value is EarthZoneStatus {
  return ["DRAFT", "REVIEW", "ACTIVE", "RETIRED"].includes(value);
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new NotFoundError(`${label} is unavailable.`);
  }
}

async function authorizeViewer(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "workspace.view");
}

async function authorizeSteward(
  userId: string,
  workspaceId: string,
  activation = false,
) {
  await authorizeViewer(userId, workspaceId);
  const grant = await prisma.earthSteward.findUnique({ where: { userId } });
  if (!grant || !grant.isActive || (activation && !grant.canActivate)) {
    throw new AuthorizationError(
      activation
        ? "An active Earth steward activation grant is required."
        : "An active Earth steward grant is required.",
    );
  }
  return grant;
}

function projectionDefinition(srid: number): string {
  const projection = parseUtmSrid(srid);
  return `+proj=utm +zone=${projection.zone}${projection.northern ? "" : " +south"} +datum=WGS84 +units=m +no_defs`;
}

function versionDefinition(row: EarthDevelopmentZoneVersion): EarthZoneVersionDefinition {
  if (row.edgePolicy !== "FULL_CELL" || row.algorithmVersion !== EARTH_PARCEL_ALGORITHM_VERSION) {
    throw new NotFoundError("Zone parcel policy is unavailable.");
  }
  return {
    geometry: parseJson<EarthAreaGeometry>(row.geometryGeoJson, "Zone geometry"),
    exclusions: parseJson<EarthZoneExclusion[]>(row.exclusionsJson, "Zone exclusions"),
    projectionSrid: row.projectionSrid,
    gridOrigin: [row.gridOriginLongitude, row.gridOriginLatitude],
    gridBearingDegrees: row.gridBearingDegrees,
    cellWidthMeters: row.cellWidthMeters,
    cellHeightMeters: row.cellHeightMeters,
    edgePolicy: row.edgePolicy,
    restrictions: parseJson<EarthZoneRestrictions>(row.restrictionsJson, "Zone restrictions"),
    provenance: parseJson<EarthZoneProvenance>(row.provenanceJson, "Zone provenance"),
    reviewNote: row.reviewNote,
  };
}

function zoneSummary(zone: ZoneWithActiveVersion): EarthZoneSummary {
  const version = zone.activeVersion;
  if (!version || !isZoneStatus(zone.status) || zone.status !== "ACTIVE") {
    throw new NotFoundError("Active development zone not found.");
  }
  const restrictions = parseJson<EarthZoneRestrictions>(version.restrictionsJson, "Zone restrictions");
  return {
    id: zone.publicId,
    name: zone.name,
    status: "ACTIVE",
    placeId: zone.place.publicId,
    placeName: zone.place.name,
    isDemonstration: zone.isDemonstration,
    activeVersion: version.version,
    activeVersionId: version.publicId,
    bbox: [version.bboxWest, version.bboxSouth, version.bboxEast, version.bboxNorth],
    zoningLabel: restrictions.zoningLabel,
    cellSizeMeters: [version.cellWidthMeters, version.cellHeightMeters],
    virtualOnlyNotice: EARTH_VIRTUAL_LAND_NOTICE,
  };
}

function zoneDetail(zone: ZoneWithActiveVersion): EarthZoneDetail {
  const version = zone.activeVersion;
  if (!version) throw new NotFoundError("Active development zone not found.");
  const definition = versionDefinition(version);
  return {
    ...zoneSummary(zone),
    geometry: definition.geometry,
    exclusions: definition.exclusions,
    projection: {
      code: version.projectionCode,
      srid: version.projectionSrid,
      definition: version.projectionDefinition,
    },
    grid: {
      origin: definition.gridOrigin,
      bearingDegrees: definition.gridBearingDegrees,
      algorithmVersion: version.algorithmVersion,
      edgePolicy: "FULL_CELL",
    },
    restrictions: definition.restrictions,
    provenance: definition.provenance,
    contentHash: version.contentHash,
    activatedAt: version.activatedAt?.toISOString() ?? null,
  };
}

async function activePlaceForZone(publicId: string) {
  const place = await prisma.earthGeoPlace.findFirst({
    where: {
      publicId,
      revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
    },
    include: {
      revisions: {
        where: { isCurrent: true, datasetVersion: { status: "ACTIVE" } },
        orderBy: { revision: "desc" },
        take: 1,
      },
    },
  });
  if (!place || !place.revisions[0]) throw new NotFoundError("Geographic place not found.");
  const revision = place.revisions[0];
  if (revision.geometryType === "Point" || revision.boundaryQuality === "POINT_ONLY") {
    throw new ValidationError("A point-only locality cannot define a development zone.");
  }
  if (!revision.geometryGeoJson || !["Polygon", "MultiPolygon"].includes(revision.geometryType)) {
    throw new ValidationError("The selected place has no reviewed polygon boundary.");
  }
  return {
    place,
    revision,
    geometry: parseJson<EarthAreaGeometry>(revision.geometryGeoJson, "Geographic boundary"),
  };
}

function normalizeDefinition(
  input: EarthZoneVersionDefinition,
  parentGeometry: EarthAreaGeometry,
) {
  parseUtmSrid(input.projectionSrid);
  validateEarthAreaGeometry(input.geometry, input.projectionSrid);
  if (!geometryContainsGeometry(parentGeometry, input.geometry, input.projectionSrid)) {
    throw new ValidationError("Development-zone geometry must be contained by its reviewed parent geography.");
  }
  for (const exclusion of input.exclusions) {
    validateEarthAreaGeometry(exclusion.geometry, input.projectionSrid, `Exclusion ${exclusion.id}`);
    if (!geometryContainsGeometry(input.geometry, exclusion.geometry, input.projectionSrid)) {
      throw new ValidationError(`Exclusion ${exclusion.id} must be contained by the development zone.`);
    }
  }
  const origin = projectWgs84ToUtm(input.gridOrigin, input.projectionSrid);
  const bbox = earthGeometryBbox(input.geometry);
  if (!geometryContainsPoint(input.geometry, input.gridOrigin, input.projectionSrid)) {
    throw new ValidationError("Grid origin must lie inside the development-zone geometry.");
  }
  const immutable = {
    geometry: input.geometry,
    exclusions: input.exclusions,
    projectionSrid: input.projectionSrid,
    projectionDefinition: projectionDefinition(input.projectionSrid),
    gridOrigin: input.gridOrigin,
    gridOriginMetric: [origin.easting, origin.northing],
    gridBearingDegrees: input.gridBearingDegrees,
    cellWidthMeters: input.cellWidthMeters,
    cellHeightMeters: input.cellHeightMeters,
    algorithmVersion: EARTH_PARCEL_ALGORITHM_VERSION,
    edgePolicy: input.edgePolicy,
    restrictions: input.restrictions,
    provenance: input.provenance,
  };
  return { input, origin, bbox, immutable, contentHash: sha256Content(immutable) };
}

async function createVersionRecord(
  transaction: Prisma.TransactionClient,
  zone: { id: string },
  version: number,
  sourcePlaceRevisionId: string,
  definition: ReturnType<typeof normalizeDefinition>,
  userId: string,
) {
  return transaction.earthDevelopmentZoneVersion.create({
    data: {
      publicId: randomPublicId("zonev"),
      zoneId: zone.id,
      version,
      status: "DRAFT",
      sourcePlaceRevisionId,
      geometryGeoJson: JSON.stringify(definition.input.geometry),
      exclusionsJson: JSON.stringify(definition.input.exclusions),
      bboxWest: definition.bbox[0],
      bboxSouth: definition.bbox[1],
      bboxEast: definition.bbox[2],
      bboxNorth: definition.bbox[3],
      projectionCode: `EPSG:${definition.input.projectionSrid}`,
      projectionDefinition: definition.immutable.projectionDefinition,
      projectionSrid: definition.input.projectionSrid,
      gridOriginLongitude: definition.input.gridOrigin[0],
      gridOriginLatitude: definition.input.gridOrigin[1],
      gridOriginEasting: definition.origin.easting,
      gridOriginNorthing: definition.origin.northing,
      gridBearingDegrees: definition.input.gridBearingDegrees,
      cellWidthMeters: definition.input.cellWidthMeters,
      cellHeightMeters: definition.input.cellHeightMeters,
      algorithmVersion: EARTH_PARCEL_ALGORITHM_VERSION,
      edgePolicy: "FULL_CELL",
      restrictionsJson: JSON.stringify(definition.input.restrictions),
      provenanceJson: JSON.stringify(definition.input.provenance),
      contentHash: definition.contentHash,
      reviewNote: definition.input.reviewNote,
      createdByUserId: userId,
    },
  });
}

export async function createEarthDevelopmentZone(
  userId: string,
  workspaceId: string,
  input: unknown,
) {
  await authorizeSteward(userId, workspaceId);
  const data = parseOrThrow(createEarthZoneSchema, input, "Invalid development zone.");
  const context = await activePlaceForZone(data.placeId);
  const definition = normalizeDefinition(data.definition, context.geometry);
  const canonicalKey = `earth:zone:${data.key}`;
  const duplicate = await prisma.earthDevelopmentZone.findUnique({ where: { canonicalKey } });
  if (duplicate) throw new ConflictError("A development zone already uses this stable key.");

  const created = await prisma.$transaction(async (transaction) => {
    const zone = await transaction.earthDevelopmentZone.create({
      data: {
        publicId: randomPublicId("zone"),
        canonicalKey,
        name: data.name,
        normalizedName: data.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
        placeId: context.place.id,
        status: "DRAFT",
        isDemonstration: data.isDemonstration,
        createdByUserId: userId,
      },
    });
    const version = await createVersionRecord(
      transaction,
      zone,
      1,
      context.revision.id,
      definition,
      userId,
    );
    await transaction.earthDevelopmentZoneLifecycleEvent.create({
      data: {
        zoneId: zone.id,
        zoneVersionId: version.id,
        action: "CREATED",
        actorUserId: userId,
        toStatus: "DRAFT",
      },
    });
    return { zone, version };
  });
  await recordAudit({
    action: "earth.zone.created",
    actorUserId: userId,
    workspaceId,
    entityType: "EarthDevelopmentZone",
    entityId: created.zone.id,
    metadata: { publicId: created.zone.publicId, version: 1, demonstration: data.isDemonstration },
  });
  return {
    zone: { id: created.zone.publicId, name: created.zone.name, status: created.zone.status },
    version: { id: created.version.publicId, version: created.version.version, status: created.version.status },
  };
}

export async function createEarthDevelopmentZoneVersion(
  userId: string,
  workspaceId: string,
  zonePublicIdInput: string,
  input: unknown,
) {
  await authorizeSteward(userId, workspaceId);
  const zonePublicId = parseOrThrow(earthZoneIdSchema, zonePublicIdInput, "Invalid zone identifier.");
  const data = parseOrThrow(createEarthZoneVersionSchema, input, "Invalid development-zone version.");
  const zone = await prisma.earthDevelopmentZone.findFirst({
    where: { publicId: zonePublicId },
    include: { place: true, versions: { orderBy: { version: "desc" } } },
  });
  if (!zone) throw new NotFoundError("Development zone not found.");
  const context = await activePlaceForZone(zone.place.publicId);
  const definition = normalizeDefinition(data.definition, context.geometry);
  if (zone.versions.some((version) => version.contentHash === definition.contentHash)) {
    throw new ConflictError("This immutable zone definition already exists.");
  }
  const nextVersion = (zone.versions[0]?.version ?? 0) + 1;
  const version = await prisma.$transaction(async (transaction) => {
    const created = await createVersionRecord(
      transaction,
      zone,
      nextVersion,
      context.revision.id,
      definition,
      userId,
    );
    await transaction.earthDevelopmentZoneLifecycleEvent.create({
      data: {
        zoneId: zone.id,
        zoneVersionId: created.id,
        action: "VERSION_CREATED",
        actorUserId: userId,
        toStatus: "DRAFT",
      },
    });
    return created;
  });
  await recordAudit({
    action: "earth.zone.version_created",
    actorUserId: userId,
    workspaceId,
    entityType: "EarthDevelopmentZoneVersion",
    entityId: version.id,
    metadata: { zoneId: zone.publicId, version: version.version },
  });
  return { id: version.publicId, version: version.version, status: version.status };
}

async function versionForLifecycle(zonePublicIdInput: string, versionPublicIdInput: string) {
  const zonePublicId = parseOrThrow(earthZoneIdSchema, zonePublicIdInput, "Invalid zone identifier.");
  const versionPublicId = parseOrThrow(
    earthZoneVersionIdSchema,
    versionPublicIdInput,
    "Invalid zone version identifier.",
  );
  const zone = await prisma.earthDevelopmentZone.findFirst({
    where: { publicId: zonePublicId },
    include: { versions: { where: { publicId: versionPublicId }, take: 1 } },
  });
  if (!zone || !zone.versions[0]) throw new NotFoundError("Development-zone version not found.");
  return { zone, version: zone.versions[0] };
}

export async function submitEarthZoneVersionForReview(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
  versionPublicId: string,
) {
  await authorizeSteward(userId, workspaceId);
  const { zone, version } = await versionForLifecycle(zonePublicId, versionPublicId);
  if (version.status !== "DRAFT") throw new ConflictError("Only a draft zone version can enter review.");
  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.earthDevelopmentZoneVersion.update({
      where: { id: version.id },
      data: { status: "REVIEW", submittedAt: new Date() },
    });
    if (!zone.activeVersionId) {
      await transaction.earthDevelopmentZone.update({ where: { id: zone.id }, data: { status: "REVIEW" } });
    }
    await transaction.earthDevelopmentZoneLifecycleEvent.create({
      data: {
        zoneId: zone.id,
        zoneVersionId: version.id,
        action: "SUBMITTED_FOR_REVIEW",
        actorUserId: userId,
        fromStatus: "DRAFT",
        toStatus: "REVIEW",
      },
    });
    return result;
  });
  await recordAudit({
    action: "earth.zone.submitted",
    actorUserId: userId,
    workspaceId,
    entityType: "EarthDevelopmentZoneVersion",
    entityId: version.id,
  });
  return { id: updated.publicId, version: updated.version, status: updated.status };
}

export async function activateEarthZoneVersion(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
  versionPublicId: string,
) {
  await authorizeSteward(userId, workspaceId, true);
  const { zone, version } = await versionForLifecycle(zonePublicId, versionPublicId);
  if (version.status !== "REVIEW") throw new ConflictError("Only a reviewed zone version can be activated.");
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    if (zone.activeVersionId) {
      await transaction.earthDevelopmentZoneVersion.update({
        where: { id: zone.activeVersionId },
        data: { status: "RETIRED", retiredAt: now },
      });
    }
    await transaction.earthDevelopmentZoneVersion.update({
      where: { id: version.id },
      data: { status: "ACTIVE", reviewedByUserId: userId, activatedAt: now, retiredAt: null },
    });
    await transaction.earthDevelopmentZone.update({
      where: { id: zone.id },
      data: { status: "ACTIVE", activeVersionId: version.id },
    });
    await transaction.earthDevelopmentZoneLifecycleEvent.create({
      data: {
        zoneId: zone.id,
        zoneVersionId: version.id,
        action: "ACTIVATED",
        actorUserId: userId,
        fromStatus: "REVIEW",
        toStatus: "ACTIVE",
        metadata: zone.activeVersionId ? JSON.stringify({ previousVersionId: zone.activeVersionId }) : null,
      },
    });
  });
  await recordAudit({
    action: "earth.zone.activated",
    actorUserId: userId,
    workspaceId,
    entityType: "EarthDevelopmentZoneVersion",
    entityId: version.id,
    metadata: { zoneId: zone.publicId, version: version.version },
  });
  return { id: version.publicId, version: version.version, status: "ACTIVE" as const };
}

export async function retireEarthZone(
  userId: string,
  workspaceId: string,
  zonePublicIdInput: string,
) {
  await authorizeSteward(userId, workspaceId, true);
  const zonePublicId = parseOrThrow(earthZoneIdSchema, zonePublicIdInput, "Invalid zone identifier.");
  const zone = await prisma.earthDevelopmentZone.findFirst({
    where: { publicId: zonePublicId },
    include: { activeVersion: true },
  });
  if (!zone || !zone.activeVersion) throw new NotFoundError("Active development zone not found.");
  const version = zone.activeVersion;
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.earthDevelopmentZone.update({
      where: { id: zone.id },
      data: { status: "RETIRED", activeVersionId: null },
    });
    await transaction.earthDevelopmentZoneVersion.update({
      where: { id: version.id },
      data: { status: "RETIRED", retiredAt: now },
    });
    await transaction.earthDevelopmentZoneLifecycleEvent.create({
      data: {
        zoneId: zone.id,
        zoneVersionId: version.id,
        action: "RETIRED",
        actorUserId: userId,
        fromStatus: "ACTIVE",
        toStatus: "RETIRED",
      },
    });
  });
  await recordAudit({
    action: "earth.zone.retired",
    actorUserId: userId,
    workspaceId,
    entityType: "EarthDevelopmentZone",
    entityId: zone.id,
  });
  return { id: zone.publicId, status: "RETIRED" as const };
}

export async function rollbackEarthZoneVersion(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
  versionPublicId: string,
) {
  await authorizeSteward(userId, workspaceId, true);
  const { zone, version } = await versionForLifecycle(zonePublicId, versionPublicId);
  if (version.status !== "RETIRED") {
    throw new ConflictError("Only a retired immutable zone version can be restored.");
  }
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    if (zone.activeVersionId) {
      await transaction.earthDevelopmentZoneVersion.update({
        where: { id: zone.activeVersionId },
        data: { status: "RETIRED", retiredAt: now },
      });
    }
    await transaction.earthDevelopmentZoneVersion.update({
      where: { id: version.id },
      data: { status: "ACTIVE", activatedAt: now, retiredAt: null, reviewedByUserId: userId },
    });
    await transaction.earthDevelopmentZone.update({
      where: { id: zone.id },
      data: { status: "ACTIVE", activeVersionId: version.id },
    });
    await transaction.earthDevelopmentZoneLifecycleEvent.create({
      data: {
        zoneId: zone.id,
        zoneVersionId: version.id,
        action: "ROLLED_BACK",
        actorUserId: userId,
        fromStatus: "RETIRED",
        toStatus: "ACTIVE",
        metadata: zone.activeVersionId ? JSON.stringify({ replacedVersionId: zone.activeVersionId }) : null,
      },
    });
  });
  await recordAudit({
    action: "earth.zone.rolled_back",
    actorUserId: userId,
    workspaceId,
    entityType: "EarthDevelopmentZoneVersion",
    entityId: version.id,
    metadata: { zoneId: zone.publicId, version: version.version },
  });
  return { id: version.publicId, version: version.version, status: "ACTIVE" as const };
}

async function findActiveZone(publicIdInput: string): Promise<ZoneWithActiveVersion> {
  const publicId = parseOrThrow(earthZoneIdSchema, publicIdInput, "Invalid zone identifier.");
  const zone = await prisma.earthDevelopmentZone.findFirst({
    where: { publicId, status: "ACTIVE", activeVersionId: { not: null } },
    include: zoneInclude,
  });
  if (!zone?.activeVersion) throw new NotFoundError("Active development zone not found.");
  return zone;
}

export async function listEarthDevelopmentZones(
  userId: string,
  workspaceId: string,
  input: unknown = {},
) {
  await authorizeViewer(userId, workspaceId);
  const query = parseOrThrow(earthZoneListQuerySchema, input, "Invalid development-zone query.");
  let placeDatabaseId: string | undefined;
  if (query.placeId) {
    const place = await prisma.earthGeoPlace.findFirst({
      where: { publicId: query.placeId },
      select: { id: true },
    });
    if (!place) throw new NotFoundError("Geographic place not found.");
    placeDatabaseId = place.id;
  }
  const zones = await prisma.earthDevelopmentZone.findMany({
    where: {
      status: "ACTIVE",
      activeVersionId: { not: null },
      ...(placeDatabaseId ? { placeId: placeDatabaseId } : {}),
      ...(query.includeDemonstration ? {} : { isDemonstration: false }),
    },
    include: zoneInclude,
    orderBy: [{ name: "asc" }, { publicId: "asc" }],
    take: query.limit,
  });
  return { items: zones.map(zoneSummary), limit: query.limit };
}

export async function getEarthDevelopmentZone(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
): Promise<EarthZoneDetail> {
  await authorizeViewer(userId, workspaceId);
  return zoneDetail(await findActiveZone(zonePublicId));
}

export async function listEarthDevelopmentZoneVersions(
  userId: string,
  workspaceId: string,
  zonePublicIdInput: string,
) {
  await authorizeSteward(userId, workspaceId);
  const publicId = parseOrThrow(earthZoneIdSchema, zonePublicIdInput, "Invalid zone identifier.");
  const zone = await prisma.earthDevelopmentZone.findFirst({
    where: { publicId },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!zone) throw new NotFoundError("Development zone not found.");
  return {
    items: zone.versions.map((version) => ({
      id: version.publicId,
      version: version.version,
      status: version.status,
      contentHash: version.contentHash,
      submittedAt: version.submittedAt?.toISOString() ?? null,
      activatedAt: version.activatedAt?.toISOString() ?? null,
      retiredAt: version.retiredAt?.toISOString() ?? null,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

function parcelDefinition(zone: ZoneWithActiveVersion): EarthParcelZoneDefinition {
  const version = zone.activeVersion;
  if (!version) throw new NotFoundError("Active development zone not found.");
  const definition = versionDefinition(version);
  return {
    zoneId: zone.publicId,
    zoneVersionId: version.publicId,
    geometry: definition.geometry,
    exclusions: definition.exclusions,
    projectionSrid: version.projectionSrid,
    originEasting: version.gridOriginEasting,
    originNorthing: version.gridOriginNorthing,
    bearingDegrees: version.gridBearingDegrees,
    cellWidthMeters: version.cellWidthMeters,
    cellHeightMeters: version.cellHeightMeters,
    algorithmVersion: version.algorithmVersion,
    edgePolicy: "FULL_CELL",
  };
}

function parcelView(zone: ZoneWithActiveVersion, candidate: EarthParcelCandidate): EarthParcelView {
  const version = zone.activeVersion!;
  const restrictions = parseJson<EarthZoneRestrictions>(version.restrictionsJson, "Zone restrictions");
  return {
    id: candidate.id,
    zoneId: zone.publicId,
    zoneVersionId: version.publicId,
    geometry: candidate.geometry,
    centroid: candidate.centroid,
    areaSquareMeters: candidate.areaSquareMeters,
    dimensionsMeters: [candidate.widthMeters, candidate.heightMeters],
    grid: { column: candidate.column, row: candidate.row },
    zoningCode: restrictions.zoningCode,
    zoningLabel: restrictions.zoningLabel,
    status: "DISCOVERABLE",
    virtualOnlyNotice: EARTH_VIRTUAL_LAND_NOTICE,
  };
}

export async function listEarthParcels(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
  input: unknown,
) {
  await authorizeViewer(userId, workspaceId);
  const query = parseOrThrow(earthParcelViewportQuerySchema, input, "Invalid parcel viewport.");
  const after = decodeEarthParcelCursor(query.cursor);
  if (query.cursor && !after) throw new ValidationError("Parcel cursor is invalid.");
  const zone = await findActiveZone(zonePublicId);
  const version = zone.activeVersion!;
  if (query.bbox[2] < version.bboxWest || query.bbox[0] > version.bboxEast
    || query.bbox[3] < version.bboxSouth || query.bbox[1] > version.bboxNorth) {
    return { items: [], nextCursor: null, limit: query.limit, scannedCandidates: 0 };
  }
  const result = generateParcelViewport(parcelDefinition(zone), {
    bbox: query.bbox,
    zoom: query.zoom,
    limit: query.limit,
    after,
  });
  return {
    items: result.items.map((candidate) => parcelView(zone, candidate)),
    nextCursor: result.next ? encodeEarthParcelCursor(result.next) : null,
    limit: query.limit,
    scannedCandidates: result.scannedCandidates,
  };
}

export async function getEarthParcel(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
  parcelPublicIdInput: string,
  input: unknown,
): Promise<EarthParcelView> {
  await authorizeViewer(userId, workspaceId);
  const parcelId = parseOrThrow(earthParcelIdSchema, parcelPublicIdInput, "Invalid parcel identifier.");
  const grid = parseOrThrow(earthParcelGridQuerySchema, input, "Parcel row and column are required.");
  const zone = await findActiveZone(zonePublicId);
  const definition = parcelDefinition(zone);
  const expected = parcelPublicId(parcelCanonicalKey(
    definition.zoneVersionId,
    grid.column,
    grid.row,
    definition.algorithmVersion,
  ));
  if (expected !== parcelId) throw new NotFoundError("Virtual parcel not found.");
  const candidate = deriveParcelCandidate(definition, grid.column, grid.row);
  if (!candidate) throw new NotFoundError("Virtual parcel not found.");
  return parcelView(zone, candidate);
}

export async function getEarthZoneRules(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
) {
  const zone = await getEarthDevelopmentZone(userId, workspaceId, zonePublicId);
  return {
    zoneId: zone.id,
    zoneVersionId: zone.activeVersionId,
    restrictions: zone.restrictions,
    cellSizeMeters: zone.cellSizeMeters,
    edgePolicy: zone.grid.edgePolicy,
    algorithmVersion: zone.grid.algorithmVersion,
    virtualOnlyNotice: EARTH_VIRTUAL_LAND_NOTICE,
  };
}

export async function getEarthZoneEligibility(
  userId: string,
  workspaceId: string,
  zonePublicId: string,
) {
  const zone = await getEarthDevelopmentZone(userId, workspaceId, zonePublicId);
  return {
    zoneId: zone.id,
    zoneVersionId: zone.activeVersionId,
    onlyFullCells: true,
    minimumZoom: EARTH_PARCEL_VIEWPORT_MIN_ZOOM,
    maximumResults: EARTH_PARCEL_VIEWPORT_MAX_RESULTS,
    exclusions: zone.exclusions,
    unsupported: [
      "partial edge cells",
      "point-only locality boundaries",
      "antimeridian-spanning zones",
      "coordinates outside the reviewed UTM projection",
    ],
    virtualOnlyNotice: EARTH_VIRTUAL_LAND_NOTICE,
  };
}
