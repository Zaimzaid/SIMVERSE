/**
 * Canonical Phase 4 development demonstration.
 *
 * This geometry is synthetic and exists only to exercise the virtual-land
 * discovery experience inside the sourced Lagos State context. It is not
 * cadastral data, authentic Lagos land inventory, or an offer of ownership.
 */
export const EARTH_PHASE4_DEMO_ZONE_KEY = "lagos-phase4-synthetic-grid";
export const EARTH_PHASE4_DEMO_ZONE_CANONICAL_KEY = `earth:zone:${EARTH_PHASE4_DEMO_ZONE_KEY}`;

export function phase4DevelopmentZoneInput(placeId: string) {
  return {
    key: EARTH_PHASE4_DEMO_ZONE_KEY,
    name: "Lagos Phase 4 Synthetic Test Zone",
    placeId,
    isDemonstration: true,
    definition: {
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [3.3998, 6.5498],
          [3.4032, 6.5498],
          [3.4032, 6.5532],
          [3.3998, 6.5532],
          [3.3998, 6.5498],
        ]],
      },
      exclusions: [{
        id: "phase4-validation-reserve",
        name: "Synthetic validation reserve",
        reason: "Demonstrates that prohibited areas remove intersecting full cells.",
        geometry: {
          type: "Polygon" as const,
          coordinates: [[
            [3.4010, 6.5510],
            [3.4015, 6.5510],
            [3.4015, 6.5515],
            [3.4010, 6.5515],
            [3.4010, 6.5510],
          ]],
        },
      }],
      projectionSrid: 32631,
      gridOrigin: [3.4, 6.55] as [number, number],
      gridBearingDegrees: 0,
      cellWidthMeters: 25,
      cellHeightMeters: 25,
      edgePolicy: "FULL_CELL" as const,
      restrictions: {
        zoningCode: "PHASE4-TEST-MIXED",
        zoningLabel: "Synthetic mixed-use validation",
        allowedUses: ["test-residential", "test-community"],
        maximumHeightMeters: 18,
        minimumSetbackMeters: 2,
        notes: "Test-only rules for parcel-discovery verification. No acquisition is available.",
      },
      provenance: {
        title: "SIMVERSE Phase 4 synthetic Lagos-positioned fixture",
        description: "Purpose-built virtual polygon used to verify deterministic grid generation inside Lagos State context.",
        sourceUrl: null,
        licenseName: "SIMVERSE test fixture",
        reviewedContext: "Position checked against the pinned geoBoundaries Lagos State generalized boundary.",
        isSynthetic: true,
      },
      reviewNote: "Test-only Phase 4 fixture; never publish as real or cadastral Lagos inventory.",
    },
  };
}
