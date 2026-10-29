# SIMVERSE Planet — Stage 0 audit & Stage 1 implementation checkpoint

Date: 2026-10-29
Branch: feature/signature-orbital-planet-spec-v1
Reference: docs/planet/SIGNATURE_ORBITAL_PLANET_V1.md

## Grounded repository baseline

The verified master repository has a Next.js application with React, TypeScript, Prisma and both MapLibre/Three.js.
The *legacy Earth* public page is `src/app/earth/page.tsx`, using `src/components/earth/public-earth-explorer.tsx` and `src/server/services/earth-public-service.ts`.
This flow reads sourced country data through `EarthGeoPlace` and `EarthGeoPlaceRevision`; the public overview still uses pinned Natural Earth vector tiles. It cannot simply be relabeled as a fictional globe.

Existing data-bearing Prisma models include `EarthGeoDataset`, `EarthGeoDatasetVersion`, `EarthGeoImport`, `EarthGeoPlace`, `EarthGeoPlaceRevision`, `EarthSteward`, `EarthDevelopmentZone`, `EarthDevelopmentZoneVersion`, and `EarthDevelopmentZoneLifecycleEvent`.
Existing `World`, `WorldVersion` and `Asset` models must remain intact. Existing Earth zone/parcel experiments and neighborhood proof are not fictional Country records. All previous geography remains preserved while this branch introduces the new planet.

## Stage 1 change inventory

- `/planet` — independent public visual-proof route.
- `src/components/planet/signature-planet-explorer.tsx` — responsive viewer, pointer/pinch/keyboard controls, zoom, orbit pause, reset, no-WebGL fallback, accessible help.
- `src/lib/planet/signature-planet-renderer.ts` — procedural planet, atmosphere, tilted orbital rings, sparse stars, camera positioning, lifecycle disposal.
- `src/lib/planet/visual-contract.ts` — explicit zero-country state and camera sizing for narrow portraits.
- `src/lib/planet/visual-contract.test.ts` — empty state and visual framing tests.
- `src/app/page.tsx` — link to preview.
- No schema migrations, country seeds, imported geography, writes to user data or changes to `/earth` are included.

## Rollout / safe migration gates

1. Finish Stage 1 compile/test/actual visual browser verification.
2. Add dedicated fictional Planet/Country tables and services (not EarthGeoPlace with fictional ISO codes).
3. Implement server-validated polygon topology, spherical surface areas, published revision history, overlap rules and owner/admin authorization.
4. Wire Country Creator and browser selection to real saved records. Do not preserve the Stage 1 hardcoded empty state after live records are available.
5. Add real country-to-World binding and functional country entry.
6. Audit and migrate or archive any dependent Earth items and user-created virtual assets, with backup and rollback. Only then replace real-world `/earth` navigation.
7. Remove obsolete geography code/import paths after verification and owner approval for any destructive operations.

## Current truth and unresolved checks

- Stage 0: repository structure and primary legacy dependencies identified; full live-data migration inventory pending.
- Stage 1: source code committed, automated CI and real browser visual QA required before it can be marked complete.
- Stages 2–8: not started.
- **No country has been created or published.**
- `/planet` deliberately advertises Stage 1 visual proof; no misleading Country Creator or Enter buttons exist.
- The globe cannot be considered visually accepted without browser/device evidence. Tests alone cannot verify actual image quality.
