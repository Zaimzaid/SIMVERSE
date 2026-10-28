import "dotenv/config";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import {
  EARTH_PHASE4_DEMO_ZONE_CANONICAL_KEY,
  phase4DevelopmentZoneInput,
} from "../src/lib/earth/development-demo.ts";
import {
  EARTH_PARCEL_ALGORITHM_VERSION,
  earthGeometryBbox,
  generateParcelViewport,
  geometryContainsGeometry,
  geometryContainsPoint,
  parseUtmSrid,
  projectWgs84ToUtm,
  sha256Content,
  validateEarthAreaGeometry,
} from "../src/lib/earth/parcels.ts";
import { importEarthGeography } from "../src/server/services/earth-geography-import-service.ts";

const projectRoot = path.resolve(import.meta.dirname, "..");
const databaseUrl = process.env.DATABASE_URL;

function fail(message) {
  throw new Error(`[earth:setup:phase4-demo] ${message}`);
}

function parseArguments(argv) {
  let userEmail = null;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--user-email") {
      userEmail = argv[index + 1] ?? fail("--user-email requires a value.");
      index += 1;
    } else if (value.startsWith("--user-email=")) {
      userEmail = value.slice("--user-email=".length);
    } else {
      fail(`Unknown argument: ${value}`);
    }
  }
  return { userEmail: userEmail?.trim().toLowerCase() || null };
}

function resolveDevelopmentDatabase(url) {
  if (!url) fail("DATABASE_URL is required.");
  if ((process.env.NODE_ENV ?? "development").toLowerCase() === "production") {
    fail("This development-only setup refuses to run with NODE_ENV=production.");
  }
  if (!url.startsWith("file:")) {
    fail("This development-only setup supports the local SQLite database only.");
  }
  const rawPath = url.slice("file:".length);
  if (!rawPath || rawPath.includes("?") || rawPath.includes("#")) {
    fail("DATABASE_URL must be an unqualified local SQLite file URL.");
  }
  const resolved = path.resolve(projectRoot, decodeURIComponent(rawPath));
  const expected = path.join(projectRoot, "dev.db");
  if (resolved.toLowerCase() !== expected.toLowerCase()) {
    fail(`Refusing database ${resolved}. Only the repository-local dev.db is allowed.`);
  }
  return resolved;
}

function hasTable(db, name) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
  ).get(name));
}

async function ensureCurrentSchema(databasePath) {
  const sqlite = new Database(databasePath);
  const schemaReady = hasTable(sqlite, "EarthDevelopmentZone")
    && hasTable(sqlite, "EarthDevelopmentZoneVersion")
    && hasTable(sqlite, "EarthDevelopmentZoneLifecycleEvent");
  if (schemaReady) {
    sqlite.close();
    return { changed: false, backup: null };
  }

  const backupDirectory = path.join(tmpdir(), "simverse-development-backups");
  mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backup = path.join(backupDirectory, `dev-before-earth-phase4-${timestamp}.db`);
  await sqlite.backup(backup);
  sqlite.close();

  const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "db", "push"], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  const verification = new Database(databasePath, { readonly: true });
  const ready = hasTable(verification, "EarthDevelopmentZone")
    && hasTable(verification, "EarthDevelopmentZoneVersion")
    && hasTable(verification, "EarthDevelopmentZoneLifecycleEvent");
  verification.close();
  if (!ready) fail("Prisma completed without creating the required Phase 4 tables.");
  return { changed: true, backup };
}

function projectionDefinition(srid) {
  const projection = parseUtmSrid(srid);
  return `+proj=utm +zone=${projection.zone}${projection.northern ? "" : " +south"} +datum=WGS84 +units=m +no_defs`;
}

function stablePublicId(prefix, source) {
  return `${prefix}_${createHash("sha256").update(source).digest("hex").slice(0, 24)}`;
}

function parseAreaGeometry(value, label) {
  if (!value) fail(`${label} has no polygon geometry.`);
  const geometry = JSON.parse(value);
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    fail(`${label} does not contain Polygon or MultiPolygon geometry.`);
  }
  return geometry;
}

async function selectLocalActor(prisma, requestedEmail) {
  const users = await prisma.user.findMany({
    include: { memberships: { select: { workspaceId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const eligible = users.filter((user) => user.memberships.length > 0);
  if (requestedEmail) {
    const user = eligible.find((candidate) => candidate.email.toLowerCase() === requestedEmail);
    if (!user) fail("The requested local user does not exist or has no workspace membership.");
    return user;
  }
  if (eligible.length === 1) return eligible[0];

  const activeSessions = await prisma.session.findMany({
    where: { expiresAt: { gt: new Date() }, user: { memberships: { some: {} } } },
    include: { user: { include: { memberships: { select: { workspaceId: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const recentUsers = [...new Map(activeSessions.map((session) => [session.user.id, session.user])).values()];
  if (recentUsers.length === 1) return recentUsers[0];
  if (!eligible.length) {
    fail("No local user with a workspace exists. Register locally, then rerun this command.");
  }
  fail(`Multiple local users are available. Rerun with --user-email <email>. Choices: ${eligible.map((user) => user.email).join(", ")}`);
}

async function findLagosState(prisma) {
  return prisma.earthGeoPlace.findFirst({
    where: {
      name: "Lagos",
      kind: "ADMIN1",
      isoAlpha3: "NGA",
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
}

function normalizeDefinition(input, parentGeometry) {
  const definition = input.definition;
  parseUtmSrid(definition.projectionSrid);
  validateEarthAreaGeometry(definition.geometry, definition.projectionSrid);
  if (!geometryContainsGeometry(parentGeometry, definition.geometry, definition.projectionSrid)) {
    fail("The synthetic demonstration geometry is outside the sourced Lagos State boundary.");
  }
  for (const exclusion of definition.exclusions) {
    validateEarthAreaGeometry(
      exclusion.geometry,
      definition.projectionSrid,
      `Exclusion ${exclusion.id}`,
    );
    if (!geometryContainsGeometry(definition.geometry, exclusion.geometry, definition.projectionSrid)) {
      fail(`Exclusion ${exclusion.id} falls outside the synthetic demonstration zone.`);
    }
  }
  if (!geometryContainsPoint(definition.geometry, definition.gridOrigin, definition.projectionSrid)) {
    fail("The synthetic grid origin falls outside the demonstration zone.");
  }
  const origin = projectWgs84ToUtm(definition.gridOrigin, definition.projectionSrid);
  const projection = projectionDefinition(definition.projectionSrid);
  const immutable = {
    geometry: definition.geometry,
    exclusions: definition.exclusions,
    projectionSrid: definition.projectionSrid,
    projectionDefinition: projection,
    gridOrigin: definition.gridOrigin,
    gridOriginMetric: [origin.easting, origin.northing],
    gridBearingDegrees: definition.gridBearingDegrees,
    cellWidthMeters: definition.cellWidthMeters,
    cellHeightMeters: definition.cellHeightMeters,
    algorithmVersion: EARTH_PARCEL_ALGORITHM_VERSION,
    edgePolicy: definition.edgePolicy,
    restrictions: definition.restrictions,
    provenance: definition.provenance,
  };
  return {
    input: definition,
    origin,
    bbox: earthGeometryBbox(definition.geometry),
    projection,
    contentHash: sha256Content(immutable),
  };
}

function versionData({ zoneId, version, sourceRevisionId, normalized, actorId, publicId, now }) {
  const definition = normalized.input;
  return {
    publicId,
    zoneId,
    version,
    status: "ACTIVE",
    sourcePlaceRevisionId: sourceRevisionId,
    geometryGeoJson: JSON.stringify(definition.geometry),
    exclusionsJson: JSON.stringify(definition.exclusions),
    bboxWest: normalized.bbox[0],
    bboxSouth: normalized.bbox[1],
    bboxEast: normalized.bbox[2],
    bboxNorth: normalized.bbox[3],
    projectionCode: `EPSG:${definition.projectionSrid}`,
    projectionDefinition: normalized.projection,
    projectionSrid: definition.projectionSrid,
    gridOriginLongitude: definition.gridOrigin[0],
    gridOriginLatitude: definition.gridOrigin[1],
    gridOriginEasting: normalized.origin.easting,
    gridOriginNorthing: normalized.origin.northing,
    gridBearingDegrees: definition.gridBearingDegrees,
    cellWidthMeters: definition.cellWidthMeters,
    cellHeightMeters: definition.cellHeightMeters,
    algorithmVersion: EARTH_PARCEL_ALGORITHM_VERSION,
    edgePolicy: "FULL_CELL",
    restrictionsJson: JSON.stringify(definition.restrictions),
    provenanceJson: JSON.stringify(definition.provenance),
    contentHash: normalized.contentHash,
    reviewNote: definition.reviewNote,
    createdByUserId: actorId,
    reviewedByUserId: actorId,
    submittedAt: now,
    activatedAt: now,
  };
}

async function installDemoZone(prisma, actor, lagos, input, normalized) {
  const now = new Date();
  const existing = await prisma.earthDevelopmentZone.findUnique({
    where: { canonicalKey: EARTH_PHASE4_DEMO_ZONE_CANONICAL_KEY },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (existing && !existing.isDemonstration) {
    fail("The canonical demo key is occupied by a non-demonstration zone; refusing to change it.");
  }
  const matching = existing?.versions.find((version) => version.contentHash === normalized.contentHash);
  if (existing?.status === "ACTIVE" && existing.activeVersionId === matching?.id) {
    return { zone: existing, version: matching, changed: false, action: "already-current" };
  }

  return prisma.$transaction(async (transaction) => {
    let zone = existing;
    if (!zone) {
      zone = await transaction.earthDevelopmentZone.create({
        data: {
          publicId: stablePublicId("zone", EARTH_PHASE4_DEMO_ZONE_CANONICAL_KEY),
          canonicalKey: EARTH_PHASE4_DEMO_ZONE_CANONICAL_KEY,
          name: input.name,
          normalizedName: input.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
          placeId: lagos.id,
          status: "DRAFT",
          isDemonstration: true,
          createdByUserId: actor.id,
        },
        include: { versions: true },
      });
    }

    let target = matching;
    let action = "reactivated";
    if (!target) {
      const nextVersion = (zone.versions[0]?.version ?? 0) + 1;
      const versionPublicId = stablePublicId(
        "zonev",
        `${EARTH_PHASE4_DEMO_ZONE_CANONICAL_KEY}:${normalized.contentHash}`,
      );
      target = await transaction.earthDevelopmentZoneVersion.create({
        data: versionData({
          zoneId: zone.id,
          version: nextVersion,
          sourceRevisionId: lagos.revisions[0].id,
          normalized,
          actorId: actor.id,
          publicId: versionPublicId,
          now,
        }),
      });
      action = existing ? "new-version" : "created";
      await transaction.earthDevelopmentZoneLifecycleEvent.create({
        data: {
          zoneId: zone.id,
          zoneVersionId: target.id,
          action: existing ? "VERSION_CREATED" : "CREATED",
          actorUserId: actor.id,
          toStatus: "DRAFT",
          metadata: JSON.stringify({ developmentSetup: true, synthetic: true }),
        },
      });
      await transaction.earthDevelopmentZoneLifecycleEvent.create({
        data: {
          zoneId: zone.id,
          zoneVersionId: target.id,
          action: "SUBMITTED_FOR_REVIEW",
          actorUserId: actor.id,
          fromStatus: "DRAFT",
          toStatus: "REVIEW",
          metadata: JSON.stringify({ developmentSetup: true, synthetic: true }),
        },
      });
    } else {
      await transaction.earthDevelopmentZoneVersion.update({
        where: { id: target.id },
        data: {
          status: "ACTIVE",
          reviewedByUserId: actor.id,
          activatedAt: now,
          retiredAt: null,
        },
      });
    }

    await transaction.earthDevelopmentZoneVersion.updateMany({
      where: { zoneId: zone.id, id: { not: target.id }, status: "ACTIVE" },
      data: { status: "RETIRED", retiredAt: now },
    });
    zone = await transaction.earthDevelopmentZone.update({
      where: { id: zone.id },
      data: {
        name: input.name,
        normalizedName: input.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
        placeId: lagos.id,
        status: "ACTIVE",
        activeVersionId: target.id,
        isDemonstration: true,
      },
    });
    await transaction.earthDevelopmentZoneLifecycleEvent.create({
      data: {
        zoneId: zone.id,
        zoneVersionId: target.id,
        action: matching ? "ROLLED_BACK" : "ACTIVATED",
        actorUserId: actor.id,
        fromStatus: matching?.status ?? "REVIEW",
        toStatus: "ACTIVE",
        metadata: JSON.stringify({ developmentSetup: true, synthetic: true }),
      },
    });
    return { zone, version: target, changed: true, action };
  });
}

const args = parseArguments(process.argv.slice(2));
const databasePath = resolveDevelopmentDatabase(databaseUrl);
const schema = await ensureCurrentSchema(databasePath);
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
});

try {
  const actor = await selectLocalActor(prisma, args.userEmail);
  let lagos = await findLagosState(prisma);
  let geography = "already-present";
  if (!lagos?.revisions[0]) {
    await importEarthGeography(prisma, projectRoot);
    lagos = await findLagosState(prisma);
    geography = "imported";
  }
  if (!lagos?.revisions[0]) fail("The sourced Lagos State polygon could not be prepared.");

  const input = phase4DevelopmentZoneInput(lagos.publicId);
  const parentGeometry = parseAreaGeometry(
    lagos.revisions[0].geometryGeoJson,
    "The sourced Lagos State revision",
  );
  const normalized = normalizeDefinition(input, parentGeometry);
  const result = await installDemoZone(prisma, actor, lagos, input, normalized);
  const plots = generateParcelViewport({
    zoneId: result.zone.publicId,
    zoneVersionId: result.version.publicId,
    geometry: input.definition.geometry,
    exclusions: input.definition.exclusions,
    projectionSrid: input.definition.projectionSrid,
    originEasting: normalized.origin.easting,
    originNorthing: normalized.origin.northing,
    bearingDegrees: input.definition.gridBearingDegrees,
    cellWidthMeters: input.definition.cellWidthMeters,
    cellHeightMeters: input.definition.cellHeightMeters,
    algorithmVersion: EARTH_PARCEL_ALGORITHM_VERSION,
    edgePolicy: "FULL_CELL",
  }, { bbox: normalized.bbox, zoom: 18, limit: 500 });

  process.stdout.write(`${JSON.stringify({
    environment: "development",
    database: path.basename(databasePath),
    schema: schema.changed ? "applied-after-backup" : "already-current",
    backup: schema.backup,
    geography,
    actor: actor.email,
    zone: {
      id: result.zone.publicId,
      versionId: result.version.publicId,
      status: "ACTIVE",
      action: result.action,
      synthetic: true,
      authenticLagosLand: false,
      plots: plots.items.length,
      dimensionsMeters: [25, 25],
      areaSquareMeters: 625,
    },
    explorerUrl: `http://localhost:3020/earth/geography?place=${encodeURIComponent(lagos.publicId)}`,
    notice: "Synthetic SIMVERSE test geometry only; no real-world land rights or acquisition.",
  }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
