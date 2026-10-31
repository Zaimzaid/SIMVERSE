import { describe, expect, it } from "vitest";
import { CONCEPT_CONTINENTS, conceptPointInContinent } from "./concept-geography";
import { CONCEPT_COUNTRY_BOUNDARIES, conceptBoundaryWithinContinent } from "./concept-country-boundaries";
import { polygonsOverlap, validatePlanetGeometry } from "./geometry";
import {
  CONCEPT_BIOMES, CONCEPT_ISLANDS, CONCEPT_LAKES, CONCEPT_MOUNTAINS,
  CONCEPT_RESOURCE_SITES, CONCEPT_RIVERS, CONCEPT_TERRAIN_STATUS,
  conceptIslandPath, conceptLinePath,
} from "./concept-terrain";

describe("terrain concept is original, valid and not authoritative", () => {
  it("keeps five valid, non-overlapping refined coastlines and the ten draft countries inside", () => {
    expect(CONCEPT_CONTINENTS).toHaveLength(5);
    for (let i = 0; i < CONCEPT_CONTINENTS.length; i++) {
      const continent = CONCEPT_CONTINENTS[i]!;
      expect(continent.geometry.type).toBe("Polygon");
      if (continent.geometry.type === "Polygon") {
        expect(continent.geometry.coordinates[0]!.length).toBeGreaterThan(35);
      }
      expect(validatePlanetGeometry(continent.geometry).areaKm2).toBeGreaterThan(100_000);
      for (let j = i + 1; j < CONCEPT_CONTINENTS.length; j++) {
        expect(polygonsOverlap(continent.geometry, CONCEPT_CONTINENTS[j]!.geometry)).toBe(false);
      }
    }
    for (const country of CONCEPT_COUNTRY_BOUNDARIES) {
      expect(conceptBoundaryWithinContinent(country), country.name).toBe(true);
    }
  });

  it("keeps offshore island sketches individually valid and separate from the five mainlands", () => {
    expect(CONCEPT_ISLANDS).toHaveLength(10);
    for (let i = 0; i < CONCEPT_ISLANDS.length; i++) {
      const island = CONCEPT_ISLANDS[i]!;
      expect(validatePlanetGeometry(island.geometry).areaKm2).toBeGreaterThan(1000);
      expect(conceptIslandPath(island)).toMatch(/^M.* Z$/);
      for (const land of CONCEPT_CONTINENTS) expect(polygonsOverlap(island.geometry, land.geometry)).toBe(false);
      for (let j = i + 1; j < CONCEPT_ISLANDS.length; j++) {
        expect(polygonsOverlap(island.geometry, CONCEPT_ISLANDS[j]!.geometry)).toBe(false);
      }
    }
  });

  it("keeps concept terrain landmarks inside the designated landmass", () => {
    const continentFor = (id: string) => {
      const land = CONCEPT_CONTINENTS.find((item) => item.id === id);
      expect(land).toBeDefined();
      return land!;
    };
    expect(CONCEPT_MOUNTAINS).toHaveLength(5);
    expect(CONCEPT_RIVERS).toHaveLength(5);
    expect(CONCEPT_LAKES).toHaveLength(5);
    expect(CONCEPT_BIOMES).toHaveLength(10);
    expect(CONCEPT_RESOURCE_SITES).toHaveLength(10);
    for (const line of [...CONCEPT_MOUNTAINS, ...CONCEPT_RIVERS]) {
      expect(conceptLinePath(line.points)).toMatch(/^M/);
      for (const point of line.points) expect(conceptPointInContinent(point, continentFor(line.continentId))).toBe(true);
    }
    for (const lake of CONCEPT_LAKES) {
      expect(conceptPointInContinent(lake.center, continentFor(lake.continentId))).toBe(true);
      expect(lake.longitudeRadius).toBeGreaterThan(0);
      expect(lake.latitudeRadius).toBeGreaterThan(0);
    }
    for (const patch of CONCEPT_BIOMES) {
      expect(conceptPointInContinent(patch.center, continentFor(patch.continentId))).toBe(true);
    }
    for (const site of CONCEPT_RESOURCE_SITES) {
      expect(conceptPointInContinent(site.center, continentFor(site.continentId))).toBe(true);
      expect(site).not.toHaveProperty("countryOwnerId");
      expect(site).not.toHaveProperty("yield");
    }
  });

  it("marks every terrain item as unapproved and provides no published property", () => {
    expect(CONCEPT_TERRAIN_STATUS).toBe("UNAPPROVED_TERRAIN_STUDY");
    for (const island of CONCEPT_ISLANDS) {
      expect(island).not.toHaveProperty("publishedVersionId");
      expect(island).not.toHaveProperty("ownerId");
    }
  });
});
