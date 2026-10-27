import { createHash } from "node:crypto";
import { ValidationError } from "../errors.ts";

export const EARTH_PARCEL_ALGORITHM_VERSION = "earth-parcel-grid-v1";
export const EARTH_DEFAULT_PARCEL_METERS = 25;
export const EARTH_DEFAULT_PARCEL_AREA_SQUARE_METERS = 625;
export const EARTH_PARCEL_VIEWPORT_MIN_ZOOM = 16;
export const EARTH_PARCEL_VIEWPORT_MAX_RESULTS = 500;
export const EARTH_PARCEL_VIEWPORT_DEFAULT_RESULTS = 200;
export const EARTH_PARCEL_VIEWPORT_MAX_CANDIDATES = 4_096;

export type EarthPosition = [number, number];
export type EarthRing = EarthPosition[];
export type EarthPolygonCoordinates = EarthRing[];

export interface EarthPolygonGeometry {
  type: "Polygon";
  coordinates: EarthPolygonCoordinates;
}

export interface EarthMultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: EarthPolygonCoordinates[];
}

export type EarthAreaGeometry = EarthPolygonGeometry | EarthMultiPolygonGeometry;

export interface EarthZoneExclusion {
  id: string;
  name: string;
  reason: string;
  geometry: EarthAreaGeometry;
}

export interface EarthMetricPoint {
  easting: number;
  northing: number;
}

export interface EarthParcelZoneDefinition {
  zoneId: string;
  zoneVersionId: string;
  geometry: EarthAreaGeometry;
  exclusions: EarthZoneExclusion[];
  projectionSrid: number;
  originEasting: number;
  originNorthing: number;
  bearingDegrees: number;
  cellWidthMeters: number;
  cellHeightMeters: number;
  algorithmVersion: string;
  edgePolicy: "FULL_CELL";
}

export interface EarthParcelCandidate {
  id: string;
  canonicalKey: string;
  zoneId: string;
  zoneVersionId: string;
  algorithmVersion: string;
  column: number;
  row: number;
  geometry: EarthPolygonGeometry;
  centroid: EarthPosition;
  areaSquareMeters: number;
  widthMeters: number;
  heightMeters: number;
}

export interface EarthParcelViewport {
  bbox: [number, number, number, number];
  zoom: number;
  limit?: number;
  after?: { row: number; column: number } | null;
}

export interface EarthParcelViewportResult {
  items: EarthParcelCandidate[];
  scannedCandidates: number;
  next: { row: number; column: number } | null;
}

const WGS84_A = 6_378_137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);
const UTM_SCALE = 0.9996;
const COORDINATE_EPSILON = 1e-10;
// UTM forward/inverse round-trips introduce sub-millimetre floating error.
// Compare metric geometry with a 2 mm boundary tolerance while parcel
// dimensions are expressed in whole metres.
const METRIC_TOLERANCE = 0.002;

interface UtmDefinition {
  zone: number;
  northern: boolean;
  centralMeridianDegrees: number;
}

interface MetricRing {
  points: EarthMetricPoint[];
}

interface MetricPolygon {
  rings: MetricRing[];
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function degrees(value: number): number {
  return value * 180 / Math.PI;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new ValidationError(`${label} must be finite.`);
  return value;
}

export function parseUtmSrid(srid: number): UtmDefinition {
  if (!Number.isInteger(srid)) throw new ValidationError("Projection SRID must be an integer.");
  const northern = srid >= 32601 && srid <= 32660;
  const southern = srid >= 32701 && srid <= 32760;
  if (!northern && !southern) {
    throw new ValidationError("Phase 4 supports reviewed WGS84 UTM projections only.");
  }
  const zone = srid % 100;
  return { zone, northern, centralMeridianDegrees: zone * 6 - 183 };
}

function normalizedLongitudeDelta(longitude: number, origin: number): number {
  let value = longitude - origin;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

export function longitudeToUtmZone(longitude: number): number {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ValidationError("Longitude is outside WGS84 bounds.");
  }
  return Math.min(60, Math.max(1, Math.floor((longitude + 180) / 6) + 1));
}

export function projectWgs84ToUtm(position: EarthPosition, srid: number): EarthMetricPoint {
  const definition = parseUtmSrid(srid);
  const longitude = finite(position[0], "Longitude");
  const latitude = finite(position[1], "Latitude");
  if (longitude < -180 || longitude > 180 || latitude < -80 || latitude > 84) {
    throw new ValidationError("Coordinate is outside the supported WGS84 UTM range.");
  }
  if (definition.northern !== (latitude >= 0)) {
    throw new ValidationError("Coordinate hemisphere does not match the projection SRID.");
  }
  if (Math.abs(normalizedLongitudeDelta(longitude, definition.centralMeridianDegrees)) > 3.1) {
    throw new ValidationError("Coordinate falls outside the reviewed UTM zone.");
  }

  const latitudeRadians = radians(latitude);
  const longitudeRadians = radians(longitude);
  const originRadians = radians(definition.centralMeridianDegrees);
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const tanLatitude = Math.tan(latitudeRadians);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLatitude * sinLatitude);
  const t = tanLatitude * tanLatitude;
  const c = WGS84_EP2 * cosLatitude * cosLatitude;
  const a = cosLatitude * (longitudeRadians - originRadians);
  const e4 = WGS84_E2 * WGS84_E2;
  const e6 = e4 * WGS84_E2;
  const meridionalArc = WGS84_A * (
    (1 - WGS84_E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latitudeRadians
    - (3 * WGS84_E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * latitudeRadians)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * latitudeRadians)
    - (35 * e6 / 3072) * Math.sin(6 * latitudeRadians)
  );
  const a2 = a * a;
  const a3 = a2 * a;
  const a4 = a2 * a2;
  const a5 = a4 * a;
  const a6 = a3 * a3;
  const easting = UTM_SCALE * n * (
    a + (1 - t + c) * a3 / 6
    + (5 - 18 * t + t * t + 72 * c - 58 * WGS84_EP2) * a5 / 120
  ) + 500_000;
  let northing = UTM_SCALE * (
    meridionalArc + n * tanLatitude * (
      a2 / 2
      + (5 - t + 9 * c + 4 * c * c) * a4 / 24
      + (61 - 58 * t + t * t + 600 * c - 330 * WGS84_EP2) * a6 / 720
    )
  );
  if (!definition.northern) northing += 10_000_000;
  return { easting, northing };
}

export function unprojectUtmToWgs84(point: EarthMetricPoint, srid: number): EarthPosition {
  const definition = parseUtmSrid(srid);
  const x = finite(point.easting, "Easting") - 500_000;
  let y = finite(point.northing, "Northing");
  if (!definition.northern) y -= 10_000_000;
  const e4 = WGS84_E2 * WGS84_E2;
  const e6 = e4 * WGS84_E2;
  const meridionalArc = y / UTM_SCALE;
  const mu = meridionalArc / (
    WGS84_A * (1 - WGS84_E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256)
  );
  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  const e12 = e1 * e1;
  const e13 = e12 * e1;
  const e14 = e12 * e12;
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e13 / 32) * Math.sin(2 * mu)
    + (21 * e12 / 16 - 55 * e14 / 32) * Math.sin(4 * mu)
    + (151 * e13 / 96) * Math.sin(6 * mu)
    + (1097 * e14 / 512) * Math.sin(8 * mu);
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const n1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi1 * sinPhi1);
  const r1 = WGS84_A * (1 - WGS84_E2)
    / Math.pow(1 - WGS84_E2 * sinPhi1 * sinPhi1, 1.5);
  const t1 = tanPhi1 * tanPhi1;
  const c1 = WGS84_EP2 * cosPhi1 * cosPhi1;
  const d = x / (n1 * UTM_SCALE);
  const d2 = d * d;
  const d3 = d2 * d;
  const d4 = d2 * d2;
  const d5 = d4 * d;
  const d6 = d3 * d3;
  const latitude = phi1 - (n1 * tanPhi1 / r1) * (
    d2 / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * WGS84_EP2) * d4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * WGS84_EP2 - 3 * c1 * c1) * d6 / 720
  );
  const longitude = radians(definition.centralMeridianDegrees) + (
    d - (1 + 2 * t1 + c1) * d3 / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * WGS84_EP2 + 24 * t1 * t1) * d5 / 120
  ) / cosPhi1;
  return [degrees(longitude), degrees(latitude)];
}

function samePosition(first: EarthPosition, second: EarthPosition): boolean {
  return Math.abs(first[0] - second[0]) <= COORDINATE_EPSILON
    && Math.abs(first[1] - second[1]) <= COORDINATE_EPSILON;
}

function orientation(a: EarthMetricPoint, b: EarthMetricPoint, c: EarthMetricPoint): number {
  return (b.easting - a.easting) * (c.northing - a.northing)
    - (b.northing - a.northing) * (c.easting - a.easting);
}

function lineOffset(a: EarthMetricPoint, b: EarthMetricPoint, point: EarthMetricPoint): number {
  const length = Math.hypot(b.easting - a.easting, b.northing - a.northing);
  return length <= Number.EPSILON ? 0 : orientation(a, b, point) / length;
}

function between(value: number, first: number, second: number): boolean {
  return value >= Math.min(first, second) - METRIC_TOLERANCE
    && value <= Math.max(first, second) + METRIC_TOLERANCE;
}

function pointOnSegment(point: EarthMetricPoint, a: EarthMetricPoint, b: EarthMetricPoint): boolean {
  return Math.abs(lineOffset(a, b, point)) <= METRIC_TOLERANCE
    && between(point.easting, a.easting, b.easting)
    && between(point.northing, a.northing, b.northing);
}

function segmentsIntersect(
  a: EarthMetricPoint,
  b: EarthMetricPoint,
  c: EarthMetricPoint,
  d: EarthMetricPoint,
  touchingCounts: boolean,
): boolean {
  const o1 = lineOffset(a, b, c);
  const o2 = lineOffset(a, b, d);
  const o3 = lineOffset(c, d, a);
  const o4 = lineOffset(c, d, b);
  if (((o1 > METRIC_TOLERANCE && o2 < -METRIC_TOLERANCE)
      || (o1 < -METRIC_TOLERANCE && o2 > METRIC_TOLERANCE))
    && ((o3 > METRIC_TOLERANCE && o4 < -METRIC_TOLERANCE)
      || (o3 < -METRIC_TOLERANCE && o4 > METRIC_TOLERANCE))) {
    return true;
  }
  if (!touchingCounts) return false;
  return (Math.abs(o1) <= METRIC_TOLERANCE && pointOnSegment(c, a, b))
    || (Math.abs(o2) <= METRIC_TOLERANCE && pointOnSegment(d, a, b))
    || (Math.abs(o3) <= METRIC_TOLERANCE && pointOnSegment(a, c, d))
    || (Math.abs(o4) <= METRIC_TOLERANCE && pointOnSegment(b, c, d));
}

function pointInRing(point: EarthMetricPoint, ring: MetricRing, includeBoundary: boolean): boolean {
  let inside = false;
  for (let index = 0; index < ring.points.length - 1; index += 1) {
    const a = ring.points[index]!;
    const b = ring.points[index + 1]!;
    if (pointOnSegment(point, a, b)) return includeBoundary;
    const crosses = (a.northing > point.northing) !== (b.northing > point.northing)
      && point.easting < (b.easting - a.easting) * (point.northing - a.northing)
      / (b.northing - a.northing) + a.easting;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: EarthMetricPoint, polygon: MetricPolygon): boolean {
  const outer = polygon.rings[0];
  if (!outer || !pointInRing(point, outer, true)) return false;
  return !polygon.rings.slice(1).some((ring) => pointInRing(point, ring, true));
}

function metricPolygons(geometry: EarthAreaGeometry, srid: number): MetricPolygon[] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => ({
    rings: polygon.map((ring) => ({ points: ring.map((position) => projectWgs84ToUtm(position, srid)) })),
  }));
}

function metricRingSegments(ring: MetricRing): Array<[EarthMetricPoint, EarthMetricPoint]> {
  const segments: Array<[EarthMetricPoint, EarthMetricPoint]> = [];
  for (let index = 0; index < ring.points.length - 1; index += 1) {
    segments.push([ring.points[index]!, ring.points[index + 1]!]);
  }
  return segments;
}

function metricPolygonSegments(polygon: MetricPolygon): Array<[EarthMetricPoint, EarthMetricPoint]> {
  return polygon.rings.flatMap(metricRingSegments);
}

function cellSegments(cell: EarthMetricPoint[]): Array<[EarthMetricPoint, EarthMetricPoint]> {
  return cell.slice(0, 4).map((point, index) => [point, cell[(index + 1) % 4]!] as const);
}

function pointInConvexCell(point: EarthMetricPoint, cell: EarthMetricPoint[], boundary: boolean): boolean {
  let sign = 0;
  for (const [a, b] of cellSegments(cell)) {
    const value = lineOffset(a, b, point);
    if (Math.abs(value) <= METRIC_TOLERANCE) {
      if (!boundary) return false;
      continue;
    }
    const current = value > 0 ? 1 : -1;
    if (sign !== 0 && sign !== current) return false;
    sign = current;
  }
  return true;
}

function cellFullyWithinPolygon(cell: EarthMetricPoint[], polygon: MetricPolygon): boolean {
  const samples = [
    ...cell.slice(0, 4),
    ...cellSegments(cell).map(([a, b]) => ({
      easting: (a.easting + b.easting) / 2,
      northing: (a.northing + b.northing) / 2,
    })),
    cell[4]!,
  ];
  if (!samples.every((point) => pointInPolygon(point, polygon))) return false;
  const boundarySegments = metricPolygonSegments(polygon);
  if (cellSegments(cell).some(([a, b]) => boundarySegments
    .some(([c, d]) => segmentsIntersect(a, b, c, d, false)))) return false;
  return !polygon.rings.some((ring) => ring.points.slice(0, -1)
    .some((point) => pointInConvexCell(point, cell, false)));
}

function cellIntersectsPolygon(cell: EarthMetricPoint[], polygon: MetricPolygon): boolean {
  if (cell.slice(0, 4).some((point) => pointInPolygon(point, polygon))) return true;
  if (polygon.rings.some((ring) => ring.points.slice(0, -1)
    .some((point) => pointInConvexCell(point, cell, true)))) return true;
  const boundarySegments = metricPolygonSegments(polygon);
  return cellSegments(cell).some(([a, b]) => boundarySegments
    .some(([c, d]) => segmentsIntersect(a, b, c, d, true)));
}

function validateRing(ring: EarthRing, label: string): void {
  if (ring.length < 4 || ring.length > 2_000) {
    throw new ValidationError(`${label} must contain between 4 and 2,000 coordinates.`);
  }
  for (const [index, position] of ring.entries()) {
    if (!Array.isArray(position) || position.length !== 2
      || !Number.isFinite(position[0]) || !Number.isFinite(position[1])
      || position[0] < -180 || position[0] > 180
      || position[1] < -90 || position[1] > 90) {
      throw new ValidationError(`${label}[${index}] is not a valid WGS84 position.`);
    }
    if (index > 0 && Math.abs(position[0] - ring[index - 1]![0]) > 180) {
      throw new ValidationError(`${label} crosses the antimeridian and needs a reviewed projection.`);
    }
  }
  if (!samePosition(ring[0]!, ring[ring.length - 1]!)) {
    throw new ValidationError(`${label} must be closed.`);
  }
}

function signedRingArea(ring: MetricRing): number {
  let area = 0;
  for (let index = 0; index < ring.points.length - 1; index += 1) {
    const a = ring.points[index]!;
    const b = ring.points[index + 1]!;
    area += a.easting * b.northing - b.easting * a.northing;
  }
  return area / 2;
}

function validateMetricPolygon(polygon: MetricPolygon, label: string): void {
  for (const [ringIndex, ring] of polygon.rings.entries()) {
    if (Math.abs(signedRingArea(ring)) < 1) {
      throw new ValidationError(`${label} ring ${ringIndex} has no measurable area.`);
    }
    const segments = metricRingSegments(ring);
    for (let first = 0; first < segments.length; first += 1) {
      for (let second = first + 1; second < segments.length; second += 1) {
        if (second === first + 1 || (first === 0 && second === segments.length - 1)) continue;
        if (segmentsIntersect(
          segments[first]![0], segments[first]![1],
          segments[second]![0], segments[second]![1],
          true,
        )) throw new ValidationError(`${label} ring ${ringIndex} self-intersects.`);
      }
    }
  }
  const outer = polygon.rings[0]!;
  for (const [holeIndex, hole] of polygon.rings.slice(1).entries()) {
    if (!hole.points.slice(0, -1).every((point) => pointInRing(point, outer, false))) {
      throw new ValidationError(`${label} hole ${holeIndex} is outside its outer ring.`);
    }
    if (metricRingSegments(hole).some(([a, b]) => metricRingSegments(outer)
      .some(([c, d]) => segmentsIntersect(a, b, c, d, true)))) {
      throw new ValidationError(`${label} hole ${holeIndex} intersects its outer ring.`);
    }
  }
  const holes = polygon.rings.slice(1);
  for (let first = 0; first < holes.length; first += 1) {
    for (let second = first + 1; second < holes.length; second += 1) {
      const a = holes[first]!;
      const b = holes[second]!;
      if (metricRingSegments(a).some(([a1, a2]) => metricRingSegments(b)
        .some(([b1, b2]) => segmentsIntersect(a1, a2, b1, b2, true)))
        || pointInRing(a.points[0]!, b, true)
        || pointInRing(b.points[0]!, a, true)) {
        throw new ValidationError(`${label} contains overlapping holes.`);
      }
    }
  }
}

export function validateEarthAreaGeometry(
  geometry: EarthAreaGeometry,
  srid: number,
  label = "Development-zone geometry",
): void {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) {
    throw new ValidationError(`${label} must be a Polygon or MultiPolygon.`);
  }
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  if (polygons.length < 1 || polygons.length > 25) {
    throw new ValidationError(`${label} must contain between 1 and 25 polygons.`);
  }
  for (const [polygonIndex, polygon] of polygons.entries()) {
    if (polygon.length < 1 || polygon.length > 25) {
      throw new ValidationError(`${label} polygon ${polygonIndex} has invalid rings.`);
    }
    polygon.forEach((ring, ringIndex) => validateRing(ring, `${label}[${polygonIndex}][${ringIndex}]`));
  }
  const projected = metricPolygons(geometry, srid);
  projected.forEach((polygon, index) => validateMetricPolygon(polygon, `${label} polygon ${index}`));
  for (let first = 0; first < projected.length; first += 1) {
    for (let second = first + 1; second < projected.length; second += 1) {
      const a = projected[first]!;
      const b = projected[second]!;
      if (metricPolygonSegments(a).some(([a1, a2]) => metricPolygonSegments(b)
        .some(([b1, b2]) => segmentsIntersect(a1, a2, b1, b2, true)))
        || pointInPolygon(a.rings[0]!.points[0]!, b)
        || pointInPolygon(b.rings[0]!.points[0]!, a)) {
        throw new ValidationError(`${label} contains overlapping polygons.`);
      }
    }
  }
}

export function earthGeometryBbox(geometry: EarthAreaGeometry): [number, number, number, number] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const positions = polygons.flatMap((polygon) => polygon.flat());
  if (!positions.length) throw new ValidationError("Geometry has no coordinates.");
  return positions.reduce<[number, number, number, number]>((bbox, position) => [
    Math.min(bbox[0], position[0]),
    Math.min(bbox[1], position[1]),
    Math.max(bbox[2], position[0]),
    Math.max(bbox[3], position[1]),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

export function sha256Content(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function parcelCanonicalKey(
  zoneVersionId: string,
  column: number,
  row: number,
  algorithmVersion = EARTH_PARCEL_ALGORITHM_VERSION,
): string {
  if (!Number.isSafeInteger(column) || !Number.isSafeInteger(row)) {
    throw new ValidationError("Parcel grid indices must be safe integers.");
  }
  return `${algorithmVersion}:${zoneVersionId}:${column}:${row}`;
}

export function parcelPublicId(canonicalKey: string): string {
  return `parcel_${createHash("sha256").update(canonicalKey).digest("hex").slice(0, 32)}`;
}

function gridPoint(
  zone: EarthParcelZoneDefinition,
  columnUnits: number,
  rowUnits: number,
): EarthMetricPoint {
  const angle = radians(zone.bearingDegrees);
  const localX = columnUnits * zone.cellWidthMeters;
  const localY = rowUnits * zone.cellHeightMeters;
  return {
    easting: zone.originEasting + localX * Math.cos(angle) - localY * Math.sin(angle),
    northing: zone.originNorthing + localX * Math.sin(angle) + localY * Math.cos(angle),
  };
}

function metricCell(zone: EarthParcelZoneDefinition, column: number, row: number): EarthMetricPoint[] {
  const corners = [
    gridPoint(zone, column, row),
    gridPoint(zone, column + 1, row),
    gridPoint(zone, column + 1, row + 1),
    gridPoint(zone, column, row + 1),
  ];
  return [...corners, {
    easting: corners.reduce((sum, point) => sum + point.easting, 0) / 4,
    northing: corners.reduce((sum, point) => sum + point.northing, 0) / 4,
  }];
}

function assertZoneDefinition(zone: EarthParcelZoneDefinition): void {
  if (zone.algorithmVersion !== EARTH_PARCEL_ALGORITHM_VERSION) {
    throw new ValidationError("Unsupported parcel-generation algorithm version.");
  }
  if (zone.edgePolicy !== "FULL_CELL") {
    throw new ValidationError("Phase 4 supports full parcel cells only.");
  }
  for (const [value, label] of [
    [zone.cellWidthMeters, "Parcel width"],
    [zone.cellHeightMeters, "Parcel height"],
  ] as const) {
    if (!Number.isFinite(value) || value < 10 || value > 1_000) {
      throw new ValidationError(`${label} must be between 10 and 1,000 metres.`);
    }
  }
  if (!Number.isFinite(zone.bearingDegrees)
    || zone.bearingDegrees < -180 || zone.bearingDegrees > 180) {
    throw new ValidationError("Grid bearing must be between -180 and 180 degrees.");
  }
  validateEarthAreaGeometry(zone.geometry, zone.projectionSrid);
  for (const exclusion of zone.exclusions) {
    validateEarthAreaGeometry(exclusion.geometry, zone.projectionSrid, `Exclusion ${exclusion.id}`);
  }
}

interface ParcelMetricContext {
  eligiblePolygons: MetricPolygon[];
  exclusionPolygons: MetricPolygon[];
}

function parcelMetricContext(zone: EarthParcelZoneDefinition): ParcelMetricContext {
  return {
    eligiblePolygons: metricPolygons(zone.geometry, zone.projectionSrid),
    exclusionPolygons: zone.exclusions.flatMap((entry) => metricPolygons(
      entry.geometry,
      zone.projectionSrid,
    )),
  };
}

function deriveParcelCandidateUnchecked(
  zone: EarthParcelZoneDefinition,
  column: number,
  row: number,
  context = parcelMetricContext(zone),
): EarthParcelCandidate | null {
  const cell = metricCell(zone, column, row);
  if (!context.eligiblePolygons.some((polygon) => cellFullyWithinPolygon(cell, polygon))) return null;
  if (context.exclusionPolygons.some((polygon) => cellIntersectsPolygon(cell, polygon))) return null;
  const ring = [...cell.slice(0, 4), cell[0]!]
    .map((point) => unprojectUtmToWgs84(point, zone.projectionSrid));
  const canonicalKey = parcelCanonicalKey(zone.zoneVersionId, column, row, zone.algorithmVersion);
  return {
    id: parcelPublicId(canonicalKey),
    canonicalKey,
    zoneId: zone.zoneId,
    zoneVersionId: zone.zoneVersionId,
    algorithmVersion: zone.algorithmVersion,
    column,
    row,
    geometry: { type: "Polygon", coordinates: [ring] },
    centroid: unprojectUtmToWgs84(cell[4]!, zone.projectionSrid),
    areaSquareMeters: zone.cellWidthMeters * zone.cellHeightMeters,
    widthMeters: zone.cellWidthMeters,
    heightMeters: zone.cellHeightMeters,
  };
}

export function deriveParcelCandidate(
  zone: EarthParcelZoneDefinition,
  column: number,
  row: number,
): EarthParcelCandidate | null {
  assertZoneDefinition(zone);
  if (!Number.isSafeInteger(column) || !Number.isSafeInteger(row)) {
    throw new ValidationError("Parcel grid indices must be safe integers.");
  }
  return deriveParcelCandidateUnchecked(zone, column, row);
}

function metricToGrid(zone: EarthParcelZoneDefinition, point: EarthMetricPoint): [number, number] {
  const x = point.easting - zone.originEasting;
  const y = point.northing - zone.originNorthing;
  const angle = radians(zone.bearingDegrees);
  return [
    (x * Math.cos(angle) + y * Math.sin(angle)) / zone.cellWidthMeters,
    (-x * Math.sin(angle) + y * Math.cos(angle)) / zone.cellHeightMeters,
  ];
}

function compareGridPosition(
  row: number,
  column: number,
  after?: { row: number; column: number } | null,
): boolean {
  return !after || row > after.row || (row === after.row && column > after.column);
}

export function generateParcelViewport(
  zone: EarthParcelZoneDefinition,
  viewport: EarthParcelViewport,
): EarthParcelViewportResult {
  assertZoneDefinition(zone);
  if (!Number.isFinite(viewport.zoom) || viewport.zoom < EARTH_PARCEL_VIEWPORT_MIN_ZOOM) {
    throw new ValidationError(`Parcel discovery requires zoom ${EARTH_PARCEL_VIEWPORT_MIN_ZOOM} or closer.`);
  }
  const [west, south, east, north] = viewport.bbox;
  if (![west, south, east, north].every(Number.isFinite)
    || west < -180 || east > 180 || south < -90 || north > 90
    || west >= east || south >= north || east - west > 180) {
    throw new ValidationError("Parcel viewport is not a valid bounded WGS84 box.");
  }
  const limit = viewport.limit ?? EARTH_PARCEL_VIEWPORT_DEFAULT_RESULTS;
  if (!Number.isInteger(limit) || limit < 1 || limit > EARTH_PARCEL_VIEWPORT_MAX_RESULTS) {
    throw new ValidationError(`Parcel result limit must be between 1 and ${EARTH_PARCEL_VIEWPORT_MAX_RESULTS}.`);
  }
  const gridCorners = [
    [west, south], [east, south], [east, north], [west, north],
  ].map((position) => metricToGrid(
    zone,
    projectWgs84ToUtm(position as EarthPosition, zone.projectionSrid),
  ));
  const minColumn = Math.floor(Math.min(...gridCorners.map((point) => point[0]))) - 1;
  const maxColumn = Math.ceil(Math.max(...gridCorners.map((point) => point[0]))) + 1;
  const minRow = Math.floor(Math.min(...gridCorners.map((point) => point[1]))) - 1;
  const maxRow = Math.ceil(Math.max(...gridCorners.map((point) => point[1]))) + 1;
  const candidateCount = (maxColumn - minColumn + 1) * (maxRow - minRow + 1);
  if (!Number.isSafeInteger(candidateCount) || candidateCount > EARTH_PARCEL_VIEWPORT_MAX_CANDIDATES) {
    throw new ValidationError("Parcel viewport is too broad. Zoom in to inspect virtual plots.");
  }

  const items: EarthParcelCandidate[] = [];
  const context = parcelMetricContext(zone);
  let lastReturned: { row: number; column: number } | null = null;
  let hasMore = false;
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      if (!compareGridPosition(row, column, viewport.after)) continue;
      const candidate = deriveParcelCandidateUnchecked(zone, column, row, context);
      if (!candidate) continue;
      const candidateBbox = earthGeometryBbox(candidate.geometry);
      if (candidateBbox[2] < west || candidateBbox[0] > east
        || candidateBbox[3] < south || candidateBbox[1] > north) continue;
      if (items.length >= limit) {
        hasMore = true;
        break;
      }
      items.push(candidate);
      lastReturned = { row, column };
    }
    if (hasMore) break;
  }
  return {
    items,
    scannedCandidates: candidateCount,
    next: hasMore ? lastReturned : null,
  };
}

export function geometryContainsPoint(
  geometry: EarthAreaGeometry,
  point: EarthPosition,
  srid: number,
): boolean {
  validateEarthAreaGeometry(geometry, srid);
  const projectedPoint = projectWgs84ToUtm(point, srid);
  return metricPolygons(geometry, srid).some((polygon) => pointInPolygon(projectedPoint, polygon));
}

export function geometryContainsGeometry(
  container: EarthAreaGeometry,
  candidate: EarthAreaGeometry,
  srid: number,
): boolean {
  validateEarthAreaGeometry(container, srid, "Parent geography");
  validateEarthAreaGeometry(candidate, srid, "Development-zone geometry");
  const containers = metricPolygons(container, srid);
  const candidates = metricPolygons(candidate, srid);
  return candidates.every((polygon) => {
    const points = polygon.rings[0]?.points.slice(0, -1) ?? [];
    return containers.some((containerPolygon) => points.every((point) => pointInPolygon(point, containerPolygon))
      && !metricPolygonSegments(polygon).some(([a, b]) => metricPolygonSegments(containerPolygon)
        .some(([c, d]) => segmentsIntersect(a, b, c, d, false))));
  });
}
