import "dotenv/config";
import { mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import {
  earthGeometryBounds,
  earthPublicPlaceId,
  normalizeEarthPlaceName,
  sha256Text,
  stableStringify,
  validateEarthGeometry,
} from "../src/lib/earth/import.ts";
import { matchEarthParentRegion } from "../src/lib/earth/admin-parent.ts";
import { importEarthGeographyBundle } from "../src/server/services/earth-geography-import-service.ts";

// Pinned to exactly the same immutable geoBoundaries source revision as Phase 2.
// This is geographic research data, NOT real-world land ownership inventory.
const SOURCE_REVISION = "9469f09";
// The source metadata's boundary identifier needs independent verification.
const SOURCE_BOUNDARY_ID = null;
const SOURCE_GEOJSON_SHA256 = "daac9ba2c98f0d8984085c8a5b3a5301fca362f3ca37e6ac7dfcc7633719fc1d";
const SOURCE_GEOJSON_BYTES = 3717494;
const SOURCE_URL = `https://github.com/wmgeolab/geoBoundaries/raw/${SOURCE_REVISION}/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2_simplified.geojson`;
const EXPECTED_LGAS = 774;
const projectRoot = path.resolve(import.meta.dirname, "..");

function fail(message) {
  throw new Error(`[earth:import:adm2] ${message}`);
}

const args = process.argv.slice(2);
if (args.some((argument) => argument !== "--dry-run")) {
  fail("Only --dry-run is supported as an optional argument.");
}
const dryRun = args.includes("--dry-run");
const url = process.env.DATABASE_URL;
if ((process.env.NODE_ENV ?? "development").toLowerCase() === "production") {
  fail("ADM2 import is disabled in production.");
}
if (!url?.startsWith("file:") || /[?#]/.test(url)) {
  fail("A local development SQLite DATABASE_URL is required.");
}
const databasePath = path.resolve(projectRoot, decodeURIComponent(url.slice(5)));
if (databasePath.toLowerCase() !== path.join(projectRoot, "dev.db").toLowerCase()) {
  fail("Refusing to modify anything other than repository-local dev.db.");
}
try {
  await stat(databasePath);
} catch {
  fail("Development database is missing. Run the ordinary geography import first.");
}
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function downloadPinnedGeoJson() {
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "SIMVERSE-Earth-Development/4.5 (https://github.com/wmgeolab/geoBoundaries)" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) fail(`Pinned LGA source unavailable: HTTP ${response.status}`);
  const size = Number(response.headers.get("content-length") ?? 0);
  if (size > 60_000_000) fail("LGA source exceeds the 60 MB safety limit.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 60_000_000) fail("LGA download exceeded the safety limit.");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== SOURCE_GEOJSON_BYTES || digest !== SOURCE_GEOJSON_SHA256) {
    fail("Pinned ADM2 bytes do not match the reviewed Git LFS SHA-256 and size. No data was imported.");
  }
  const body = bytes.toString("utf8");
  let geojson;
  try { geojson = JSON.parse(body); } catch { fail("LGA download is not valid JSON."); }
  if (geojson?.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    fail("LGA source is not a GeoJSON FeatureCollection.");
  }
  if (geojson.features.length !== EXPECTED_LGAS) {
    fail(`Expected ${EXPECTED_LGAS} sourced LGAs, received ${geojson.features.length}.`);
  }
  return { geojson, checksum: SOURCE_GEOJSON_SHA256 };
}

async function getSourceStates() {
  const records = await prisma.earthGeoPlace.findMany({
    where: { kind: "ADMIN1", isoAlpha3: "NGA", sourceProvider: "geoboundaries" },
    include: { revisions: {
      where: { isCurrent: true, datasetVersion: { status: "ACTIVE" } },
      take: 1,
    } },
  });
  if (records.length !== 37 || records.some((row) => !row.revisions[0]?.geometryGeoJson)) {
    fail("All 37 sourced Nigeria state/FCT polygons must be imported before ADM2.");
  }
  return records.map((row) => {
    const geometry = JSON.parse(row.revisions[0].geometryGeoJson);
    validateEarthGeometry(geometry, `state ${row.name}`);
    if (geometry.type === "Point") fail(`State ${row.name} has point-only geometry.`);
    return { key: row.canonicalKey, name: row.name, geometry };
  });
}

async function backupLocalDb() {
  const sqlite = new Database(databasePath);
  try {
    const directory = path.join(tmpdir(), "simverse-development-backups");
    mkdirSync(directory, { recursive: true });
    const filename = `dev-before-earth-adm2-${new Date().toISOString().replaceAll(":", "-")}.db`;
    const destination = path.join(directory, filename);
    await sqlite.backup(destination);
    return destination;
  } finally {
    sqlite.close();
  }
}

try {
  const states = await getSourceStates();
  const { geojson, checksum } = await downloadPinnedGeoJson();
  const stateTotals = new Map();
  const seen = new Set();
  const versionKey = `gbopen-nga-adm2-${SOURCE_REVISION}`;
  const records = geojson.features.map((feature, index) => {
    const props = feature?.properties;
    if (feature?.type !== "Feature" || !props || typeof props !== "object") {
      fail(`LGA feature ${index} is malformed.`);
    }
    const shapeId = props.shapeID, name = props.shapeName;
    if (typeof shapeId !== "string" || !shapeId.trim() || typeof name !== "string" || !name.trim()) {
      fail(`LGA feature ${index} has no sourced shapeID or shapeName.`);
    }
    if (props.shapeGroup !== "NGA" || props.shapeType !== "ADM2") {
      fail(`LGA ${name} has unexpected country/type metadata.`);
    }
    if (seen.has(shapeId)) fail(`Duplicate LGA shapeID ${shapeId}.`);
    seen.add(shapeId);
    validateEarthGeometry(feature.geometry, `LGA ${name}`);
    if (feature.geometry.type === "Point") fail(`LGA ${name} is not a sourced polygon.`);
    let parent;
    try {
      parent = matchEarthParentRegion(feature.geometry, states);
    } catch (error) {
      fail(`Cannot safely assign ${name} (${shapeId}) to a state: ${error.message}`);
    }
    stateTotals.set(parent.name, (stateTotals.get(parent.name) ?? 0) + 1);
    const canonicalKey = `geoboundaries-adm2:NGA:ADM2:${shapeId}`;
    const geometry = stableStringify(feature.geometry);
    const bounds = earthGeometryBounds(feature.geometry);
    const record = {
      datasetVersionKey: versionKey,
      publicId: earthPublicPlaceId(canonicalKey),
      canonicalKey,
      parentCanonicalKey: parent.key,
      kind: "ADMIN2",
      name: name.trim(),
      normalizedName: normalizeEarthPlaceName(name),
      isoAlpha2: "NG",
      isoAlpha3: "NGA",
      adminLevel: 2,
      sourceProvider: "geoboundaries-adm2",
      sourceFeatureId: shapeId,
      sourceBoundaryId: SOURCE_BOUNDARY_ID,
      sourceName: "GRID3",
      geometryType: feature.geometry.type,
      geometryGeoJson: geometry,
      bbox: { west: bounds.west, south: bounds.south, east: bounds.east, north: bounds.north },
      label: bounds.label,
      coordinateReferenceSystem: "EPSG:4326",
      boundaryQuality: "GENERALIZED_BOUNDARY",
      verificationStatus: "VERIFIED_SOURCE",
      sourceProperties: stableStringify(props),
    };
    return { ...record, contentHash: `sha256:${sha256Text(stableStringify(record))}` };
  });
  if (stateTotals.size !== 37) fail("Not all 37 states/FCT received LGA matches. Manual source review required.");
  const source = {
    providerKey: "geoboundaries-adm2",
    providerName: "geoBoundaries Nigeria ADM2",
    releaseType: "gbOpen-adm2",
    versionKey,
    sourceRevision: SOURCE_REVISION,
    sourceUrl: SOURCE_URL,
    licenseName: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "geoBoundaries; underlying Nigerian LGA polygons from GRID3",
    adapter: "GEOBOUNDARIES",
    verificationStatus: "VERIFIED_SOURCE",
    coverage: [{ name: "Nigeria", isoAlpha2: "NG", isoAlpha3: "NGA" }],
    layers: [{
      level: "ADM2", boundaryId: SOURCE_BOUNDARY_ID,
      file: "pinned-github-remote", sha256: checksum,
      featureCount: EXPECTED_LGAS, geometryDetail: "source-provided simplified ADM2 polygons",
      boundaryQuality: "GENERALIZED_BOUNDARY",
    }],
  };
  const manifest = { schemaVersion: 1, scope: "Nigeria ADM2 Phase 4.5", coordinateReferenceSystem: "EPSG:4326", sources: [source] };
  const result = {
    dryRun, sourceRevision: SOURCE_REVISION, sha256: checksum,
    lgaCount: records.length,
    states: Object.fromEntries([...stateTotals.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const backup = await backupLocalDb();
    const imported = await importEarthGeographyBundle(prisma, {
      manifest, manifestJson: stableStringify(manifest),
      manifestChecksum: `sha256:${sha256Text(stableStringify(manifest))}`,
      sources: [source], records,
    });
    process.stdout.write(`${JSON.stringify({ ...result, backup, imported }, null, 2)}\n`);
  }
} finally {
  await prisma.$disconnect();
}
