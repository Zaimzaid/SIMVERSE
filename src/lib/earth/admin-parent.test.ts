import { describe, expect, it } from "vitest";
import { matchEarthParentRegion, pointInEarthRegion } from "./admin-parent";
import type { EarthRegionGeometry } from "./admin-parent";

function polygon(west: number, south: number, east: number, north: number): EarthRegionGeometry {
  return { type: "Polygon", coordinates: [[
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ]] };
}

describe("Sourced administrative parent matching", () => {
  const westState = { key: "West", geometry: polygon(0, 0, 5, 5) };
  const eastState = { key: "East", geometry: polygon(5, 0, 10, 5) };

  it("maps a small LGA to its containing state, independently of name", () => {
    expect(matchEarthParentRegion(polygon(1, 1, 2, 2), [eastState, westState]).key).toBe("West");
    expect(matchEarthParentRegion(polygon(7, 1, 8, 2), [eastState, westState]).key).toBe("East");
  });

  it("rejects ambiguous and out-of-state administrative geometry", () => {
    expect(() => matchEarthParentRegion(polygon(4, 1, 6, 2), [westState, eastState])).toThrow(/Ambiguous/);
    expect(() => matchEarthParentRegion(polygon(12, 1, 13, 2), [westState, eastState])).toThrow(/Ambiguous/);
  });

  it("honors polygon holes and multi-polygon islands", () => {
    const geometry: EarthRegionGeometry = {
      type: "Polygon",
      coordinates: [
        [[0, 0], [6, 0], [6, 6], [0, 6], [0, 0]],
        [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]],
      ],
    };
    expect(pointInEarthRegion([1, 1], geometry)).toBe(true);
    expect(pointInEarthRegion([3, 3], geometry)).toBe(false);
    expect(pointInEarthRegion([7, 7], geometry)).toBe(false);
  });
});
