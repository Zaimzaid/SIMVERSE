# SIMVERSE Earth - Phase 3 Interactive 3D Earth Explorer

## 1. Checkpoint status

- **Branch:** `feature/simverse-earth-land`
- **Baseline:** `11f5ab1` (`docs: close SIMVERSE Earth Phase 2 verification`)
- **Verified:** 2026-10-25
- **Status:** implementation and verification complete; Phase 4 has not started.

Phase 3 turns the Phase 2 geography proof into a public, read-only Earth entry
experience. Guests can render and manipulate a real MapLibre globe, search the
allowlisted country catalog, and select a supported destination. Protected
geography remains behind authentication, active workspace membership and the
existing `workspace.view` authorization path.

## 2. Delivered experience

- `/earth` is public and does not require the Platform shell or a workspace.
- The globe renders local, versioned Natural Earth vector tiles with visible
  attribution and dataset details.
- Rotation, pan, zoom, reset and reduced-motion behavior work without writes.
- Public search returns countries only. The current reviewed catalog exposes
  Nigeria; Lagos and subdivision details are not present in the guest response.
- Selecting Nigeria creates a bounded signed intent and offers the existing
  login and registration flows.
- Successful login or registration restores the intended country through
  `/earth/restore`, then re-resolves it through the protected geography service.
- The authenticated explorer navigates Nigeria, all 37 first-level
  subdivisions, Lagos State and the point-only Lagos locality with truthful
  boundary-quality copy and breadcrumbs.
- A no-WebGL state explains the visual limitation while preserving the
  accessible country list and authentication path.

No parcel, Development Zone, ownership, acquisition, payment or construction
capability was added.

## 3. Overview dataset and vector tiles

| Field | Verified value |
| --- | --- |
| Dataset | Natural Earth, 1:110m physical land |
| Version | 5.1.2 |
| Pinned revision | `f1890d9f152c896d250a77557a5751a93d494776` |
| License | Public Domain |
| Source snapshot | `data/earth/overview/v1/ne_110m_land.geojson` |
| Source size | 138,160 bytes |
| Source SHA-256 | `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9` |
| Tile zooms | 0 through 2 |
| Generated tiles | 21 |
| Total tile bytes | 35,184 |
| Runtime manifest | `public/earth/overview/v1/manifest.json` |

`npm run earth:generate:overview` uses the pinned source and
`scripts/generate-earth-overview-tiles.mjs` to create deterministic Mapbox
Vector Tiles. The public tiles contain land silhouettes and no Natural Earth
feature properties. Runtime delivery therefore does not expose the raw source
GeoJSON or internal geography records. `geojson-vt` and `vt-pbf` are build-time
development dependencies for this generator.

The overview basemap and the application geography catalog have separate
responsibilities:

- Natural Earth supplies low-zoom land context only.
- The active Phase 2 catalog supplies the strict public country projection and
  all authorized geography detail.
- Public responses never derive a city boundary from the overview land layer.

## 4. Routes and service boundaries

| Route or path | Access | Responsibility |
| --- | --- | --- |
| `/earth` | Public | Globe, public country list/search and protected-selection gate. |
| `/api/earth/public/overview` | Public, rate limited | Overview metadata plus allowlisted supported countries. |
| `/api/earth/public/search` | Public, rate limited | Validated country-only name search, maximum ten results. |
| `/api/earth/public/intents` | Public, rate limited | Creates a fixed-purpose signed intent for an existing public country. |
| `/earth/restore` | Authentication transition | Validates intent, requires platform context and reauthorizes the destination. |
| `/earth/geography` | Authenticated | Existing protected hierarchy, source, boundary and quality explorer. |
| `/earth/overview/v1/tiles/{z}/{x}/{y}.pbf` | Public static asset | Immutable low-zoom land tiles. |

The Phase 2 protected API routes and geography service remain authoritative.
The restore service calls `getEarthPlace(userId, workspaceId, placeId)`, so a
valid signature cannot bypass membership, workspace or permission checks.

## 5. Destination-intent security

The intent is an HMAC-SHA-256 signed JSON payload with:

- protocol version `1`;
- fixed purpose `earth-protected-destination`;
- one validated public place ID;
- issue and expiry timestamps;
- an exact ten-minute lifetime.

It contains no return URL and cannot redirect outside the approved Earth flow.
Authentication pages retain only a token that passes the strict token schema.
After authentication, the server verifies the signature and lifetime again,
loads the active platform context, and performs a fresh protected-place lookup.
Expired, tampered, unavailable or unauthorized intents return to the safe public
Earth route without revealing record existence.

The three public APIs use fixed-window limits keyed by a hash of request address
and user agent: 60 overview reads, 30 searches and 10 intent creations per
minute. The store is bounded to 2,048 process-local buckets. This is suitable
for the current single-process foundation; a shared limiter is required before
horizontal production deployment.

## 6. Browser verification

Actual browser verification used Chrome `155.0.8059.86` on Windows
`10.0.26300`, headless with SwiftShader WebGL, an isolated SQLite database and
the application on port 3020. The QA account, database, browser profile and
automation script were removed afterward.

Verified results:

- public `/earth` returned 200 and rendered one real MapLibre canvas;
- rotation, zoom and camera reset produced distinct rendered-frame hashes;
- a representative PBF request returned 200 and browser network events observed
  78 successful worker tile responses during the full camera/navigation run;
- no raw GeoJSON request occurred;
- guest protected-API access returned 401, including after logout;
- public search found Nigeria and returned no Lagos locality result;
- both registration and login restored the signed Nigeria destination;
- Nigeria exposed 37 subdivisions after authorization;
- Lagos State selection and Lagos `CITY` selection worked, with `POINT_ONLY`
  quality and an actual `Point` geometry rather than a fabricated polygon;
- the login gate had usable focus order and closed with Escape;
- reduced motion disabled automatic rotation;
- 390, 768, 1024 and 1440 px viewports had no document overflow;
- the WebGL-disabled fallback remained helpful and usable;
- no console errors, page exceptions, HTTP 500 responses or genuine request
  failures occurred. Five aborted tile requests were expected cancellations
  during camera changes and route teardown.

Evidence:

- [Public Earth desktop](evidence/phase3-public-earth-desktop.png)
- [Public Earth mobile](evidence/phase3-public-earth-mobile.png)
- [Guest login gate](evidence/phase3-guest-login-gate.png)
- [Authenticated point-only Lagos](evidence/phase3-authenticated-lagos.png)
- [WebGL fallback](evidence/phase3-earth-webgl-fallback.png)
- [Machine-readable browser record](evidence/phase3-browser-verification.json)

## 7. Measured browser profile

These are development-mode measurements from the named headless environment,
not a cross-device production performance claim.

| Measurement | Result |
| --- | ---: |
| Public navigation to ready | 4,968 ms |
| Map load callback | 2,547 ms |
| Nigeria to Lagos State navigation | 1,181 ms |
| Main-thread resource entries | 25 |
| Main-thread transfer bytes | 1,410,846 |
| Raw GeoJSON requests | 0 |
| JavaScript heap used snapshot | 24,259,281 bytes |

Worker tile fetches are visible in browser network events but not in the page's
main-thread Resource Timing list. The JSON evidence records that distinction.
Release budgets still require named production hardware, network and browser
targets.

## 8. Automated verification

| Command | Result |
| --- | --- |
| `npm run earth:generate:overview` | Passed; 21 tiles, 35,184 bytes. |
| Focused Phase 3 tests | Passed; 8 tests across 4 files. |
| `npx vitest run` | Passed; 407 tests across 46 files. |
| `npx tsc --noEmit` | Passed. |
| `npx eslint .` | Passed. |
| `npx prisma validate` | Passed. |
| `npx prisma generate` | Passed; Prisma Client 7.10.0. |
| `npm run build` | Passed; public Earth and public API routes emitted. |
| `git diff --check` | Passed. |

No Prisma schema, Runtime Protocol v1, SimulationRun snapshot or Battle/Race/
Survival mechanics file changed.

## 9. Known limits and next gate

- The reviewed active geography catalog currently supports Nigeria only.
- Natural Earth land tiles provide coarse global context at zooms 0-2; they do
  not claim country, subdivision, locality or property accuracy.
- The rate limiter is process local.
- Browser measurements cover one Chrome/Windows headless environment. Firefox,
  Safari and physical-device release coverage remain future gates.
- SQLite remains the active application datasource. The isolated PostGIS proof
  is complete, but no datasource cutover occurred.
- Phase 4 must begin with the preserved deterministic parcel-algorithm proof and
  separate owner approval. Phase 3 creates no virtual property state.
