import { CONCEPT_COUNTRY_SITES } from "./concept-geography";
import {
  FOUNDING_COUNTRIES, getFoundingCountry, plannedStateSlots,
} from "./founding-plan";
import type { PlanetPoint } from "./geometry";

/**
 * Read-only links between the flat fictional concept atlas, orbital globe,
 * country hierarchy and district planning slots.
 *
 * No result from this module is a published country, official district,
 * land parcel, citizenship, or residence. These are planning records only.
 */
export function isConceptCountrySlug(value: string | null | undefined): value is string {
  return typeof value === "string"
    && FOUNDING_COUNTRIES.some((country) => country.slug === value)
    && CONCEPT_COUNTRY_SITES.some((site) => site.slug === value);
}

export function resolveConceptCountrySlug(value: string | null | undefined): string {
  return isConceptCountrySlug(value) ? value : FOUNDING_COUNTRIES[0]!.slug;
}

export function conceptMapHref(value?: string | null): string {
  return isConceptCountrySlug(value)
    ? `/planet/planning/map?country=${encodeURIComponent(value)}`
    : "/planet/planning/map";
}

export function conceptGlobeHref(value?: string | null): string {
  return isConceptCountrySlug(value)
    ? `/planet/planning/globe?country=${encodeURIComponent(value)}`
    : "/planet/planning/globe";
}

export function conceptCountryHref(value: string): string | null {
  return isConceptCountrySlug(value)
    ? `/planet/planning/${encodeURIComponent(value)}`
    : null;
}

/**
 * The Three.js SphereGeometry receives the same 0..1 equirectangular UV map
 * as the concept atlas. With the camera on +Z, a location is front-centered
 * by yaw=-PI/2-longitude and pitch=latitude.
 * No actual place or coordinate on Earth is involved.
 */
export function conceptFocusRotation(point: PlanetPoint): readonly [number, number] {
  const [longitude, latitude] = point;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error("Invalid planet-local concept coordinates");
  }
  return [latitude * Math.PI / 180, -Math.PI / 2 - longitude * Math.PI / 180];
}

export function getPlannedDistrictLocation(countrySlug: string, districtKey: string) {
  const country = getFoundingCountry(countrySlug);
  if (!country) return null;
  for (const state of plannedStateSlots(country)) {
    for (const city of state.cities) {
      for (const district of city.districts) {
        if (district.key === districtKey) return { country, state, city, district };
      }
    }
  }
  return null;
}
