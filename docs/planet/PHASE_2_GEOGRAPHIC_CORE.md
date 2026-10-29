# SIMVERSE Planet — Phase 2 geographic-core implementation

**Date:** 2026-10-29
**Branch:** `feature/signature-orbital-planet-spec-v1`
**Design authority:** [SIGNATURE_ORBITAL_PLANET_V1.md](./SIGNATURE_ORBITAL_PLANET_V1.md)

## Intent and scope

Phase 2 adds a **fictional** country data layer. It is not a real-world geographic import and does not seed Galex or any country. This backend is separate from all legacy `EarthGeo*` tables, Natural Earth tiles, Nigerian states, and Earth land parcels.

**This phase delivers the geographic backend, NOT the Country Creator graphical interface (Phase 3), globe overlays (Phase 4), or enter-country runtime (Phase 5).** The Stage 1 `/planet` page remains a deliberately empty visual proof until the live catalog integration.

## Backend models

- `FictionalPlanet`: stable planet ID `simverse-planet-v1`, name, radius convention (6000 km).
- `FictionalCountry`: stable identity, draft/published revision references, editable metadata, status (DRAFT / PUBLISHED / ARCHIVED), creator ID.
- `FictionalCountryVersion`: immutable geometry and **published metadata snapshot** (name, slug, description, color), revision, shape hash, area, internal label anchor and author.
- `FictionalPlanetSteward`: independently assigned administrative grant. A workspace owner/administrator alone **cannot** create or publish a planetary country.

The planet record is created lazily on first authorized country draft. The first public catalog response contains an empty `countries: []` collection even if no planet record exists.

## API contract

Public (no login): `GET /api/planet/countries`, `GET /api/planet/countries/:countryId`.

Authenticated, steward-authorized routes:

- `GET /api/planet/admin/countries` — protected editor country list (draft and published revisions).
- `POST /api/planet/admin/countries` — create draft with original geometry.
- `PATCH /api/planet/admin/countries/:countryId` — update metadata/shape, creating a new immutable draft revision.
- `POST /api/planet/admin/countries/:countryId/publish` — atomically validate and publish draft; reject overlap with other published countries.
- `POST /api/planet/admin/countries/:countryId/archive` — remove from public discovery without deleting revision history.

Example owner-authored, fictional rectangular territory (illustrative, not an actual country):

```json
{
  "name": "Galex",
  "description": "An original territory on the SIMVERSE planet",
  "color": "#38DCE4",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [[0, 0], [6, 0], [6, 6], [0, 6], [0, 0]]
    ]
  }
}
```

The endpoint requires a signed-in, explicitly granted steward; this JSON should never be treated as a planet seed.

### Bootstrap for the real platform owner

To enroll a **pre-existing** user whose workspace role is OWNER/ADMIN, a trusted operator with database access may run locally:

```sh
npm run db:push
node scripts/grant-fictional-planet-steward.mjs --email=actual-owner@example.com --publish --confirm
```

Replace the email with an existing owner account. The script refuses an unknown user, non-privileged workspace membership, missing database config or missing `--confirm`. The script never creates a country. Do **not** expose this operation as an HTTP route or automatically grant every workspace owner.

The current SQLite developer setup uses `prisma db push`. Before production deployment, introduce and verify an explicit migration, backup and rollback strategy for the real configured database. Never run destructive schema reset on user data.

## Validation / security behavior

- Public views return **only published version snapshots**; unpublished metadata edits are never exposed.
- Geometry is a GeoJSON-style Polygon / MultiPolygon in fictional coordinates, longitudes [-180, 180] and latitudes strictly between -89.999 and 89.999 degrees. Full pole caps are deferred until robust spherical topology support is verified.
- Validates closed rings, finite points, non-degeneracy, self-crossings, holes and islands; rejects excessive vertices/size and non-overlapping publish conflicts.
- Allows antimeridian-crossing polygons by unwrapping longitude for topology tests.
- Computes approximate spherical surface area using 6000 km radius.
- Rejects published-country interior overlap; adjacent borders may touch.
- Publishing and archival actions are audited; deleted countries are not physically removed.
- Public country list caps results; access to drafts requires both privileged workspace membership and explicit steward grant.

## Required verification and limitations

- Run `npm run db:push`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` in CI.
- Integration tests verify no countries are seeded, owner without steward is denied, draft visibility is private, published revisions remain pinned, overlap enforcement, audit events and soft archival.
- Pure geometry tests cover area, invalid self-crossing boundaries, holes, islands, dateline-crossing shapes and edge-sharing.
- This is a first bounded geometry implementation, not a production-grade global geodesic/geodetic GIS system. Exact poles, extremely complex spherical polygons, heavy concurrency and final PostGIS behavior need explicit additional proof before supporting them.
- The underlying 3D globe overlay and country creation **UI** are not implemented in this phase. Do not claim that Galex can be placed visually on `/planet` yet.
