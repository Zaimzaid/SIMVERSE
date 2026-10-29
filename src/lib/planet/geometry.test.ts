import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { PLANET_RADIUS_KM, polygonsOverlap, validatePlanetGeometry, type PlanetGeometry } from "./geometry";

function box(w: number, s: number, e: number, n: number): PlanetGeometry {
  return { type: "Polygon", coordinates: [[[w,s],[e,s],[e,n],[w,n],[w,s]]] };
}

describe("fictional planet territory geometry", () => {
  it("computes realistic area for a 10 degree square on the fictional 6000km sphere", () => {
    const { areaKm2, label } = validatePlanetGeometry(box(0, 0, 10, 10));
    expect(PLANET_RADIUS_KM).toBe(6000);
    expect(areaKm2).toBeGreaterThan(1_000_000);
    expect(areaKm2).toBeLessThan(1_200_000);
    expect(label[0]).toBeGreaterThanOrEqual(0);
    expect(label[0]).toBeLessThanOrEqual(10);
  });

  it("rejects unclosed, self-crossing, degenerate and out-of-range shapes", () => {
    expect(() => validatePlanetGeometry({ type: "Polygon", coordinates: [[[0,0],[5,0],[5,5],[0,5]]] })).toThrow(ValidationError);
    expect(() => validatePlanetGeometry({ type: "Polygon", coordinates: [[[0,0],[6,6],[0,6],[6,0],[0,0]]] })).toThrow(ValidationError);
    expect(() => validatePlanetGeometry(box(1,1,1,2))).toThrow(ValidationError);
    expect(() => validatePlanetGeometry(box(175, 0, 191, 5))).toThrow(ValidationError);
    expect(() => validatePlanetGeometry({ type: "Point", coordinates: [0,0] })).toThrow(ValidationError);
  });

  it("detects overlapping countries but permits a shared border", () => {
    const a = box(0,0,10,10);
    expect(polygonsOverlap(a,box(5,5,15,15))).toBe(true);
    expect(polygonsOverlap(a,box(10,0,20,10))).toBe(false);
    expect(polygonsOverlap(a,box(25,0,35,10))).toBe(false);
    expect(polygonsOverlap(a,box(0,0,10,10))).toBe(true);
    expect(polygonsOverlap(a,box(2,2,4,4))).toBe(true);
  });

  it("supports dateline-crossing fictional islands and calculates compact area", () => {
    const across = box(176, 1, -176, 6);
    const result = validatePlanetGeometry(across);
    expect(result.areaKm2).toBeGreaterThan(300_000);
    expect(result.areaKm2).toBeLessThan(700_000);
    expect(polygonsOverlap(across, box(-179,2,-177,5))).toBe(true);
    expect(polygonsOverlap(across,box(0,0,5,5))).toBe(false);
  });

  it("supports a hole without assigning its unallocated area to the country", () => {
    const donut: PlanetGeometry = {
      type: "Polygon", coordinates: [
        [[0,0],[10,0],[10,10],[0,10],[0,0]],
        [[3,3],[3,7],[7,7],[7,3],[3,3]],
      ],
    };
    expect(validatePlanetGeometry(donut).areaKm2).toBeLessThan(validatePlanetGeometry(box(0,0,10,10)).areaKm2);
    expect(polygonsOverlap(donut,box(4,4,6,6))).toBe(false);
    expect(polygonsOverlap(donut,box(1,1,2,2))).toBe(true);
  });

  it("validates detached landmasses as non-overlapping multipolygons", () => {
    const islands: PlanetGeometry = { type: "MultiPolygon", coordinates: [
      [[[0,0],[4,0],[4,4],[0,4],[0,0]]],
      [[[12,0],[16,0],[16,4],[12,4],[12,0]]],
    ] };
    expect(validatePlanetGeometry(islands).areaKm2).toBeGreaterThan(300_000);
    const bad: PlanetGeometry = { type: "MultiPolygon", coordinates: [
      [[[0,0],[10,0],[10,10],[0,10],[0,0]]],
      [[[5,5],[15,5],[15,15],[5,15],[5,5]]],
    ] };
    expect(() => validatePlanetGeometry(bad)).toThrow(ValidationError);
  });

  it("rejects holes crossing exterior, redundant edges and nested holes", () => {
    expect(() => validatePlanetGeometry({ type: "Polygon", coordinates: [
      [[0,0],[10,0],[10,10],[0,10],[0,0]],
      [[6,6],[12,6],[12,8],[6,8],[6,6]],
    ] })).toThrow(ValidationError);
    expect(() => validatePlanetGeometry({ type: "Polygon", coordinates: [
      [[0,0],[10,0],[10,10],[0,10],[0,0]],
      [[2,2],[8,2],[8,8],[2,8],[2,2]],
      [[3,3],[4,3],[4,4],[3,4],[3,3]],
    ] })).toThrow(ValidationError);
  });
});
