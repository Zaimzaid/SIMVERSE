# SIMVERSE — Build Your Civilization | Phase 2C.0 Country Topology Readiness

**Status:** review-only, unapproved geographic concept.  
**Branch:** `feature/build-your-civilization-phase2c-topology-audit`.  
**Base:** `feature/build-your-civilization-phase2b-terrain` (draft PR #51).  
**Dependency:** stacked behind PRs #51, #50, #49, #48 and #47. Not approved or merged to `master`.

## Why this step exists

Early Phase 2B country sketches checked a few samples of each country boundary against its parent continent. Sampling can miss a coastline crossing between samples, notably across a concave notch. The stricter **concept-only planar check** implemented here validates every child vertex is strictly within the intended parent and checks every child edge against every mainland edge. A child boundary touching/crossing the coastline fails. The check refuses polygons with holes, dateline wraps, multi-polygon cases or non-closed/out-of-range concept rings; those require a different spatial implementation.

**This is intentionally not production geodetic topology:** geometry lives in equirectangular, fictional longitude/latitude space; complex spherical poles, holes, shared boundary semantics, antimeridian handling, GIS precision, permanent land cadastre, versioned union/partition topology and actual approved publication remain unimplemented in this slice.

## Files

- `src/lib/planet/concept-topology.ts` — strict limited-scope containment check, no DB effects.
- `src/lib/planet/concept-topology.test.ts` — valid interior, coastal contact, external vertex, concave U-shaped coast crossing (all vertices on land), unsupported shapes, ten country sketches.
- `src/lib/planet/concept-country-boundaries.ts` — replaces sampled coastline verification with the above strict check.
- `src/lib/planet/concept-audit.ts` — pure report including ten sketch geometry checks, country overlap, five-continent nominal unassigned land percentage and explicit concept-only, unpublished state.
- `src/lib/planet/concept-audit.test.ts` — report invariants and truthful publication disclaimers.
- `/planet/planning/audit` — publicly viewable **concept readiness** report. No access to privileged country drafts or writes.
- `/planet/planning/map` — direct link to the report.

## Acceptance checkpoints

1. CI TypeScript, ESLint, unit/integration tests and Next production build pass on disposable database. Browser/device QA is separate.
2. Ten existing *sketches* pass restricted planar containment and mutual non-overlap. If they do not, report and repair concept data, not official geographies.
3. A concave parent coastline with an interior-vertex bridge crossing open water fails strict containment.
4. Shoreline touch, outside vertices, wraparound and holes fail closed.
5. Report labels all borders **unapproved**, all areas **draft**, and resource sites **unallocated**.
6. Read-only report does not import the Prisma client or mutate `FictionalCountry` tables.
7. Continent nominal unassigned land is not claimed or made available for citizen allocation.
8. Visually inspect report table at desktop and mobile widths; ensure side-scroll rather than clipping.
9. Owner signoff on landmass/country aesthetics and actual historical branch QA remains necessary.

## What has NOT changed

No planet database migration; no fictional country created, approved or published; no activation of 38 states/76 cities/228 district slots; no district residents, citizens, resources, Vascoin, land rights or real-Earth data changes.

## Next implementation only after design approval

1. Strengthen **spherical GIS** geometry checks and versioning (full country within coastline with holes/islands, shared border definitions, antimeridian and polar policy).
2. Obtain owner review of shapes and resource study markers; finalize world geography and continent names.
3. Establish controlled steward-only drafts and map overlays of **published** countries, honoring the existing authorization system.
4. Design persistent state/city/district parent relationships and actual spatial boundaries with safe migrations and rollback plans.
5. First pilot district can only activate under population, moderation and production-capacity gates.

Do **not** infer project completion from a green geometry report; it is a necessary sketch validation result, not a substitute for the above design, safety or deployment gates.
