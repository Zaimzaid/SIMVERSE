import { describe, expect, it } from "vitest";
import { FOUNDING_COUNTRIES } from "./founding-plan";
import { polygonsOverlap, validatePlanetGeometry } from "./geometry";
import {
  COUNTRY_BOUNDARY_SKETCH_STATUS, CONCEPT_COUNTRY_BOUNDARIES,
  countryBoundaryPath, conceptBoundaryWithinContinent,
} from "./concept-country-boundaries";

describe("provisional sovereign boundary sketch (not publishable country records)", () => {
  it("creates ten original geometries that remain unpublished concepts", () => {
    expect(COUNTRY_BOUNDARY_SKETCH_STATUS).toBe("UNAPPROVED_BOUNDARY_SKETCH");
    expect(CONCEPT_COUNTRY_BOUNDARIES).toHaveLength(10);
    expect(CONCEPT_COUNTRY_BOUNDARIES.map((country) => country.slug).sort())
      .toEqual(FOUNDING_COUNTRIES.map((country) => country.slug).sort());
    expect(new Set(CONCEPT_COUNTRY_BOUNDARIES.map((country) => country.color)).size).toBe(10);
    for (const country of CONCEPT_COUNTRY_BOUNDARIES) {
      expect(country.geometry.type).toBe("Polygon");
      expect(validatePlanetGeometry(country.geometry).areaKm2).toBeCloseTo(country.areaKm2);
      expect(country.areaKm2).toBeGreaterThan(100_000);
      expect(countryBoundaryPath(country).startsWith("M")).toBe(true);
      expect(countryBoundaryPath(country).endsWith(" Z")).toBe(true);
      expect(conceptBoundaryWithinContinent(country)).toBe(true);
      expect(country).not.toHaveProperty("publishedRevision");
      expect(country).not.toHaveProperty("ownerId");
    }
  });

  it("never overlaps a neighboring country, including same-continent candidates", () => {
    for (let first = 0; first < CONCEPT_COUNTRY_BOUNDARIES.length; first++) {
      for (let second = first + 1; second < CONCEPT_COUNTRY_BOUNDARIES.length; second++) {
        const a = CONCEPT_COUNTRY_BOUNDARIES[first]!;
        const b = CONCEPT_COUNTRY_BOUNDARIES[second]!;
        expect(polygonsOverlap(a.geometry, b.geometry), `${a.slug} vs ${b.slug}`).toBe(false);
      }
    }
  });

  it("uses the planned size classes, but never suggests they are final sovereign areas", () => {
    for (const country of CONCEPT_COUNTRY_BOUNDARIES) {
      const plan = FOUNDING_COUNTRIES.find((item) => item.slug === country.slug);
      expect(country.size).toBe(plan?.size);
    }
    const compare = (country: string) => CONCEPT_COUNTRY_BOUNDARIES.find((x) => x.slug === country)!.areaKm2;
    expect(compare("arandia")).toBeGreaterThan(compare("valdora"));
    expect(compare("dravonia")).toBeGreaterThan(compare("novara"));
    expect(compare("terranova")).toBeGreaterThan(compare("eldoria"));
  });
});
