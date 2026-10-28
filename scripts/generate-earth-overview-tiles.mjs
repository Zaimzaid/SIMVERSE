import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import geojsonVt from "geojson-vt";
import vtpbf from "vt-pbf";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const sourceRoot = path.join(projectRoot, "data", "earth", "overview", "v1");
const outputRoot = path.join(projectRoot, "public", "earth", "overview", "v1");
const allowedOutputRoot = path.join(projectRoot, "public", "earth", "overview") + path.sep;
const maxZoom = 2;
const extent = 4096;

if (!outputRoot.startsWith(allowedOutputRoot)) {
  throw new Error(`Refusing to replace unexpected output path: ${outputRoot}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const sourceManifest = JSON.parse(
  await readFile(path.join(sourceRoot, "manifest.json"), "utf8"),
);
const sourceBytes = await readFile(path.join(sourceRoot, sourceManifest.sourceFile));
const actualSourceHash = sha256(sourceBytes);
if (actualSourceHash !== sourceManifest.sourceSha256) {
  throw new Error(
    `Natural Earth source checksum mismatch: expected ${sourceManifest.sourceSha256}, got ${actualSourceHash}`,
  );
}

const parsed = JSON.parse(sourceBytes.toString("utf8"));
if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
  throw new Error("Natural Earth source must be a GeoJSON FeatureCollection.");
}

// The overview layer carries silhouettes only. Upstream properties are omitted
// so the public tiles cannot accidentally become an unreviewed detail API.
const safeOverview = {
  type: "FeatureCollection",
  features: parsed.features.map((feature) => ({
    type: "Feature",
    properties: {},
    geometry: feature.geometry,
  })),
};

const tileIndex = new geojsonVt(safeOverview, {
  maxZoom,
  indexMaxZoom: maxZoom,
  indexMaxPoints: 0,
  tolerance: 2,
  extent,
  buffer: 64,
});

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const tiles = [];
for (let z = 0; z <= maxZoom; z += 1) {
  const width = 2 ** z;
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < width; y += 1) {
      const tile = tileIndex.getTile(z, x, y) ?? { features: [] };
      const bytes = Buffer.from(vtpbf.fromGeojsonVt({ land: tile }, { extent }));
      const relativePath = `tiles/${z}/${x}/${y}.pbf`;
      const absolutePath = path.join(outputRoot, ...relativePath.split("/"));
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, bytes);
      tiles.push({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
}

const outputManifest = {
  schemaVersion: 1,
  id: sourceManifest.id,
  dataset: sourceManifest.dataset,
  layer: "land",
  scale: sourceManifest.scale,
  sourceVersion: sourceManifest.sourceVersion,
  sourceRevision: sourceManifest.sourceRevision,
  sourceUrl: sourceManifest.sourceUrl,
  licenseName: sourceManifest.licenseName,
  licenseUrl: sourceManifest.licenseUrl,
  attribution: sourceManifest.attribution,
  sourceSha256: sourceManifest.sourceSha256,
  tileFormat: "application/vnd.mapbox-vector-tile",
  tileTemplate: "/earth/overview/v1/tiles/{z}/{x}/{y}.pbf",
  minZoom: 0,
  maxZoom,
  extent,
  tileCount: tiles.length,
  totalBytes: tiles.reduce((sum, tile) => sum + tile.bytes, 0),
  generatedBy: "scripts/generate-earth-overview-tiles.mjs",
  tiles,
};

await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(outputManifest, null, 2)}\n`,
);

console.log(
  `Generated ${outputManifest.tileCount} Natural Earth MVT tiles (${outputManifest.totalBytes} bytes) at ${outputRoot}`,
);
