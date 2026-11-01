import { describe, expect, it } from "vitest";
import {
  conceptCountryHref, conceptFocusRotation, conceptGlobeHref,
  conceptMapHref, getPlannedDistrictLocation, isConceptCountrySlug,
  resolveConceptCountrySlug,
} from "./concept-navigation";
import { CONCEPT_COUNTRY_SITES } from "./concept-geography";
import { FOUNDING_COUNTRIES, plannedStateSlots } from "./founding-plan";

describe("KAVANDRO K2 nonpublishing world navigation", () => {
  it("validates every fictional founding country and rejects untrusted slugs", () => {
    for (const country of FOUNDING_COUNTRIES) {
      expect(isConceptCountrySlug(country.slug)).toBe(true);
      expect(conceptCountryHref(country.slug)).toBe(`/planet/planning/${country.slug}`);
      expect(conceptMapHref(country.slug)).toContain(`country=${country.slug}`);
      expect(conceptGlobeHref(country.slug)).toContain(`country=${country.slug}`);
    }
    for (const invalid of ["", "earth", "..", "nigeria", "valdora?admin=1"]) {
      expect(isConceptCountrySlug(invalid)).toBe(false);
      expect(conceptCountryHref(invalid)).toBeNull();
      expect(conceptMapHref(invalid)).toBe("/planet/planning/map");
      expect(conceptGlobeHref(invalid)).toBe("/planet/planning/globe");
    }
    expect(resolveConceptCountrySlug("../../")).toBe(FOUNDING_COUNTRIES[0]!.slug);
    expect(resolveConceptCountrySlug(null)).toBe(FOUNDING_COUNTRIES[0]!.slug);
  });

  it("gives a deterministic, finite camera orientation for every concept marker", () => {
    for (const site of CONCEPT_COUNTRY_SITES) {
      const [pitch, yaw] = conceptFocusRotation(site.center);
      expect(Number.isFinite(pitch)).toBe(true);
      expect(Number.isFinite(yaw)).toBe(true);
      expect(Math.abs(pitch)).toBeLessThan(Math.PI / 2);
    }
    expect(conceptFocusRotation([-90, 0])).toEqual([0, 0]);
    expect(conceptFocusRotation([0, 0])[1]).toBeCloseTo(-Math.PI / 2);
    expect(conceptFocusRotation([90, 0])[1]).toBeCloseTo(-Math.PI);
    expect(() => conceptFocusRotation([Infinity, 0])).toThrow();
    expect(() => conceptFocusRotation([0, 100])).toThrow();
  });

  it("resolves district planning keys without manufacturing live district coordinates", () => {
    const country = FOUNDING_COUNTRIES.find((p) => p.slug === "arandia")!;
    const first = plannedStateSlots(country)[0]!.cities[0]!.districts[0]!;
    const found = getPlannedDistrictLocation(country.slug, first.key);
    expect(found?.district.status).toBe("PILOT_CANDIDATE");
    expect(found?.country.name).toBe("Arandia");
    expect(found).not.toHaveProperty("coordinates");
    expect(found).not.toHaveProperty("publishedDistrictId");
    expect(getPlannedDistrictLocation(country.slug, "not-a-district")).toBeNull();
    expect(getPlannedDistrictLocation("valdora", first.key)).toBeNull();
    expect(getPlannedDistrictLocation("earth", first.key)).toBeNull();
  });
});
