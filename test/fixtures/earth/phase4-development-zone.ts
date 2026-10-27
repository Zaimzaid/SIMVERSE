/**
 * Synthetic Phase 4 demonstration geometry positioned inside the sourced
 * Lagos State boundary. It is a virtual test fixture, not cadastral data and
 * not an assertion that real Lagos plots are available.
 */
export function phase4DevelopmentZoneInput(placeId: string) {
  return {
    key: "lagos-phase4-synthetic-grid",
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
