import { describe, expect, it } from "vitest";
import { earthZoneOverviewFeatures } from "./zone-overview";

describe("Earth development-zone overview", () => {
  it("shows approximate zone markers without generating parcel geometry", () => {
    const features = earthZoneOverviewFeatures([{
      id: "zone_0123456789abcdef01234567",
      name: "Synthetic test",
      bbox: [3.3998, 6.5498, 3.4032, 6.5532],
      isDemonstration: true,
    }]);
    expect(features).toHaveLength(1);
    expect(features[0].geometry.type).toBe("Point");
    expect(features[0].geometry.coordinates[0]).toBeCloseTo(3.4015);
    expect(features[0].properties.approximate).toBe(true);
    expect(features[0].properties.isDemonstration).toBe(true);
    expect(features[0]).not.toHaveProperty("properties.ownerId");
  });

  it("does not imply zone availability where none exists", () => {
    expect(earthZoneOverviewFeatures([])).toEqual([]);
  });

  it("rejects malformed spatial bounds", () => {
    expect(() => earthZoneOverviewFeatures([{
      id: "zone_x", name: "bad", bbox: [9, 2, 8, 3],
      isDemonstration: false,
    }])).toThrow(/invalid bounds/);
  });
});
