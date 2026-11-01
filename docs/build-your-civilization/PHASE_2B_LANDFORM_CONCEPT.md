# SIMVERSE Build Your Civilization — Phase 2B / Landform Concept v1

**Branch:** `feature/build-your-civilization-phase2b-landforms`  
**Stacked on:** `feature/build-your-civilization-phase2-geography` (Phase 2A draft PR #48, dependent on Phase 1 PR #47).  
**Product status:** **UNAPPROVED_VISUAL_CONCEPT**. Not production/published geography.

## Delivered in Phase 2B concept slice

1. Created five **original fictional** continent polygon silhouettes, with coordinates in the existing planet-local longitude/latitude coordinate scheme. No Earth tile, coastline, nation, real-world ISO code or location dataset is used.
2. Added ten **country-site markers**, one per proposed founding country (Valdora, Arandia, Novara, Dravonia, Marovia, Solandia, Vestria, Altavia, Eldoria, Terranova). A marker is **not a border, capital, ownership deed or permitted building site**. Capitals/state positions are not fixed.
3. Added a responsive, accessible browser preview `/planet/planning/map` with a flat 2D concept atlas, highlighted country selection and a link back to the detailed administrative plan.
4. Added an optional globe concept view `/planet/planning/globe` that renders the landmasses onto the existing orbital planet **only when requested**. The original `/planet` default continues to show its unallocated sphere and its existing approved empty-state behavior.
5. Included validation tests for five individually valid, pairwise non-overlapping landmasses; ten distinct candidate site locations inside their proposed continent; and no false published/owner claims.
6. All geometry is design data in `src/lib/planet/concept-geography.ts` and does not write to DB or call the fiction-country publication API.

## What has NOT been delivered

- No published country, registered fictional country polygons, shape-based sovereign division, verified coastline hydrology, mountain biome/ecology, national area calculations, capitals or state/city/district boundary data.
- No country editor or steward approval action, no data migrations, no signed-off continent names, no parcel rights or citizenship affiliation, no protected nature/road zoning, no changes to /api/planet/countries.
- The existing empty sphere still is not the actual published-country globe, and the 2D/3D concept overlays are **not** selectable sovereign geometry.
- The 10 markers are not guaranteed final or correctly sized by national landmass size. The sizes planned in `founding-plan.ts` remain provisional and require allocation with constrained shape designs.

## Why this distinction matters

The authoritative `FictionalCountry` and `FictionalCountryVersion` backend validates and publishes individually approved country geometry. This prototype should not silently create or publish ten rectangles, countries, districts or claimed land merely to make the globe look finished. The objective of this slice is to let the owner evaluate visual direction first.

## Owner visual acceptance checklist

- [ ] Do the five continental silhouettes look original and sufficiently distinctive?
- [ ] Should there be more islands, straits, inland seas, mountain belts, climate and biome cues?
- [ ] Are the relative continent placements and ocean gaps appealing?
- [ ] Do the ten proposed country sites make sense before detailed national partitioning?
- [ ] Does 2D concept atlas work on mobile? Is text legible and are country selection controls usable?
- [ ] Does 3D concept globe render and rotate on mobile and desktop, with usable zoom and smooth interactions?
- [ ] Is the original `/planet` default still a truthful unallocated world?
- [ ] Are preview labels obvious enough to distinguish proposed land from approved/published territory?

## Next geographic slices

**Phase 2B.2 — Design revision:** owner-approved visual geography, improved coasts/islands, natural resources, rivers/lakes and biome placement, all performance constrained.

**Phase 2B.3 — Sovereign geometry:** country-boundary sketch for each founding name, validated contained/non-overlapping shapes and measured areas, staged as private steward drafts after geographic approval. Do not auto-publish.

**Phase 2B.4 — Real planet overlay:** render steward-published official polygons, pointer/keyboard selection, search, accessible country list, empty/fallback states. Keep country scene access honest.

**Phase 2C — Geographic hierarchy:** persistent verified continent/state/city/district place records and rigorous containment, revisions and spatial constraints.

## Verification and merge gates

GitHub Actions: typecheck, lint, unit/integration test, Next build using CI disposable DB. Separately verify screenshots/browser navigation, mobile controls and two-account authorization regressions. Preserve Phase 1/2A draft dependency; do not merge straight to `master` without owner review and independent QA.
