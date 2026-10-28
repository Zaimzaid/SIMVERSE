import type { EarthPlaceKind } from "./constants";

/**
 * Camera caps for progressive Earth navigation. These are map zoom targets,
 * not parcel-generation permissions. A user can still zoom manually.
 */
export function earthPlaceFocusMaxZoom(kind: EarthPlaceKind): number {
  switch (kind) {
    case "COUNTRY": return 5;
    case "ADMIN1": return 9;
    case "ADMIN2": return 12;
    case "CITY":
    case "TOWN":
    case "LOCALITY": return 15;
  }
}

/** Sourced administrative and settlement places have distinct hierarchies. */
export function isEarthSettlement(kind: EarthPlaceKind): boolean {
  return kind === "CITY" || kind === "TOWN" || kind === "LOCALITY";
}
