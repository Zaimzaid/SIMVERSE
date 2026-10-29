import { describe, expect, it } from "vitest";
import { PLANET_HOME_DESKTOP_DISTANCE, SIGNATURE_PLANET_V1, planetHomeCameraDistance } from "./visual-contract";

describe("Signature Orbital Planet visual contract", () => {
  it("has no seeded fictional or real-world countries", () => {
    expect(SIGNATURE_PLANET_V1.countries).toEqual([]);
    expect(SIGNATURE_PLANET_V1.radiusKm).toBe(6000);
  });

  it("fits the orbital ring in a 390px portrait-width viewport", () => {
    const aspect = 390 / 780;
    const distance = planetHomeCameraDistance(aspect);
    const visibleHalfWidth = distance * Math.tan((42 * Math.PI / 180) / 2) * aspect;
    expect(visibleHalfWidth).toBeGreaterThanOrEqual(SIGNATURE_PLANET_V1.maxVisualRadius - 1e-10);
    expect(distance).toBeGreaterThan(7.15);
  });

  it("keeps the preferred desktop framing and protects against malformed aspect ratios", () => {
    expect(planetHomeCameraDistance(16 / 9)).toBe(PLANET_HOME_DESKTOP_DISTANCE);
    expect(planetHomeCameraDistance(0)).toBe(PLANET_HOME_DESKTOP_DISTANCE);
    expect(planetHomeCameraDistance(Number.NaN)).toBe(PLANET_HOME_DESKTOP_DISTANCE);
  });
});
