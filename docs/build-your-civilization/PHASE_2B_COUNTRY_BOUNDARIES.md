# SIMVERSE — Phase 2B.3 | Sovereign Border Design Sketches (Not Published)

**Branch:** `feature/build-your-civilization-phase2b-country-boundaries`  
**Base:** `feature/build-your-civilization-phase2b-landforms` (draft PR #49); stacked beneath Phase 2A PR #48 and Phase 1 PR #47.  
**Status:** UNAPPROVED_BOUNDARY_SKETCH; code implementation for review, not a live territory deployment.

## What this slice adds

- Ten custom original 12-vertex (closed) boundaries for all founding countries, built as deterministic design sketches around **existing candidate concept sites**, with differentiated SMALL, MEDIUM and LARGE footprints. Drawn in planet-local degrees, not Earth WGS84 shapes.
- Uses the existing `validatePlanetGeometry` area calculation on the fictitious planet of radius 6000 km; does not substitute pixel area for measured area.
- Runs independent automated checks for country shape validity, pairwise non-overlap and approximate containment within concept continents.
- `/planet/planning/map` includes a **Show/Hide draft borders** toggle, distinguishable selected country and measured **draft** area with a warning against treating the measured area as official.
- `/planet/planning/globe` draws draft country shapes onto the **opt-in concept preview texture only**. The default `/planet` remains an unallocated visual proof. Globe concept does not provide playable country selection.
- No production API, fictional country database, stewardship grant, real-Earth data, district plot, citizenship or financial record has been changed.

## Do not mistake this slice for formal publication

These sketches are **isolated national footprint proposals**, not complete partitions of the five continents; substantial unallocated land remains between them. The concept country centers, national shapes and areas remain subject to owner review. Their relative size class is for visual comparison only; their final area and resource allocation have **not** been established.

The design-stage containment function checks sample points along country boundary segments. This is intentionally **not** presented as a formal GIS containment guarantee. Later, before a steward accepts any draft, require exact topological containment, coastline and border checks, published polygon conflict checks, area and usable-land metrics, immutable revision storage and independent permission checks. If continent boundaries change, these sketches must be revalidated.

## Visual acceptance

1. Open `/planet/planning/map`: check ten colored country outlines and responsive country selection.
2. Toggle draft borders off: confirm the original continent/site-marker concept is still viewable.
3. Select each nation: confirm an appropriate outline highlight, individual draft area and size class.
4. Open `/planet/planning/globe`: rotate/zoom and confirm coastlines and country boundaries look aligned with the flat map.
5. Open `/planet`: confirm no concept sovereign boundaries are implicitly published to normal visitors.
6. Check narrow mobile layouts, keyboard tab/focus, reduced-motion behavior and WebGL fallback.

## Next iteration after owner feedback

- Revise outlines and position(s) based on actual visual evidence and country size/shape preferences.
- If approval is explicit, create **separate unpublished steward drafts** through the existing authenticated country API, check geometry and overlaps on the backend and present a publication review.
- Do not publish all ten countries automatically; no citizen land rights or administrative entities should be seeded from a concept-map sketch.
- Add realistic administrative hierarchy and district land zoning in later phases, once sovereign geometry has been accepted.

## CI and release policy

Require TypeScript, lint, automated tests, Next production build and real browser/device QA before merging. Existing stacked PRs remain drafts; this slice must not be merged directly to `master`.
