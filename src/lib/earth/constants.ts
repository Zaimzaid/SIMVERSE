export const EARTH_PLACE_KINDS = [
  "COUNTRY",
  "ADMIN1",
  "ADMIN2",
  "CITY",
  "TOWN",
  "LOCALITY",
] as const;

export type EarthPlaceKind = (typeof EARTH_PLACE_KINDS)[number];

export const EARTH_BOUNDARY_QUALITIES = [
  "VERIFIED_BOUNDARY",
  "GENERALIZED_BOUNDARY",
  "APPROXIMATE_BOUNDARY",
  "DISPUTED_BOUNDARY",
  "POINT_ONLY",
  "MISSING",
  "QUARANTINED",
] as const;

export type EarthBoundaryQuality = (typeof EARTH_BOUNDARY_QUALITIES)[number];

export const EARTH_VERIFICATION_STATUSES = [
  "VERIFIED_SOURCE",
  "PENDING_REVIEW",
  "REJECTED",
] as const;

export type EarthVerificationStatus = (typeof EARTH_VERIFICATION_STATUSES)[number];

export const EARTH_CRS_WGS84 = "EPSG:4326" as const;
export const EARTH_GEOGRAPHY_DEFAULT_LIMIT = 25;
export const EARTH_GEOGRAPHY_MAX_LIMIT = 100;
export const EARTH_GEOMETRY_MAX_BYTES = 1_000_000;
