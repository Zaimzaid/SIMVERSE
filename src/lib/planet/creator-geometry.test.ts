import { describe, expect, it } from "vitest";
import { createStarterTerritory, drawTerritory, wrapLongitude } from "./creator-geometry";
import { validatePlanetGeometry } from "./geometry";

describe("Country Creator geometry", () => {
  it("builds an editable, valid, organic starter country for Galex", () => {
    const geometry = createStarterTerritory([23, 12], 650);
    const result = validatePlanetGeometry(geometry);
    expect(result.areaKm2).toBeGreaterThan(500_000);
    expect(result.areaKm2).toBeLessThan(2_000_000);
  });
  it("generates valid countries near fictional longitude wrap", () => {
    const geometry = createStarterTerritory([179, -20], 700);
    expect(validatePlanetGeometry(geometry).areaKm2).toBeGreaterThan(0);
    expect(wrapLongitude(181)).toBe(-179);
  });
  it("requires at least three vertices to close a drawn territory", () => {
    expect(drawTerritory([[0,0],[5,0]])).toBeNull();
    const shape = drawTerritory([[0,0],[6,0],[6,6],[0,6]]);
    expect(shape).not.toBeNull();
    expect(validatePlanetGeometry(shape).areaKm2).toBeGreaterThan(0);
  });
});
