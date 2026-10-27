import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import {
  earthPublicPlaceId, normalizeEarthPlaceName, sha256Text, stableStringify,
  validateEarthGeometry,
} from "../src/lib/earth/import.ts";
import { pointInEarthRegion } from "../src/lib/earth/admin-parent.ts";
import { selectGeoNamesSettlements } from "../src/lib/earth/settlements.ts";
import { importEarthGeographyBundle } from "../src/server/services/earth-geography-import-service.ts";

const root = path.resolve(import.meta.dirname, "..");

function fail(message) { throw new Error(`[earth:import:settlements] ${message}`); }
function argsFromCommandLine(argv) {
  const result = { file: null, sha256: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    if (argument === "--dry-run") result.dryRun = true;
    else if (argument === "--file") result.file = argv[++i];
    else if (argument === "--expected-sha256") result.sha256 = argv[++i];
    else fail(`Unrecognized option ${argument}`);
  }
  if (!result.file) fail("Provide --file with the extracted GeoNames Nigeria NG.txt.");
  if (!result.dryRun && !/^[0-9a-f]{64}$/i.test(result.sha256 ?? "")) {
    fail("Writing requires --expected-sha256 copied from a successful --dry-run.");
  }
  return result;
}
function verifyDevDb() {
  if (process.env.NODE_ENV?.toLowerCase() === "production") {
    fail("This importer is restricted to local development.");
  }
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:") || /[?#]/.test(url)) {
    fail("Use a local SQLite DATABASE_URL.");
  }
  const database = path.resolve(root, decodeURIComponent(url.slice(5)));
  if (database.toLowerCase() !== path.join(root, "dev.db").toLowerCase()) {
    fail("Only repository-local dev.db is permitted.");
  }
  return { url, database };
}
async function backupDatabase(database) {
  const db = new Database(database);
  try {
    const folder = path.join(tmpdir(), "simverse-development-backups");
    mkdirSync(folder, { recursive: true });
    const backup = path.join(folder, `dev-before-geonames-settlements-${new Date().toISOString().replaceAll(":", "-")}.db`);
    await db.backup(backup);
    return backup;
  } finally {
    db.close();
  }
}

const options = argsFromCommandLine(process.argv.slice(2));
const { url, database } = verifyDevDb();
const inputPath = path.resolve(root, options.file);
if (path.extname(inputPath).toLowerCase() !== ".txt") {
  fail("Provide the extracted NG.txt, not a ZIP, binary, or another document.");
}
const fileStat = await stat(inputPath);
if (!fileStat.isFile() || fileStat.size > 80_000_000) {
  fail("GeoNames input must be a plain UTF-8 text file smaller than 80 MB.");
}
const file = await readFile(inputPath);
const checksum = createHash("sha256").update(file).digest("hex");
if (options.sha256 && checksum.toLowerCase() !== options.sha256.toLowerCase()) {
  fail("The input checksum differs from the approved dry run. Nothing was imported.");
}
const content = file.toString("utf8");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

try {
  const state = await prisma.earthGeoPlace.findFirst({
    where: { kind: "ADMIN1", name: "Lagos", isoAlpha3: "NGA", sourceProvider: "geoboundaries" },
    include: {
      revisions: {
        where: { isCurrent: true, datasetVersion: { status: "ACTIVE" } },
        take: 1,
      },
    },
  });
  if (!state?.revisions[0]?.geometryGeoJson) {
    fail("Import reviewed Nigeria source geography before the Lagos settlements pilot.");
  }
  const stateGeometry = JSON.parse(state.revisions[0].geometryGeoJson);
  validateEarthGeometry(stateGeometry, "Lagos State sourced polygon");
  if (stateGeometry.type === "Point") fail("State cannot be represented by a point.");

  // One bounded pilot state, not an unreviewed all-Nigeria gazetteer import.
  const settlements = selectGeoNamesSettlements(
    content, (position) => pointInEarthRegion(position, stateGeometry), 80,
  );
  if (!settlements.length) fail("No GeoNames populated places were found within Lagos State.");

  const versionKey = `geonames-lagos-populated-${checksum.slice(0, 16)}-80`;
  const records = settlements.map((entry) => {
    // Preserve the stable GeoNames ID used in the original Lagos proof.
    const canonicalKey = `geonames:${entry.geonameId}`;
    const geometry = { type: "Point", coordinates: [entry.longitude, entry.latitude] };
    const sourceProperties = {
      geonameId: entry.geonameId,
      name: entry.name,
      featureClass: "P",
      featureCode: entry.featureCode,
      population: entry.population,
      admin1Code: entry.admin1Code,
      sourceModifiedDate: entry.modifiedDate,
      pointOnly: true,
      settlementDisplayKindDerivedBySimverse: true,
    };
    const record = {
      datasetVersionKey: versionKey,
      publicId: earthPublicPlaceId(canonicalKey),
      canonicalKey,
      parentCanonicalKey: state.canonicalKey,
      kind: entry.kind,
      name: entry.name,
      normalizedName: normalizeEarthPlaceName(entry.name),
      isoAlpha2: "NG",
      isoAlpha3: "NGA",
      adminLevel: null,
      sourceProvider: "geonames",
      sourceFeatureId: entry.geonameId,
      sourceBoundaryId: null,
      sourceName: "GeoNames",
      geometryType: "Point",
      geometryGeoJson: stableStringify(geometry),
      bbox: {
        west: entry.longitude, south: entry.latitude,
        east: entry.longitude, north: entry.latitude,
      },
      label: { longitude: entry.longitude, latitude: entry.latitude },
      coordinateReferenceSystem: "EPSG:4326",
      boundaryQuality: "POINT_ONLY",
      verificationStatus: "VERIFIED_SOURCE",
      sourceProperties: stableStringify(sourceProperties),
    };
    return { ...record, contentHash: `sha256:${sha256Text(stableStringify(record))}` };
  });
  const source = {
    providerKey: "geonames",
    providerName: "GeoNames",
    releaseType: "nigeria-lagos-populated-places",
    versionKey,
    sourceRevision: `NG.txt sha256 ${checksum}`,
    sourceUrl: "https://download.geonames.org/export/dump/NG.zip",
    licenseName: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "GeoNames (https://www.geonames.org/)",
    adapter: "GEONAMES_SUPPORTED_LOCALITIES",
    verificationStatus: "VERIFIED_SOURCE",
    coverage: [{ name: "Nigeria", isoAlpha2: "NG", isoAlpha3: "NGA" }],
    layers: [{
      level: "SUPPORTED_LOCALITIES", file: "locally-reviewed-NG.txt",
      sha256: checksum, featureCount: records.length,
      geometryDetail: "GeoNames sourced points; no city or town polygons",
      boundaryQuality: "POINT_ONLY",
    }],
  };
  const manifest = {
    schemaVersion: 1, scope: "Lagos city and town POINT_ONLY pilot",
    coordinateReferenceSystem: "EPSG:4326", sources: [source],
  };
  const manifestJson = stableStringify(manifest);
  const report = {
    mode: options.dryRun ? "dry-run" : "write",
    checksum,
    source: source.sourceUrl,
    LagosStateId: state.publicId,
    count: records.length,
    cityCount: records.filter((row) => row.kind === "CITY").length,
    townCount: records.filter((row) => row.kind === "TOWN").length,
    localityCount: records.filter((row) => row.kind === "LOCALITY").length,
    note: "GeoNames populated-place points only, never surveyed city/town boundaries.",
  };
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const backup = await backupDatabase(database);
    const imported = await importEarthGeographyBundle(prisma, {
      manifest,
      manifestJson,
      manifestChecksum: `sha256:${sha256Text(manifestJson)}`,
      sources: [source],
      records,
    });
    process.stdout.write(`${JSON.stringify({ ...report, backup, imported }, null, 2)}\n`);
  }
} finally {
  await prisma.$disconnect();
}
