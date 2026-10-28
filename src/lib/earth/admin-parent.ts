import type { EarthSourceGeometry } from "./import";

export type EarthRegionGeometry = Exclude<EarthSourceGeometry, { type: "Point" }>;
type Point = [number, number];

function pointInRing([x, y]: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const dx = xj - xi, dy = yj - yi;
    const cross = (x - xi) * dy - (y - yi) * dx;
    if (Math.abs(cross) < 1e-10
      && x >= Math.min(xi, xj) && x <= Math.max(xi, xj)
      && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true;
    if ((yi > y) !== (yj > y) && x < dx * (y - yi) / dy + xi) inside = !inside;
  }
  return inside;
}

/** Supports Polygon holes and MultiPolygon islands without inventing boundaries. */
export function pointInEarthRegion(point: Point, geometry: EarthRegionGeometry): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => {
    if (!rings[0] || !pointInRing(point, rings[0])) return false;
    return !rings.slice(1).some((ring) => pointInRing(point, ring));
  });
}

/** Choose only points actually inside the child geometry (not its bounding box). */
function interiorSamples(geometry: EarthRegionGeometry): Point[] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const results: Point[] = [];
  for (const polygon of polygons) {
    const vertices = polygon[0] ?? [];
    if (!vertices.length) continue;
    const xs = vertices.map(([x]) => x), ys = vertices.map(([, y]) => y);
    const left = Math.min(...xs), right = Math.max(...xs);
    const bottom = Math.min(...ys), top = Math.max(...ys);
    for (let y = 0; y < 18; y += 1) {
      for (let x = 0; x < 18; x += 1) {
        const point: Point = [
          left + (right - left) * (x + 0.5) / 18,
          bottom + (top - bottom) * (y + 0.5) / 18,
        ];
        if (pointInEarthRegion(point, geometry)) results.push(point);
      }
    }
  }
  if (!results.length) throw new Error("No interior sample could be derived from child geometry.");
  // Deterministically distribute samples over the complete geometry.
  const count = Math.min(results.length, 36);
  return Array.from({ length: count }, (_, index) =>
    results[Math.floor(index * results.length / count)]!);
}

/**
 * Match a child administrative polygon against sourced parent polygons.
 * Ambiguous or insufficiently matching geometry fails closed for manual review.
 */
export function matchEarthParentRegion<T extends { key: string; geometry: EarthRegionGeometry }>(
  child: EarthRegionGeometry,
  parents: T[],
): T {
  const samples = interiorSamples(child);
  const scores = parents.map((parent) => ({
    parent,
    hits: samples.filter((point) => pointInEarthRegion(point, parent.geometry)).length,
  })).sort((a, b) => b.hits - a.hits || a.parent.key.localeCompare(b.parent.key));
  const winner = scores[0];
  const runnerUp = scores[1];
  if (!winner || winner.hits / samples.length < 0.65
    || (runnerUp && winner.hits - runnerUp.hits <= samples.length * 0.2)) {
    throw new Error("Ambiguous ADM2 parent region: sourced geometry requires manual review.");
  }
  return winner.parent;
}
