import { describe, expect, it } from "vitest";
import { FOUNDING_COUNTRIES } from "./founding-plan";
import { polygonsOverlap, validatePlanetGeometry } from "./geometry";
import {
  CONCEPT_CONTINENTS, CONCEPT_COUNTRY_SITES,
  CONCEPT_MAP_STATUS, conceptContinentPath, conceptMapPoint,
  conceptPointInContinent, conceptSiteName,
} from "./concept-geography";

describe("original unapproved five-continent concept", () => {
  it("contains exactly five non-overlapping valid fictional landmass shapes", () => {
    expect(CONCEPT_CONTINENTS).toHaveLength(5);
    const ids = new Set(CONCEPT_CONTINENTS.map((continent) => continent.id));
    expect(ids.size).toBe(5);
    for (const continent of CONCEPT_CONTINENTS) {
      const shape = validatePlanetGeometry(continent.geometry);
      expect(shape.areaKm2).toBeGreaterThan(0);
      expect(conceptContinentPath(continent)).toMatch(/^M/);
      expect(conceptContinentPath(continent)).toMatch(/ Z$/);
    }
    for (let i = 0; i < CONCEPT_CONTINENTS.length; i++) {
      for (let j = i + 1; j < CONCEPT_CONTINENTS.length; j++) {
        expect(polygonsOverlap(CONCEPT_CONTINENTS[i]!.geometry, CONCEPT_CONTINENTS[j]!.geometry)).toBe(false);
      }
    }
  });

  it("places all ten candidate markers inside their proposed continents", () => {
    expect(CONCEPT_COUNTRY_SITES).toHaveLength(10);
    expect(new Set(CONCEPT_COUNTRY_SITES.map((site) => site.slug)).size).toBe(10);
    expect(CONCEPT_COUNTRY_SITES.map((site) => site.slug).sort())
      .toEqual(FOUNDING_COUNTRIES.map((country) => country.slug).sort());
    for (const site of CONCEPT_COUNTRY_SITES) {
      const continent = CONCEPT_CONTINENTS.find((entry) => entry.id === site.continentId);
      expect(continent).toBeDefined();
      expect(conceptPointInContinent(site.center, continent!)).toBe(true);
      expect(conceptSiteName(site)).toBeTruthy();
      const [x, y] = conceptMapPoint(site.center);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1000);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(500);
    }
  });

  it("has no publisher, citizen rights or geographic-seeding claims", () => {
    expect(CONCEPT_MAP_STATUS).toBe("UNAPPROVED_VISUAL_CONCEPT");
    for (const site of CONCEPT_COUNTRY_SITES) {
      expect(site).not.toHaveProperty("geometry");
      expect(site).not.toHaveProperty("publishedVersionId");
      expect(site).not.toHaveProperty("ownerId");
      expect(site).not.toHaveProperty("districts");
    }
  });
});
