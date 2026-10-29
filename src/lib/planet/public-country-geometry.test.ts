import { describe, expect, it } from "vitest";
import { countryContainsPoint, findCountryAtPoint, type PublishedPlanetCountry } from "./public-country-geometry";
import type { PlanetGeometry } from "./geometry";
const square: PlanetGeometry = { type: "Polygon", coordinates: [[[0,0],[10,0],[10,10],[0,10],[0,0]]] };
const fake: PublishedPlanetCountry = { id: "country123", planetId: "simverse-planet-v1", name: "Galex", slug: "galex", description: null, color: "#38DCE4", status: "PUBLISHED", publishedRevision: 1, areaKm2: 150, label: [5,5], geometry: square };
describe("public country hit testing", () => {
  it("selects a country only inside published geometry", () => {
    expect(countryContainsPoint(square, [5,5])).toBe(true);
    expect(countryContainsPoint(square, [0,3])).toBe(true);
    expect(countryContainsPoint(square, [12,5])).toBe(false);
    expect(findCountryAtPoint([fake], [6,6])?.name).toBe("Galex");
    expect(findCountryAtPoint([], [6,6])).toBe(null);
  });
  it("supports detached island polygons and the longitude boundary", () => {
    const multi: PlanetGeometry = { type: "MultiPolygon", coordinates: [
      [[[175,0],[-175,0],[-175,6],[175,6],[175,0]]],
      [[[-60,-20],[-55,-20],[-55,-15],[-60,-15],[-60,-20]]],
    ] };
    expect(countryContainsPoint(multi, [178,2])).toBe(true);
    expect(countryContainsPoint(multi, [-178,2])).toBe(true);
    expect(countryContainsPoint(multi, [-58,-18])).toBe(true);
    expect(countryContainsPoint(multi, [0,2])).toBe(false);
  });
  it("excludes unallocated holes and does not select labels outside geometry", () => {
    const donut: PlanetGeometry = { type: "Polygon", coordinates: [
      [[0,0],[10,0],[10,10],[0,10],[0,0]],
      [[3,3],[3,7],[7,7],[7,3],[3,3]],
    ] };
    expect(countryContainsPoint(donut,[2,2])).toBe(true);
    expect(countryContainsPoint(donut,[5,5])).toBe(false);
    expect(countryContainsPoint(donut,[3,5])).toBe(false);
  });
});
