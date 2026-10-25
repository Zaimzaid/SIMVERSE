import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  EarthBoundaryQuality,
  EarthPlaceKind,
  EarthVerificationStatus,
} from "./constants.ts";
import {
  EARTH_BOUNDARY_QUALITIES,
  EARTH_CRS_WGS84,
  EARTH_PLACE_KINDS,
  EARTH_VERIFICATION_STATUSES,
} from "./constants.ts";

type Position = [number, number];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];

export type EarthSourceGeometry =
  | { type: "Point"; coordinates: Position }
  | { type: "Polygon"; coordinates: PolygonCoordinates }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates };

interface GeoJsonFeature {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: EarthSourceGeometry;
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

interface SourceLayerManifest {
  level: string;
  boundaryId?: string;
  boundaryYearRepresented?: string;
  buildDate?: string;
  sourceName?: string;
  sourceUrl?: string;
  file: string;
  sha256: string;
  featureCount: number;
  geometryDetail: string;
  boundaryQuality: EarthBoundaryQuality;
}

export interface EarthSourceCountryCoverage {
  name: string;
  isoAlpha2: string;
  isoAlpha3: string;
}

export type EarthSourceAdapter = "GEOBOUNDARIES" | "GEONAMES_SUPPORTED_LOCALITIES";

export interface EarthSourceManifestEntry {
  providerKey: string;
  providerName: string;
  releaseType: string;
  versionKey: string;
  sourceRevision: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
  adapter: EarthSourceAdapter;
  verificationStatus: EarthVerificationStatus;
  coverage: EarthSourceCountryCoverage[];
  layers: SourceLayerManifest[];
}

interface EarthSourceManifest {
  schemaVersion: number;
  scope: string;
  coordinateReferenceSystem: string;
  sources: EarthSourceManifestEntry[];
}

export interface EarthImportPlaceRecord {
  datasetVersionKey: string;
  publicId: string;
  canonicalKey: string;
  parentCanonicalKey: string | null;
  kind: EarthPlaceKind;
  name: string;
  normalizedName: string;
  isoAlpha2: string | null;
  isoAlpha3: string | null;
  adminLevel: number | null;
  sourceProvider: string;
  sourceFeatureId: string;
  sourceBoundaryId: string | null;
  sourceName: string;
  geometryType: EarthSourceGeometry["type"];
  geometryGeoJson: string;
  bbox: { west: number; south: number; east: number; north: number };
  label: { longitude: number; latitude: number };
  coordinateReferenceSystem: typeof EARTH_CRS_WGS84;
  boundaryQuality: EarthBoundaryQuality;
  verificationStatus: EarthVerificationStatus;
  sourceProperties: string;
  contentHash: string;
}

export interface EarthGeographyBundle {
  manifest: EarthSourceManifest;
  manifestJson: string;
  manifestChecksum: string;
  sources: EarthSourceManifestEntry[];
  records: EarthImportPlaceRecord[];
}

export type NigeriaGeographyBundle = EarthGeographyBundle;

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEarthPlaceName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
}

export function earthPublicPlaceId(canonicalKey: string): string {
  return `geo_${sha256Text(canonicalKey).slice(0, 24)}`;
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function requiredString(object: Record<string, unknown>, key: string, label: string): string {
  const value = object[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}.${key} must be a non-empty string.`);
  return value.trim();
}

function validatePosition(value: unknown, label: string): asserts value is Position {
  if (!Array.isArray(value) || value.length < 2) throw new Error(`${label} must be a longitude/latitude position.`);
  const longitude = value[0];
  const latitude = value[1];
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`${label} longitude is outside WGS84 bounds.`);
  }
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`${label} latitude is outside WGS84 bounds.`);
  }
}

function positionsEqual(first: Position, last: Position): boolean {
  return first[0] === last[0] && first[1] === last[1];
}

function validateRing(value: unknown, label: string): asserts value is Position[] {
  if (!Array.isArray(value) || value.length < 4) throw new Error(`${label} must have at least four positions.`);
  value.forEach((position, index) => validatePosition(position, `${label}[${index}]`));
  const first = value[0];
  const last = value.at(-1);
  if (!first || !last || !positionsEqual(first, last)) throw new Error(`${label} must be closed.`);
}

export function validateEarthGeometry(value: unknown, label = "geometry"): asserts value is EarthSourceGeometry {
  assertRecord(value, label);
  const type = requiredString(value, "type", label);
  const coordinates = value.coordinates;
  if (type === "Point") {
    validatePosition(coordinates, `${label}.coordinates`);
    return;
  }
  if (type === "Polygon") {
    if (!Array.isArray(coordinates) || coordinates.length === 0) throw new Error(`${label} polygon has no rings.`);
    coordinates.forEach((ring, index) => validateRing(ring, `${label}.coordinates[${index}]`));
    return;
  }
  if (type === "MultiPolygon") {
    if (!Array.isArray(coordinates) || coordinates.length === 0) throw new Error(`${label} multipolygon has no polygons.`);
    coordinates.forEach((polygon, polygonIndex) => {
      if (!Array.isArray(polygon) || polygon.length === 0) throw new Error(`${label} polygon ${polygonIndex} has no rings.`);
      polygon.forEach((ring, ringIndex) => validateRing(ring, `${label}.coordinates[${polygonIndex}][${ringIndex}]`));
    });
    return;
  }
  throw new Error(`${label} uses unsupported geometry type ${type}.`);
}

function flattenPositions(geometry: EarthSourceGeometry): Position[] {
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  return geometry.coordinates.flat(2);
}

export function earthGeometryBounds(geometry: EarthSourceGeometry) {
  const positions = flattenPositions(geometry);
  if (!positions.length) throw new Error("Geometry has no coordinates.");
  let west = 180; let south = 90; let east = -180; let north = -90;
  for (const [longitude, latitude] of positions) {
    west = Math.min(west, longitude); east = Math.max(east, longitude);
    south = Math.min(south, latitude); north = Math.max(north, latitude);
  }
  return {
    west, south, east, north,
    label: { longitude: (west + east) / 2, latitude: (south + north) / 2 },
  };
}

function parseFeatureCollection(value: unknown, label: string): GeoJsonFeatureCollection {
  assertRecord(value, label);
  if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    throw new Error(`${label} must be a GeoJSON FeatureCollection.`);
  }
  const features = value.features.map((feature, index) => {
    assertRecord(feature, `${label}.features[${index}]`);
    if (feature.type !== "Feature") throw new Error(`${label}.features[${index}] must be a Feature.`);
    assertRecord(feature.properties, `${label}.features[${index}].properties`);
    validateEarthGeometry(feature.geometry, `${label}.features[${index}].geometry`);
    return feature as unknown as GeoJsonFeature;
  });
  return { type: "FeatureCollection", features };
}

function parseManifest(value: unknown): EarthSourceManifest {
  assertRecord(value, "manifest");
  if (value.schemaVersion !== 1 || value.coordinateReferenceSystem !== EARTH_CRS_WGS84 || !Array.isArray(value.sources)) {
    throw new Error("Unsupported Earth source manifest.");
  }
  const sources = value.sources.map((sourceValue, sourceIndex) => {
    assertRecord(sourceValue, `manifest.sources[${sourceIndex}]`);
    if (!Array.isArray(sourceValue.layers) || sourceValue.layers.length === 0) throw new Error("Every source needs at least one layer.");
    const layers = sourceValue.layers.map((layerValue, layerIndex) => {
      assertRecord(layerValue, `manifest.sources[${sourceIndex}].layers[${layerIndex}]`);
      const featureCount = layerValue.featureCount;
      if (!Number.isInteger(featureCount) || (featureCount as number) < 1) throw new Error("Layer featureCount must be positive.");
      const boundaryQuality = requiredString(layerValue, "boundaryQuality", "layer");
      if (!(EARTH_BOUNDARY_QUALITIES as readonly string[]).includes(boundaryQuality)) {
        throw new Error(`Layer uses unsupported boundary quality ${boundaryQuality}.`);
      }
      return {
        ...layerValue,
        level: requiredString(layerValue, "level", "layer"),
        file: requiredString(layerValue, "file", "layer"),
        sha256: requiredString(layerValue, "sha256", "layer"),
        featureCount: featureCount as number,
        geometryDetail: requiredString(layerValue, "geometryDetail", "layer"),
        boundaryQuality: boundaryQuality as EarthBoundaryQuality,
      } as SourceLayerManifest;
    });
    const adapter = requiredString(sourceValue, "adapter", "source");
    if (adapter !== "GEOBOUNDARIES" && adapter !== "GEONAMES_SUPPORTED_LOCALITIES") {
      throw new Error(`Source uses unsupported adapter ${adapter}.`);
    }
    const verificationStatus = requiredString(
      sourceValue,
      "verificationStatus",
      "source",
    );
    if (!(EARTH_VERIFICATION_STATUSES as readonly string[]).includes(verificationStatus)) {
      throw new Error(`Source uses unsupported verification status ${verificationStatus}.`);
    }
    if (!Array.isArray(sourceValue.coverage) || sourceValue.coverage.length === 0) {
      throw new Error("Every source needs at least one country coverage record.");
    }
    const coverage = sourceValue.coverage.map((coverageValue, coverageIndex) => {
      assertRecord(coverageValue, `source.coverage[${coverageIndex}]`);
      const country = {
        name: requiredString(coverageValue, "name", "country coverage"),
        isoAlpha2: requiredString(coverageValue, "isoAlpha2", "country coverage").toUpperCase(),
        isoAlpha3: requiredString(coverageValue, "isoAlpha3", "country coverage").toUpperCase(),
      };
      if (!/^[A-Z]{2}$/.test(country.isoAlpha2) || !/^[A-Z]{3}$/.test(country.isoAlpha3)) {
        throw new Error("Country coverage requires ISO alpha-2 and alpha-3 identifiers.");
      }
      return country;
    });
    if (new Set(coverage.map((country) => country.isoAlpha3)).size !== coverage.length) {
      throw new Error("Source country coverage contains a duplicate ISO alpha-3 identifier.");
    }
    return {
      ...sourceValue,
      providerKey: requiredString(sourceValue, "providerKey", "source"),
      providerName: requiredString(sourceValue, "providerName", "source"),
      releaseType: requiredString(sourceValue, "releaseType", "source"),
      versionKey: requiredString(sourceValue, "versionKey", "source"),
      sourceRevision: requiredString(sourceValue, "sourceRevision", "source"),
      sourceUrl: requiredString(sourceValue, "sourceUrl", "source"),
      licenseName: requiredString(sourceValue, "licenseName", "source"),
      licenseUrl: requiredString(sourceValue, "licenseUrl", "source"),
      attribution: requiredString(sourceValue, "attribution", "source"),
      adapter,
      verificationStatus: verificationStatus as EarthVerificationStatus,
      coverage,
      layers,
    } as EarthSourceManifestEntry;
  });
  return {
    schemaVersion: 1,
    scope: requiredString(value, "scope", "manifest"),
    coordinateReferenceSystem: EARTH_CRS_WGS84,
    sources,
  };
}

function revisionRecord(input: Omit<EarthImportPlaceRecord, "normalizedName" | "geometryType" | "geometryGeoJson" | "bbox" | "label" | "coordinateReferenceSystem" | "sourceProperties" | "contentHash"> & {
  geometry: EarthSourceGeometry;
  sourceProperties: Record<string, unknown>;
}): EarthImportPlaceRecord {
  const geometryGeoJson = stableStringify(input.geometry);
  const bounds = earthGeometryBounds(input.geometry);
  const sourceProperties = stableStringify(input.sourceProperties);
  const core = {
    ...input,
    normalizedName: normalizeEarthPlaceName(input.name),
    geometryType: input.geometry.type,
    geometryGeoJson,
    bbox: { west: bounds.west, south: bounds.south, east: bounds.east, north: bounds.north },
    label: bounds.label,
    coordinateReferenceSystem: EARTH_CRS_WGS84,
    sourceProperties,
  };
  return { ...core, contentHash: `sha256:${sha256Text(stableStringify(core))}` };
}

async function readCheckedLayer(sourceRoot: string, layer: SourceLayerManifest): Promise<GeoJsonFeatureCollection> {
  const resolved = path.resolve(sourceRoot, layer.file);
  const rootPrefix = `${path.resolve(sourceRoot)}${path.sep}`;
  if (!resolved.startsWith(rootPrefix)) throw new Error(`Source path escapes source root: ${layer.file}`);
  const content = await readFile(resolved, "utf8");
  const actualChecksum = sha256Text(content);
  if (actualChecksum !== layer.sha256) throw new Error(`Checksum mismatch for ${layer.file}.`);
  const collection = parseFeatureCollection(JSON.parse(content), layer.file);
  if (collection.features.length !== layer.featureCount) throw new Error(`Feature count mismatch for ${layer.file}.`);
  return collection;
}

function coveredCountry(
  source: EarthSourceManifestEntry,
  isoAlpha3Input: string,
  label: string,
): EarthSourceCountryCoverage {
  const isoAlpha3 = isoAlpha3Input.toUpperCase();
  const country = source.coverage.find((candidate) => candidate.isoAlpha3 === isoAlpha3);
  if (!country) {
    throw new Error(label + " references country " + isoAlpha3 + " outside source coverage.");
  }
  return country;
}

function boundaryCanonicalKey(
  source: EarthSourceManifestEntry,
  country: EarthSourceCountryCoverage,
  level: "ADM0" | "ADM1",
  shapeIso: string,
): string {
  return [
    source.providerKey,
    country.isoAlpha3,
    level,
    shapeIso.toUpperCase(),
  ].join(":");
}

function supportedLocalityKind(properties: Record<string, unknown>): EarthPlaceKind {
  const kind = properties.placeKind;
  if (
    typeof kind === "string"
    && (EARTH_PLACE_KINDS as readonly string[]).includes(kind)
    && kind !== "COUNTRY"
    && kind !== "ADMIN1"
    && kind !== "ADMIN2"
  ) {
    return kind as EarthPlaceKind;
  }
  return "CITY";
}

/**
 * Read any supported manifest-driven geography bundle. Country-specific
 * acceptance rules live in wrappers such as readNigeriaGeographyBundle.
 */
export async function readEarthGeographyBundle(
  projectRoot = process.cwd(),
  manifestRelativePath = path.join("data", "earth", "sources", "manifest.json"),
): Promise<EarthGeographyBundle> {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const manifestPath = path.resolve(resolvedProjectRoot, manifestRelativePath);
  const rootPrefix = resolvedProjectRoot + path.sep;
  if (manifestPath !== resolvedProjectRoot && !manifestPath.startsWith(rootPrefix)) {
    throw new Error("Earth source manifest path escapes the project root.");
  }

  const sourceRoot = path.dirname(manifestPath);
  const manifestJson = await readFile(manifestPath, "utf8");
  const manifest = parseManifest(JSON.parse(manifestJson));
  const records: EarthImportPlaceRecord[] = [];
  const countryCanonicalByProvider = new Map<string, string>();
  const stateCanonicalByIso = new Map<string, string>();

  for (const source of manifest.sources.filter(
    (candidate) => candidate.adapter === "GEOBOUNDARIES",
  )) {
    const adm0Layers = source.layers.filter((layer) => layer.level === "ADM0");
    if (adm0Layers.length === 0) {
      throw new Error("Boundary source " + source.providerKey + " has no ADM0 layer.");
    }

    for (const layer of adm0Layers) {
      const collection = await readCheckedLayer(sourceRoot, layer);
      for (const feature of collection.features) {
        if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") {
          throw new Error("Every ADM0 feature must have sourced polygon geometry.");
        }
        const shapeGroup = requiredString(feature.properties, "shapeGroup", "ADM0 properties")
          .toUpperCase();
        const shapeIso = requiredString(feature.properties, "shapeISO", "ADM0 properties")
          .toUpperCase();
        const shapeId = requiredString(feature.properties, "shapeID", "ADM0 properties");
        const country = coveredCountry(source, shapeGroup, "ADM0 feature");
        const canonicalKey = boundaryCanonicalKey(source, country, "ADM0", shapeIso);
        const countryMapKey = source.providerKey + ":" + country.isoAlpha3;
        if (countryCanonicalByProvider.has(countryMapKey)) {
          throw new Error("Duplicate ADM0 country identity " + countryMapKey + ".");
        }
        countryCanonicalByProvider.set(countryMapKey, canonicalKey);
        records.push(revisionRecord({
          datasetVersionKey: source.versionKey,
          publicId: earthPublicPlaceId(canonicalKey),
          canonicalKey,
          parentCanonicalKey: null,
          kind: "COUNTRY",
          name: country.name,
          isoAlpha2: country.isoAlpha2,
          isoAlpha3: country.isoAlpha3,
          adminLevel: 0,
          sourceProvider: source.providerKey,
          sourceFeatureId: shapeId,
          sourceBoundaryId: layer.boundaryId ?? null,
          sourceName: layer.sourceName ?? source.providerName,
          geometry: feature.geometry,
          boundaryQuality: layer.boundaryQuality,
          verificationStatus: source.verificationStatus,
          sourceProperties: feature.properties,
        }));
      }
    }

    for (const layer of source.layers.filter((candidate) => candidate.level === "ADM1")) {
      const collection = await readCheckedLayer(sourceRoot, layer);
      for (const feature of collection.features) {
        if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") {
          throw new Error("Every ADM1 feature must have sourced polygon geometry.");
        }
        const shapeGroup = requiredString(feature.properties, "shapeGroup", "ADM1 properties")
          .toUpperCase();
        const shapeIso = requiredString(feature.properties, "shapeISO", "ADM1 properties")
          .toUpperCase();
        const shapeId = requiredString(feature.properties, "shapeID", "ADM1 properties");
        const name = requiredString(feature.properties, "shapeName", "ADM1 properties");
        const country = coveredCountry(source, shapeGroup, "ADM1 feature");
        const parentCanonicalKey = countryCanonicalByProvider.get(
          source.providerKey + ":" + country.isoAlpha3,
        );
        if (!parentCanonicalKey) {
          throw new Error("ADM1 feature " + shapeIso + " has no imported ADM0 parent.");
        }
        const stateMapKey = country.isoAlpha3 + ":" + shapeIso;
        if (stateCanonicalByIso.has(stateMapKey)) {
          throw new Error("Duplicate ADM1 identity " + stateMapKey + ".");
        }
        const canonicalKey = boundaryCanonicalKey(source, country, "ADM1", shapeIso);
        stateCanonicalByIso.set(stateMapKey, canonicalKey);
        records.push(revisionRecord({
          datasetVersionKey: source.versionKey,
          publicId: earthPublicPlaceId(canonicalKey),
          canonicalKey,
          parentCanonicalKey,
          kind: "ADMIN1",
          name,
          isoAlpha2: country.isoAlpha2,
          isoAlpha3: country.isoAlpha3,
          adminLevel: 1,
          sourceProvider: source.providerKey,
          sourceFeatureId: shapeId,
          sourceBoundaryId: layer.boundaryId ?? null,
          sourceName: layer.sourceName ?? source.providerName,
          geometry: feature.geometry,
          boundaryQuality: layer.boundaryQuality,
          verificationStatus: source.verificationStatus,
          sourceProperties: feature.properties,
        }));
      }
    }
  }

  for (const source of manifest.sources.filter(
    (candidate) => candidate.adapter === "GEONAMES_SUPPORTED_LOCALITIES",
  )) {
    const localityLayers = source.layers.filter(
      (layer) => layer.level === "SUPPORTED_LOCALITIES",
    );
    if (localityLayers.length === 0) {
      throw new Error("Locality source " + source.providerKey + " has no locality layer.");
    }
    for (const layer of localityLayers) {
      if (layer.boundaryQuality !== "POINT_ONLY") {
        throw new Error("Supported GeoNames localities must be declared POINT_ONLY.");
      }
      const collection = await readCheckedLayer(sourceRoot, layer);
      for (const feature of collection.features) {
        if (feature.geometry.type !== "Point") {
          throw new Error("Supported locality records must remain point-only.");
        }
        const geonameId = requiredString(
          feature.properties,
          "geonameId",
          "locality properties",
        );
        const name = requiredString(feature.properties, "name", "locality properties");
        const countryIsoAlpha3 = requiredString(
          feature.properties,
          "countryIsoAlpha3",
          "locality properties",
        ).toUpperCase();
        const countryCode = requiredString(
          feature.properties,
          "countryCode",
          "locality properties",
        ).toUpperCase();
        const parentShapeIso = requiredString(
          feature.properties,
          "parentShapeISO",
          "locality properties",
        ).toUpperCase();
        const country = coveredCountry(source, countryIsoAlpha3, "Locality " + name);
        if (country.isoAlpha2 !== countryCode) {
          throw new Error("Locality " + name + " has inconsistent country identifiers.");
        }
        const parentCanonicalKey = stateCanonicalByIso.get(
          country.isoAlpha3 + ":" + parentShapeIso,
        );
        if (!parentCanonicalKey) {
          throw new Error(
            "Locality " + name + " references unknown ADM1 " + parentShapeIso + ".",
          );
        }
        const canonicalKey = source.providerKey + ":" + geonameId;
        records.push(revisionRecord({
          datasetVersionKey: source.versionKey,
          publicId: earthPublicPlaceId(canonicalKey),
          canonicalKey,
          parentCanonicalKey,
          kind: supportedLocalityKind(feature.properties),
          name,
          isoAlpha2: country.isoAlpha2,
          isoAlpha3: country.isoAlpha3,
          adminLevel: null,
          sourceProvider: source.providerKey,
          sourceFeatureId: geonameId,
          sourceBoundaryId: null,
          sourceName: source.providerName,
          geometry: feature.geometry,
          boundaryQuality: layer.boundaryQuality,
          verificationStatus: source.verificationStatus,
          sourceProperties: feature.properties,
        }));
      }
    }
  }

  const canonicalKeys = new Set<string>();
  const publicIds = new Set<string>();
  for (const record of records) {
    if (canonicalKeys.has(record.canonicalKey)) {
      throw new Error("Duplicate canonical key " + record.canonicalKey + ".");
    }
    if (publicIds.has(record.publicId)) {
      throw new Error("Duplicate public place ID " + record.publicId + ".");
    }
    canonicalKeys.add(record.canonicalKey);
    publicIds.add(record.publicId);
  }
  if (records.length === 0) throw new Error("Earth source manifest produced no places.");

  return {
    manifest,
    manifestJson,
    manifestChecksum: "sha256:" + sha256Text(manifestJson),
    sources: manifest.sources,
    records,
  };
}

/** Apply the Nigeria/Lagos Phase 2 acceptance rules to the generic importer. */
export async function readNigeriaGeographyBundle(
  projectRoot = process.cwd(),
): Promise<NigeriaGeographyBundle> {
  const bundle = await readEarthGeographyBundle(projectRoot);
  const nigeriaRecords = bundle.records.filter((record) => record.isoAlpha3 === "NGA");
  if (nigeriaRecords.filter((record) => record.kind === "COUNTRY").length !== 1) {
    throw new Error("Nigeria proof must contain one country feature.");
  }
  if (nigeriaRecords.filter((record) => record.kind === "ADMIN1").length !== 37) {
    throw new Error("Nigeria proof must contain all 37 ADM1 features.");
  }
  if (!nigeriaRecords.some(
    (record) => record.kind === "ADMIN1" && record.name === "Lagos",
  )) {
    throw new Error("Nigeria proof is missing Lagos State.");
  }
  if (!nigeriaRecords.some(
    (record) => record.kind === "CITY"
      && record.name === "Lagos"
      && record.boundaryQuality === "POINT_ONLY",
  )) {
    throw new Error("Nigeria proof is missing the point-only Lagos locality.");
  }
  return bundle;
}
