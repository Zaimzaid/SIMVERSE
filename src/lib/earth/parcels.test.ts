import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  EARTH_PARCEL_ALGORITHM_VERSION,
  deriveParcelCandidate,
  earthGeometryBbox,
  generateParcelViewport,
  parcelCanonicalKey,
  parcelPublicId,
  projectWgs84ToUtm,
  unprojectUtmToWgs84,
  validateEarthAreaGeometry,
  type EarthAreaGeometry,
  type EarthMetricPoint,
  type EarthParcelZoneDefinition,
  type EarthPolygonGeometry,
} from "./parcels";

const SRID = 32631;
const originWgs84: [number, number] = [3.4, 6.55];
const origin = projectWgs84ToUtm(originWgs84, SRID);

function point(easting: number, northing: number): [number, number] {
  return unprojectUtmToWgs84({
    easting: origin.easting + easting,
    northing: origin.northing + northing,
  }, SRID);
}

function rectangle(west: number, south: number, east: number, north: number): EarthPolygonGeometry {
  return {
    type: "Polygon",
    coordinates: [[
      point(west, south),
      point(east, south),
      point(east, north),
      point(west, north),
      point(west, south),
    ]],
  };
}

function zone(overrides: Partial<EarthParcelZoneDefinition> = {}): EarthParcelZoneDefinition {
  return {
    zoneId: "zone_0123456789abcdef01234567",
    zoneVersionId: "zonev_0123456789abcdef01234567",
    geometry: rectangle(0, 0, 250, 250),
    exclusions: [],
    projectionSrid: SRID,
    originEasting: origin.easting,
    originNorthing: origin.northing,
    bearingDegrees: 0,
    cellWidthMeters: 25,
    cellHeightMeters: 25,
    algorithmVersion: EARTH_PARCEL_ALGORITHM_VERSION,
    edgePolicy: "FULL_CELL",
    ...overrides,
  };
}

function metricDistance(first: EarthMetricPoint, second: EarthMetricPoint): number {
  return Math.hypot(first.easting - second.easting, first.northing - second.northing);
}

describe("Earth parcel grid v1", () => {
  it("derives exact metric 25 m by 25 m cells with stable identifiers", () => {
    const definition = zone();
    const first = deriveParcelCandidate(definition, 2, 3)!;
    const repeated = deriveParcelCandidate(definition, 2, 3)!;
    expect(first).toEqual(repeated);
    expect(first.id).toMatch(/^parcel_[0-9a-f]{32}$/);
    expect(first.areaSquareMeters).toBe(625);
    const ring = first.geometry.coordinates[0]!;
    const projected = ring.map((coordinate) => projectWgs84ToUtm(coordinate, SRID));
    expect(metricDistance(projected[0]!, projected[1]!)).toBeCloseTo(25, 5);
    expect(metricDistance(projected[1]!, projected[2]!)).toBeCloseTo(25, 5);
    expect(parcelPublicId(parcelCanonicalKey(definition.zoneVersionId, 2, 3))).toBe(first.id);
  });

  it("produces the same public parcel identifier in independent Node processes", () => {
    const source = [
      "import('./src/lib/earth/parcels.ts').then((module) =>",
      "process.stdout.write(module.parcelPublicId(module.parcelCanonicalKey(",
      "'zonev_0123456789abcdef01234567', -12, 44))))",
    ].join(" ");
    const run = () => execFileSync(process.execPath, [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      source,
    ], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    expect(run()).toBe(run());
    expect(run()).toMatch(/^parcel_[0-9a-f]{32}$/);
  });

  it("accepts only complete cells and supports configured rectangular plot sizes", () => {
    const partial = zone({ geometry: rectangle(0, 0, 74, 49) });
    expect(deriveParcelCandidate(partial, 0, 0)).not.toBeNull();
    expect(deriveParcelCandidate(partial, 2, 0)).toBeNull();
    expect(deriveParcelCandidate(partial, 0, 1)).toBeNull();

    const configured = zone({
      geometry: rectangle(0, 0, 100, 50),
      cellWidthMeters: 50,
      cellHeightMeters: 25,
    });
    expect(deriveParcelCandidate(configured, 0, 0)).toMatchObject({
      areaSquareMeters: 1_250,
      widthMeters: 50,
      heightMeters: 25,
    });
  });

  it("rejects exclusion intersections and polygon holes", () => {
    const withExclusion = zone({
      exclusions: [{
        id: "reserve",
        name: "Reserve",
        reason: "Test exclusion",
        geometry: rectangle(75, 75, 125, 125),
      }],
    });
    expect(deriveParcelCandidate(withExclusion, 0, 0)).not.toBeNull();
    expect(deriveParcelCandidate(withExclusion, 3, 3)).toBeNull();
    expect(deriveParcelCandidate(withExclusion, 2, 3)).toBeNull();

    const outer = rectangle(0, 0, 150, 150).coordinates[0]!;
    const hole = rectangle(50, 50, 100, 100).coordinates[0]!;
    const withHole = zone({ geometry: { type: "Polygon", coordinates: [outer, hole] } });
    expect(deriveParcelCandidate(withHole, 0, 0)).not.toBeNull();
    expect(deriveParcelCandidate(withHole, 2, 2)).toBeNull();
  });

  it("supports disjoint multipolygons without filling the gap", () => {
    const first = rectangle(0, 0, 50, 50).coordinates;
    const second = rectangle(100, 0, 150, 50).coordinates;
    const definition = zone({ geometry: { type: "MultiPolygon", coordinates: [first, second] } });
    expect(deriveParcelCandidate(definition, 0, 0)).not.toBeNull();
    expect(deriveParcelCandidate(definition, 2, 0)).toBeNull();
    expect(deriveParcelCandidate(definition, 4, 0)).not.toBeNull();
  });

  it("returns unique non-overlapping parcels in stable row/column order with pagination", () => {
    const definition = zone({ geometry: rectangle(0, 0, 150, 150) });
    const bbox = earthGeometryBbox(definition.geometry);
    const first = generateParcelViewport(definition, { bbox, zoom: 18, limit: 7 });
    expect(first.items).toHaveLength(7);
    expect(first.next).not.toBeNull();
    const second = generateParcelViewport(definition, {
      bbox,
      zoom: 18,
      limit: 100,
      after: first.next,
    });
    const items = [...first.items, ...second.items];
    expect(items).toHaveLength(36);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items.map((item) => [item.row, item.column])).toEqual(
      [...items].sort((a, b) => a.row - b.row || a.column - b.column)
        .map((item) => [item.row, item.column]),
    );
  });

  it("rejects low zoom and high-density requests before unbounded generation", () => {
    const definition = zone({ geometry: rectangle(0, 0, 5_000, 5_000) });
    const bbox = earthGeometryBbox(definition.geometry);
    expect(() => generateParcelViewport(definition, { bbox, zoom: 15 }))
      .toThrow(/zoom 16/);
    expect(() => generateParcelViewport(definition, { bbox, zoom: 18 }))
      .toThrow(/too broad/);
  });

  it("rejects self-intersection, overlapping multipolygons and unsupported projections", () => {
    const bowTie: EarthAreaGeometry = {
      type: "Polygon",
      coordinates: [[point(0, 0), point(100, 100), point(0, 100), point(100, 0), point(0, 0)]],
    };
    expect(() => validateEarthAreaGeometry(bowTie, SRID)).toThrow(/self-intersects|no measurable area/);

    const overlap: EarthAreaGeometry = {
      type: "MultiPolygon",
      coordinates: [rectangle(0, 0, 100, 100).coordinates, rectangle(50, 50, 150, 150).coordinates],
    };
    expect(() => validateEarthAreaGeometry(overlap, SRID)).toThrow(/overlapping/);
    expect(() => validateEarthAreaGeometry(rectangle(0, 0, 100, 100), 3857))
      .toThrow(/UTM/);
  });

  it("rejects antimeridian and out-of-zone coordinates rather than approximating", () => {
    const antimeridian: EarthAreaGeometry = {
      type: "Polygon",
      coordinates: [[
        [179.9, 0], [-179.9, 0], [-179.9, 0.1], [179.9, 0.1], [179.9, 0],
      ]],
    };
    expect(() => validateEarthAreaGeometry(antimeridian, 32660)).toThrow(/antimeridian/);
    expect(() => projectWgs84ToUtm([12, 6.5], SRID)).toThrow(/outside the reviewed UTM zone/);
    expect(() => projectWgs84ToUtm([3, -1], SRID)).toThrow(/hemisphere/);
  });
});
