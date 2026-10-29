# Signature Orbital Planet — Visual Refinement V1.1

Date: 2026-10-29
Base: master, merge of Phase 1–2
Branch: `feature/planet-visual-refinement-v11`
Status: implementation and automated validation pending; no visual sign-off yet

## Problem evidence

The owner opened `/planet` and provided a screenshot. The design renders but showed an obvious longitudinal surface colour discontinuity, a strong/uneven atmosphere tint, undersized supporting text, and a planet silhouette that could fill more of the viewer. The red development error was specifically sourced from a MetaMask extension script (`chrome-extension://...`), so this project does not attempt to intercept or conceal that external error.

## Scope and code changes

- Replaced the raw x-indexed canvas colour/noise patterns with a deterministic **3D-direction sampled surface field** (`src/lib/planet/surface-field.ts`). The first and final longitude texture pixels now agree at every latitude, so there is no injected seam at the map wrap.
- Reduced atmosphere shell size and rim opacity, tuned cool fill and directional illumination to avoid the wide teal/violet glow that hid the planet edges.
- Reduced secondary ring halos/glow strength while retaining two signature orbital rings.
- Reduced desktop home camera distance from 7.15 to 6.45 world units, with additional aspect-aware portrait safety margin.
- Improved description/status/help typography and spacing for a more readable beginner experience.
- Replaced potentially passive React wheel handler with a native non-passive wheel listener that is cleaned up on unmount.
- Skip GPU render calls when the planet is not rotating; interactive controls still render on demand.
- Added seam/field unit tests and updated camera-framing tests.

## Preservation

No country data is seeded, no routes are replaced and no database, imported Earth geography, country creator contract, authorizations or production land records are changed. This is only a visual frontend refinement.

## Quality gate

Run database preparation, TypeScript, lint, Vitest and Next.js build through GitHub Actions. Visual acceptance remains an **independent manual browser gate**: compare actual old/new screenshots at desktop and 390px, rotate a complete revolution to confirm seam-free appearance, inspect ring layering and atmospheric rim, test mouse/touch zoom, disabled auto-orbit under reduced-motion preferences, WebGL fallback, and GPU/device performance. Do not claim production-grade visual QA from successful compilation alone.

When this focused change is verified, the next coding phase is **Phase 3 Country Creator** (a governed, beginner-friendly country drawing/preview/publishing interface backed by the existing Phase 2 service).
