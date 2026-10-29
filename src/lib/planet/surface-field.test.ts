import { describe, expect, it } from "vitest";
import { samplePlanetSurface } from "./surface-field";

describe("planet surface field", () => {
  it("is continuous at the longitudinal wrap for multiple latitudes", () => {
    for (const lat of [0.01, 0.15, 0.5, 0.68, 0.99]) {
      expect(samplePlanetSurface(0, lat)).toEqual(samplePlanetSurface(1, lat));
    }
  });
  it("does not have a raw-x texture discontinuity and returns legal colors", () => {
    for (let y = 0; y <= 10; y++) {
      for (let x = 0; x <= 20; x++) {
        const c = samplePlanetSurface(x / 20, y / 10);
        expect(c).toHaveLength(3);
        expect(c.every(v => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true);
      }
    }
    expect(samplePlanetSurface(0.25, 0.37)).not.toEqual(samplePlanetSurface(0.64, 0.42));
  });
});
