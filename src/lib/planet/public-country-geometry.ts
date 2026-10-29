import type { PlanetGeometry, PlanetPoint } from "./geometry";

export interface PublishedPlanetCountry {
  id: string;
  planetId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  status: "PUBLISHED";
  publishedRevision: number;
  areaKm2: number;
  label: PlanetPoint;
  geometry: PlanetGeometry;
}

function unwrap(points: PlanetPoint[]): PlanetPoint[] {
  if (!points.length) return [];
  const output: PlanetPoint[] = [[points[0]![0], points[0]![1]]];
  for (let i = 1; i < points.length; i++) {
    let longitude = points[i]![0];
    const last = output[i - 1]![0];
    while (longitude - last > 180) longitude -= 360;
    while (longitude - last < -180) longitude += 360;
    output.push([longitude, points[i]![1]]);
  }
  return output;
}

function containsRing(point: PlanetPoint, ring: PlanetPoint[]): "INSIDE" | "OUTSIDE" | "EDGE" {
  const path = unwrap(ring);
  if (path.length < 4) return "OUTSIDE";
  const avg = path.slice(0, -1).reduce((sum, p) => sum + p[0], 0) / (path.length - 1);
  const shift = Math.round((avg - point[0]) / 360) * 360;
  const x = point[0] + shift;
  const y = point[1];
  let inside = false;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const d = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(d) < 1e-8 && x >= Math.min(a[0], b[0]) - 1e-8 && x <= Math.max(a[0], b[0]) + 1e-8
      && y >= Math.min(a[1], b[1]) - 1e-8 && y <= Math.max(a[1], b[1]) + 1e-8) return "EDGE";
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside ? "INSIDE" : "OUTSIDE";
}

/**
 * Planet-local fictional territory hit test for public discovery.
 * Holes are excluded; islands and +/-180 crossings are supported.
 * Borders count as selectable, but a hole border does not.
 */
export function countryContainsPoint(geometry: PlanetGeometry, point: PlanetPoint): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    const outer = polygon[0];
    if (!outer) continue;
    const inclusion = containsRing(point, outer);
    if (inclusion === "OUTSIDE") continue;
    if (polygon.slice(1).some(hole => containsRing(point, hole) !== "OUTSIDE")) continue;
    return true;
  }
  return false;
}

export function findCountryAtPoint(countries: readonly PublishedPlanetCountry[], point: PlanetPoint) {
  return countries.find(country => countryContainsPoint(country.geometry, point)) ?? null;
}
