import type { EarthZoneSummary } from "./land";

/**
 * Approximate discovery markers for reviewed development zones.
 * A bounding-box midpoint is a navigation hint, not a cadastral position.
 * Exact geometry is fetched only when the user opens an authorized zone.
 */
export function earthZoneOverviewFeatures(
  zones: Pick<EarthZoneSummary, "id" | "name" | "bbox" | "isDemonstration">[],
) {
  return zones.map((zone) => {
    const [west, south, east, north] = zone.bbox;
    if (![west, south, east, north].every(Number.isFinite)
      || west >= east || south >= north) {
      throw new Error("Cannot display a zone marker with invalid bounds.");
    }
    return {
      type: "Feature" as const,
      id: zone.id,
      properties: {
        id: zone.id,
        name: zone.name,
        isDemonstration: zone.isDemonstration,
        approximate: true,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [(west + east) / 2, (south + north) / 2],
      },
    };
  });
}
