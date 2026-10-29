import { PLANET_RADIUS_KM, type PlanetGeometry, type PlanetPoint } from "./geometry";

export type CreatorMode = "PLACE" | "DRAW" | "ORBIT";

export function wrapLongitude(lon: number): number {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

export function clampCreatorLatitude(lat: number): number {
  return Math.max(-72, Math.min(72, lat));
}

/**
 * Deterministic original territory, intended as an editable starter boundary.
 * Distances are approximate surface-radius distances, NOT surveyed positions.
 */
export function createStarterTerritory(center: PlanetPoint, radiusKm: number): PlanetGeometry {
  const latitude = clampCreatorLatitude(center[1]);
  const longitude = wrapLongitude(center[0]);
  const radians = Math.PI / 180;
  const radianRadius = Math.max(80, Math.min(1800, radiusKm)) / PLANET_RADIUS_KM;
  const points: PlanetPoint[] = [];
  const numberOfVertices = 16;
  for (let i = 0; i < numberOfVertices; i++) {
    const angle = Math.PI * 2 * i / numberOfVertices;
    const noise = 0.86 + 0.11 * Math.sin(angle * 3 + 0.7) + 0.07 * Math.cos(angle * 5 - 0.3);
    const north = Math.cos(angle) * radianRadius * noise;
    const east = Math.sin(angle) * radianRadius * noise;
    const pointLat = latitude + north / radians;
    const cosLat = Math.max(0.20, Math.cos(latitude * radians));
    points.push([wrapLongitude(longitude + east / radians / cosLat), pointLat]);
  }
  points.push([...points[0]!] as PlanetPoint);
  return { type: "Polygon", coordinates: [points] };
}

/** Returns null until there are three unique points; caller can show helpful empty state. */
export function drawTerritory(points: PlanetPoint[]): PlanetGeometry | null {
  if (points.length < 3) return null;
  return { type: "Polygon", coordinates: [[...points, [...points[0]!] as PlanetPoint]] };
}

export function countryOutline(geometry: PlanetGeometry): PlanetPoint[] {
  return geometry.type === "Polygon" ? geometry.coordinates[0] ?? [] : geometry.coordinates[0]?.[0] ?? [];
}
