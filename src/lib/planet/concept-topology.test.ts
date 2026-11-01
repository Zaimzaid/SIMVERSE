import { describe, expect, it } from "vitest";
import { strictlyContainsConceptPolygon } from "./concept-topology";
import { validatePlanetGeometry, type PlanetGeometry } from "./geometry";

function outline(points: [number, number][]): PlanetGeometry {
  return { type: "Polygon", coordinates: [[...points, points[0]!] ] };
}

describe("strict concept-only coastline containment", () => {
  const rectangle = outline([[0, 0], [10, 0], [10, 10], [0, 10]]);
  it("accepts fully interior child, rejects coastal touch and outside vertices", () => {
    expect(strictlyContainsConceptPolygon(rectangle, outline([[1, 1], [4, 1], [4, 4], [1, 4]]))).toBe(true);
    expect(strictlyContainsConceptPolygon(rectangle, outline([[0, 1], [4, 1], [4, 4], [0, 4]]))).toBe(false);
    expect(strictlyContainsConceptPolygon(rectangle, outline([[8, 8], [12, 8], [12, 9], [8, 9]]))).toBe(false);
    expect(strictlyContainsConceptPolygon(rectangle, rectangle)).toBe(false);
  });

  it("catches a concave coastline crossing with all child vertices on land", () => {
    // U-shaped mainland: top-center notch is ocean. All four child vertices
    // sit in the left or right peninsulas, but its connecting edges cross water.
    const concave = outline([[0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10]]);
    const bridge = outline([[1,7],[9,7],[9,8],[1,8]]);
    validatePlanetGeometry(concave);
    validatePlanetGeometry(bridge);
    expect(strictlyContainsConceptPolygon(concave, bridge)).toBe(false);
    expect(strictlyContainsConceptPolygon(concave, outline([[1,1],[2,1],[2,2],[1,2]]))).toBe(true);
  });

  it("fails closed for unsupported holes and dateline wraps", () => {
    const withHole: PlanetGeometry = { type: "Polygon", coordinates: [
      [[0,0],[10,0],[10,10],[0,10],[0,0]],
      [[3,3],[7,3],[7,7],[3,7],[3,3]],
    ] };
    expect(strictlyContainsConceptPolygon(withHole, outline([[1,1],[2,1],[2,2],[1,2]]))).toBe(false);
    const crossing = outline([[176,1],[-176,1],[-176,5],[176,5]]);
    expect(strictlyContainsConceptPolygon(crossing, outline([[177,2],[179,2],[179,3],[177,3]]))).toBe(false);
  });

  it("applies to current concept continents and all 10 country drafts", async () => {
    const { CONCEPT_CONTINENTS } = await import("./concept-geography");
    const { CONCEPT_COUNTRY_BOUNDARIES } = await import("./concept-country-boundaries");
    expect(CONCEPT_COUNTRY_BOUNDARIES).toHaveLength(10);
    for (const country of CONCEPT_COUNTRY_BOUNDARIES) {
      const parent = CONCEPT_CONTINENTS.find((continent) => continent.id === country.continentId);
      expect(parent).toBeDefined();
      expect(strictlyContainsConceptPolygon(parent!.geometry, country.geometry), country.slug).toBe(true);
    }
  });
});
