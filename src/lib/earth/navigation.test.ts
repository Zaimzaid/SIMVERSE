import { describe, expect, it } from "vitest";
import { EARTH_PLACE_KINDS } from "./constants";
import { earthPlaceFocusMaxZoom, isEarthSettlement } from "./navigation";

describe("SIMVERSE Earth progressive navigation", () => {
  it("supports every normalized place kind", () => {
    for (const kind of EARTH_PLACE_KINDS) {
      expect(earthPlaceFocusMaxZoom(kind)).toBeGreaterThan(0);
    }
  });

  it("zooms progressively from country through LGA to locality", () => {
    expect(earthPlaceFocusMaxZoom("COUNTRY")).toBeLessThan(earthPlaceFocusMaxZoom("ADMIN1"));
    expect(earthPlaceFocusMaxZoom("ADMIN1")).toBeLessThan(earthPlaceFocusMaxZoom("ADMIN2"));
    expect(earthPlaceFocusMaxZoom("ADMIN2")).toBeLessThan(earthPlaceFocusMaxZoom("CITY"));
  });

  it("distinguishes administrative boundaries from settlements", () => {
    expect(isEarthSettlement("ADMIN1")).toBe(false);
    expect(isEarthSettlement("ADMIN2")).toBe(false);
    expect(isEarthSettlement("CITY")).toBe(true);
    expect(isEarthSettlement("TOWN")).toBe(true);
    expect(isEarthSettlement("LOCALITY")).toBe(true);
  });
});
