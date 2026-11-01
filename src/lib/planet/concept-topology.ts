import type { PlanetGeometry, PlanetPoint } from "./geometry";

/**
 * Strict, planar containment for the current concept map ONLY.
 *
 * The concept continents and countries use simple, non-dateline-crossing
 * polygons in planet-local equirectangular coordinates. This rejects coastal
 * contact and every child-edge crossing, including when all child vertices
 * are inside a concave parent. Not suitable for spherical GIS publication,
 * holes, dateline wrapping, country partitions or permanent cadastral data.
 */
const TOLERANCE = 1e-9;

function cross(a: PlanetPoint, b: PlanetPoint, p: PlanetPoint): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

function onSegment(a: PlanetPoint, b: PlanetPoint, p: PlanetPoint): boolean {
  return Math.abs(cross(a, b, p)) <= TOLERANCE
    && p[0] >= Math.min(a[0], b[0]) - TOLERANCE
    && p[0] <= Math.max(a[0], b[0]) + TOLERANCE
    && p[1] >= Math.min(a[1], b[1]) - TOLERANCE
    && p[1] <= Math.max(a[1], b[1]) + TOLERANCE;
}

function segmentsMeet(a: PlanetPoint, b: PlanetPoint, c: PlanetPoint, d: PlanetPoint): boolean {
  const s1 = cross(a, b, c);
  const s2 = cross(a, b, d);
  const s3 = cross(c, d, a);
  const s4 = cross(c, d, b);
  if (((s1 > TOLERANCE && s2 < -TOLERANCE) || (s1 < -TOLERANCE && s2 > TOLERANCE))
    && ((s3 > TOLERANCE && s4 < -TOLERANCE) || (s3 < -TOLERANCE && s4 > TOLERANCE))) {
    return true;
  }
  return onSegment(a, b, c) || onSegment(a, b, d)
    || onSegment(c, d, a) || onSegment(c, d, b);
}

function isConceptRing(ring: PlanetPoint[]): boolean {
  if (ring.length < 4 || ring.length > 600) return false;
  const start = ring[0]!, end = ring[ring.length - 1]!;
  if (Math.abs(start[0] - end[0]) > TOLERANCE || Math.abs(start[1] - end[1]) > TOLERANCE) return false;
  return ring.every((point, index) =>
    point.length === 2
    && point.every(Number.isFinite)
    && Math.abs(point[0]) <= 180
    && Math.abs(point[1]) < 89.999
    && (index === 0 || Math.abs(point[0] - ring[index - 1]![0]) < 180),
  );
}

function strictInside(p: PlanetPoint, ring: PlanetPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const a = ring[j]!, b = ring[i]!;
    if (onSegment(a, b, p)) return false;
    if ((a[1] > p[1]) !== (b[1] > p[1])) {
      const atX = a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
      if (p[0] < atX) inside = !inside;
    }
  }
  return inside;
}

/** Fail closed if either input is outside the supported concept polygon subset. */
export function strictlyContainsConceptPolygon(outer: PlanetGeometry, inner: PlanetGeometry): boolean {
  if (outer.type !== "Polygon" || inner.type !== "Polygon"
    || outer.coordinates.length !== 1 || inner.coordinates.length !== 1) return false;
  const parent = outer.coordinates[0]!, child = inner.coordinates[0]!;
  if (!isConceptRing(parent) || !isConceptRing(child)) return false;

  // Validity of each simple polygon is checked independently by the existing
  // validatePlanetGeometry function before use. This function checks containment.
  if (!child.slice(0, -1).every((point) => strictInside(point, parent))) return false;
  for (let i = 0; i < child.length - 1; i++) {
    for (let j = 0; j < parent.length - 1; j++) {
      if (segmentsMeet(child[i]!, child[i + 1]!, parent[j]!, parent[j + 1]!)) return false;
    }
  }
  return true;
}
