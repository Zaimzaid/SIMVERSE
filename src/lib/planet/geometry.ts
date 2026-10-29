import { ValidationError } from "@/lib/errors";

/** GeoJSON-style coordinates in SIMVERSE's own (not terrestrial) planet-local frame. */
export type PlanetPoint = [number, number];
export type PlanetPolygon = { type: "Polygon"; coordinates: PlanetPoint[][] };
export type PlanetMultiPolygon = { type: "MultiPolygon"; coordinates: PlanetPoint[][][] };
export type PlanetGeometry = PlanetPolygon | PlanetMultiPolygon;
type Ring = PlanetPoint[];
type Polygon = Ring[];

export const PLANET_RADIUS_KM = 6000;
export const PLANET_MAX_COORDINATE_PAIRS = 2400;
export const PLANET_MAX_SURFACE_FRACTION = 0.45;
const EPS = 1e-9;

function fail(message: string): never {
  throw new ValidationError(message);
}

function approximately(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS;
}

function equalPoint(a: PlanetPoint, b: PlanetPoint): boolean {
  // Longitude +180 and -180 are physically identical, but ring unwrapping
  // requires the serialized endpoints to agree exactly for easy review.
  return approximately(a[0], b[0]) && approximately(a[1], b[1]);
}

function cross(a: PlanetPoint, b: PlanetPoint, c: PlanetPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: PlanetPoint, b: PlanetPoint, c: PlanetPoint): boolean {
  return Math.abs(cross(a, b, c)) < EPS
    && c[0] >= Math.min(a[0], b[0]) - EPS
    && c[0] <= Math.max(a[0], b[0]) + EPS
    && c[1] >= Math.min(a[1], b[1]) - EPS
    && c[1] <= Math.max(a[1], b[1]) + EPS;
}

function intersects(a: PlanetPoint, b: PlanetPoint, c: PlanetPoint, d: PlanetPoint, allowContact: boolean): boolean {
  const ac = cross(a, b, c);
  const ad = cross(a, b, d);
  const ca = cross(c, d, a);
  const cb = cross(c, d, b);
  if ((ac > EPS && ad < -EPS || ac < -EPS && ad > EPS)
    && (ca > EPS && cb < -EPS || ca < -EPS && cb > EPS)) return true;
  if (allowContact) return false;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function unwrapRing(ring: Ring): Ring {
  const points: Ring = [[ring[0]![0], ring[0]![1]]];
  for (let i = 1; i < ring.length; i++) {
    const point = ring[i]!;
    let lon = point[0];
    const previous = points[i - 1]![0];
    while (lon - previous > 180) lon -= 360;
    while (lon - previous < -180) lon += 360;
    points.push([lon, point[1]]);
  }
  if (!approximately(points[points.length - 1]![0], points[0]![0])) {
    fail("A territory boundary cannot wind around the whole planet.");
  }
  return points;
}

function shiftRing(ring: Ring, offset: number): Ring {
  return ring.map(([lon, lat]) => [lon + offset, lat]);
}

function ringCenterLongitude(ring: Ring): number {
  return ring.slice(0, -1).reduce((sum, point) => sum + point[0], 0) / (ring.length - 1);
}

function alignRing(ring: Ring, targetCenter: number): Ring {
  const offset = Math.round((targetCenter - ringCenterLongitude(ring)) / 360) * 360;
  return shiftRing(ring, offset);
}

function unwrapPolygon(polygon: Polygon): Polygon {
  const shell = unwrapRing(polygon[0]!);
  const center = ringCenterLongitude(shell);
  return [shell, ...polygon.slice(1).map((ring) => alignRing(unwrapRing(ring), center))];
}

function ringAreaKm2(ring: Ring): number {
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    sum += ((b[0] - a[0]) * rad) * (Math.sin(a[1] * rad) + Math.sin(b[1] * rad));
  }
  return Math.abs(sum) * PLANET_RADIUS_KM ** 2 / 2;
}

function pointInRing(point: PlanetPoint, ring: Ring): "INSIDE" | "OUTSIDE" | "BORDER" {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    if (onSegment(a, b, point)) return "BORDER";
    if ((a[1] > point[1]) !== (b[1] > point[1])) {
      const xAtY = (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0];
      if (point[0] < xAtY) inside = !inside;
    }
  }
  return inside ? "INSIDE" : "OUTSIDE";
}

function pointInPolygon(point: PlanetPoint, polygon: Polygon): boolean {
  if (pointInRing(point, polygon[0]!) !== "INSIDE") return false;
  return polygon.slice(1).every((ring) => pointInRing(point, ring) === "OUTSIDE");
}

function edgesIntersect(a: Ring, b: Ring, allowContact: boolean): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (intersects(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!, allowContact)) return true;
    }
  }
  return false;
}

function validateRing(ring: Ring): void {
  if (ring.length < 4 || ring.length > 600) fail("A territory ring must contain between 4 and 600 positions.");
  if (!equalPoint(ring[0]!, ring[ring.length - 1]!)) fail("A territory ring must close at its starting coordinate.");
  for (let i = 0; i < ring.length; i++) {
    const point = ring[i]!;
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)
      || point[0] < -180 || point[0] > 180 || point[1] <= -89.999 || point[1] >= 89.999) {
      fail("Territory positions must be finite [longitude, latitude], inside the planet coordinate limits.");
    }
    if (i > 0 && equalPoint(point, ring[i - 1]!)) fail("A territory has duplicate adjacent vertices.");
  }
  const unwrapped = unwrapRing(ring);
  for (let i = 0; i < unwrapped.length - 1; i++) {
    if (Math.hypot(
      unwrapped[i + 1]![0] - unwrapped[i]![0],
      unwrapped[i + 1]![1] - unwrapped[i]![1],
    ) < 1e-7) fail("A territory edge is too short.");
    for (let j = i + 1; j < unwrapped.length - 1; j++) {
      if (j === i + 1 || (i === 0 && j === unwrapped.length - 2)) continue;
      if (intersects(unwrapped[i]!, unwrapped[i + 1]!, unwrapped[j]!, unwrapped[j + 1]!, false)) {
        fail("Territory boundary cannot intersect itself.");
      }
    }
  }
  if (ringAreaKm2(unwrapped) < 0.01) fail("Territory area must be at least 0.01 km².");
}

function validatePolygon(polygon: Polygon): number {
  if (polygon.length < 1 || polygon.length > 6) fail("A territory polygon must have 1–6 rings.");
  polygon.forEach(validateRing);
  const aligned = unwrapPolygon(polygon);
  const shell = aligned[0]!;
  let area = ringAreaKm2(shell);
  for (let i = 1; i < aligned.length; i++) {
    const hole = aligned[i]!;
    if (hole.slice(0, -1).some((vertex) => pointInRing(vertex, shell) !== "INSIDE")) fail("A territory hole must be entirely inside its exterior.");
    if (edgesIntersect(shell, hole, false)) fail("Territory hole touches or crosses its exterior.");
    for (let j = 1; j < i; j++) {
      const anotherHole = aligned[j]!;
      if (edgesIntersect(hole, anotherHole, false)
        || pointInRing(hole[0]!, anotherHole) !== "OUTSIDE"
        || pointInRing(anotherHole[0]!, hole) !== "OUTSIDE") fail("Territory holes cannot overlap or nest.");
    }
    area -= ringAreaKm2(hole);
  }
  if (area < 0.01) fail("Territory area must be at least 0.01 km².");
  return area;
}

function polygons(geometry: PlanetGeometry): Polygon[] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function findInteriorSample(polygon: Polygon): PlanetPoint | null {
  const shell = polygon[0]!;
  const winding = shell.slice(0, -1).reduce((sum, a, i) => {
    const b = shell[i + 1]!;
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  const direction = Math.sign(winding);
  const xs = shell.map((p) => p[0]);
  const ys = shell.map((p) => p[1]);
  const scale = Math.max(1e-8, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1e-5);
  for (let i = 0; i < shell.length - 1; i++) {
    const a = shell[i]!;
    const b = shell[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 1e-8) continue;
    const candidate: PlanetPoint = [(a[0] + b[0]) / 2 - direction * dy / length * scale, (a[1] + b[1]) / 2 + direction * dx / length * scale];
    if (pointInPolygon(candidate, polygon)) return candidate;
  }
  return null;
}

/** Normalize and validate a user-authored territory; no Earth geometry is referenced. */
export function validatePlanetGeometry(value: unknown): { geometry: PlanetGeometry; areaKm2: number; label: PlanetPoint } {
  if (!value || typeof value !== "object") fail("Territory geometry is required.");
  const geometry = value as PlanetGeometry;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") fail("Territory must be GeoJSON Polygon or MultiPolygon.");
  if (!Array.isArray(geometry.coordinates)) fail("Territory coordinates must be an array.");
  const pieces = polygons(geometry);
  if (!pieces.length || pieces.length > 8) fail("Territory must contain 1–8 polygons.");
  let coordinateCount = 0;
  for (const polygon of pieces) {
    if (!Array.isArray(polygon)) fail("Invalid territory polygon.");
    for (const ring of polygon) {
      if (!Array.isArray(ring)) fail("Invalid territory ring.");
      coordinateCount += ring.length;
    }
  }
  if (coordinateCount > PLANET_MAX_COORDINATE_PAIRS) fail("Territory has too many positions.");
  const areaKm2 = pieces.reduce((total, polygon) => total + validatePolygon(polygon), 0);
  const halfSphere = 2 * Math.PI * PLANET_RADIUS_KM ** 2;
  if (areaKm2 > 2 * halfSphere * PLANET_MAX_SURFACE_FRACTION) fail("Territory exceeds the maximum allowed planet surface area.");
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      if (polygonsOverlap({ type: "Polygon", coordinates: pieces[i]! }, { type: "Polygon", coordinates: pieces[j]! })) {
        fail("Detached territories cannot overlap each other.");
      }
    }
  }
  const shell = unwrapPolygon(pieces[0]!);
  const point = findInteriorSample(shell);
  if (!point) fail("Territory has no valid interior label location.");
  const normalizeLon = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;
  return { geometry, areaKm2, label: [normalizeLon(point[0]), point[1]] };
}

/**
 * Check filled-area overlap including dateline wrapping and islands/holes.
 * Shared border segments alone do not count as overlapping sovereign interiors.
 */
export function polygonsOverlap(a: PlanetGeometry, b: PlanetGeometry): boolean {
  for (const first of polygons(a)) {
    const ap = unwrapPolygon(first);
    for (const second of polygons(b)) {
      const bp = unwrapPolygon(second);
      const centerDelta = ringCenterLongitude(ap[0]!) - ringCenterLongitude(bp[0]!);
      const nearestShift = Math.round(centerDelta / 360) * 360;
      for (const shift of [nearestShift - 360, nearestShift, nearestShift + 360]) {
        const shifted = bp.map((ring) => shiftRing(ring, shift));
        for (const ar of ap) {
          for (const br of shifted) {
            if (edgesIntersect(ar, br, true)) return true;
          }
        }
        const aSample = findInteriorSample(ap);
        const bSample = findInteriorSample(shifted);
        if ((aSample && pointInPolygon(aSample, shifted)) || (bSample && pointInPolygon(bSample, ap))) return true;
      }
    }
  }
  return false;
}
