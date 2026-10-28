# SIMVERSE Earth - Phase 2 Global Geography Engine

## 1. Scope and status

Phase 2 establishes a sourced, versioned geography catalog and an authenticated
internal explorer. It proves this navigation path:

`Earth -> Nigeria -> State -> supported locality`

It does not add parcels, acquisition, ownership, construction, payments or a
public production globe. Nigeria is the first proof dataset; it is not evidence
of global data coverage.

| Requirement | Status | Evidence / limit |
| --- | --- | --- |
| Geography datasets, versions, places, hierarchy, geometry quality and provenance | **Verified Complete** | Dedicated `EarthGeo*` Prisma models; separate from World Blueprints. |
| Reproducible Nigeria/Lagos import | **Verified Complete** | Pinned manifest, SHA-256 checks, 39 records, immutable revisions and repeat-import tests. |
| Preserve current SQLite application | **Verified Complete** | Additive schema applied with the repository's existing `prisma db push` convention; existing datasource/provider retained. |
| Isolated PostgreSQL/PostGIS schema | **Verified Complete** | GitHub Actions run [40155016832](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40155016832) executed the bootstrap and constraint suite successfully on PostgreSQL 17.11/PostGIS 3.6.4. |
| Staged PostgreSQL/PostGIS migration plan | **Verified Complete** | See [POSTGIS_MIGRATION_PLAN.md](POSTGIS_MIGRATION_PLAN.md). No cutover occurred. |
| Geography services and authenticated APIs | **Verified Complete** | Country, subdivision, place, search, boundary, hierarchy, issue and catalog-status reads use existing auth/error conventions. |
| Internal MapLibre globe explorer | **Verified Complete** | Chrome 155 rendered the MapLibre globe, sourced Nigeria/Lagos geometry, search, camera controls, mobile layout and the no-WebGL fallback. Production homepage work remains Phase 3. |
| Geographic correctness regressions | **Verified Complete** | Unit/integration tests cover hierarchy, WGS84 validation, checksums, duplicates, repeatability, versions, point-only localities, search, limits and failures. |
| Existing product and simulation safety | **Verified Complete** | Runtime Protocol, Battle/Race/Survival mechanics, Run snapshots, Worlds, Assets and property systems were not changed. |

### Real PostGIS execution evidence

On 2026-10-25, GitHub Actions run
[40155016832](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40155016832)
executed against commit `c7235780d8141f283676a06af15c98d38562a680` on an
Ubuntu 24.04 runner. The isolated service used
`postgis/postgis:17-3.6-alpine` at image digest
`sha256:cd7b00a457793cabd269af2af292a994754d130ac1e564ae1c053abb22b947cf`.
The recorded database stack was PostgreSQL `17.11`, PostGIS `3.6.4`, GEOS
`3.14.1` and PROJ `9.8.1`.

The workflow applied and verified the schema with these command forms:

```bash
docker exec -i "$service_id" psql -U simverse_verify \
  -d simverse_earth_verify -v ON_ERROR_STOP=1 \
  < infrastructure/earth-postgis/init/001-earth-geography.sql
docker exec -i "$service_id" psql -U simverse_verify \
  -d simverse_earth_verify -v ON_ERROR_STOP=1 \
  < infrastructure/earth-postgis/verify/phase2-verification.sql
```

The run confirmed that the PostGIS extension initializes; the five-table
`earth_geo` schema is created; valid WGS84 polygon geometry persists; invalid
self-intersecting, non-WGS84, null typed and declared/type-mismatched geometry
is rejected; orphan and restricted-delete foreign keys hold; only one current
revision is allowed per place; and the hierarchy, GiST geometry and partial
current-revision indexes exist. Reapplying the versioned one-time bootstrap to
the populated database failed atomically as designed and left row counts at
`1:2:1`; applying the same bootstrap to an independent fresh database succeeded
and produced all five tables. This exercised real PostgreSQL/PostGIS without
changing the application's SQLite datasource or development database.

The uploaded `earth-postgis-verification` log is artifact
[`12584422007`](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40155016832/artifacts/12584422007),
with SHA-256 digest
`de0245af73551b67512ee1ee582a30f86e978631a9d152d4aad21685b94aa65c`.

## 2. Catalog model

The catalog is global reference data. Workspace membership is still required to
use the Phase 2 internal APIs and page, but the same sourced place records are
visible from every authorized workspace. The models are:

- `EarthGeoDataset`: immutable provider/release identity and attribution;
- `EarthGeoDatasetVersion`: pinned source revision, manifest checksum and
  lifecycle (`STAGED`, `ACTIVE`, `SUPERSEDED`);
- `EarthGeoImport`: one auditable attempt with read/create/update/skip counts;
- `EarthGeoPlace`: stable public and canonical identity plus parent hierarchy;
- `EarthGeoPlaceRevision`: immutable version-specific WGS84 geometry,
  provenance, content hash, bounds and quality state.

The SQLite baseline stores canonical GeoJSON text because the existing
application remains on SQLite. Large binaries are not stored in the database.
The isolated PostGIS proof uses `geometry(Geometry, 4326)`, validity constraints
and a GiST index.

The catalog is deliberately separate from `World` and `WorldVersion`. A World
is workspace-authored simulation blueprint metadata; Earth geography is sourced
global reference data.

## 3. Source snapshot

All committed source files are declared in
[`data/earth/sources/manifest.json`](../../data/earth/sources/manifest.json).
The importer verifies each file checksum and expected feature count before it
writes any source records.

### geoBoundaries gbOpen

- provider/release: geoBoundaries `gbOpen`;
- pinned source revision: `9469f09`;
- dataset version: `gbopen-nga-9469f09`;
- Nigeria ADM0 boundary ID: `NGA-ADM0-39225661`;
- Nigeria ADM1 boundary ID: `NGA-ADM1-27671186`;
- represented boundary year: 2022;
- underlying source named by the provider: GRID3;
- license recorded by the provider: CC BY 4.0;
- imported features: one country and 37 first-level subdivisions;
- quality: `GENERALIZED_BOUNDARY` because the committed files are simplified
  display geometry, not cadastral or survey boundaries.

### GeoNames

- source: Nigeria country dump `NG.zip`, retrieved 2026-10-24;
- archive SHA-256:
  `bdf3d76c54362a680b307e07d1207e52a7febd153aaf08fef520744e622b7342`;
- dataset version: `geonames-ng-2026-10-24-bdf3d76c`;
- imported feature: GeoNames `2332459`, Lagos, at WGS84 longitude `3.39467`,
  latitude `6.45407`;
- license: CC BY 4.0;
- quality: `POINT_ONLY`. No Lagos city polygon is inferred or fabricated.

Attribution and source links remain in every dataset response so a UI can show
them with the data.

## 4. Import process

After applying the current Prisma schema, run:

```powershell
npx prisma db push
npm run earth:import:nigeria
```

The command is a Nigeria acceptance wrapper over the country-neutral manifest
reader. The underlying importer uses each source's declared adapter, ISO alpha-2
and alpha-3 coverage, source feature identifiers, hierarchy and quality policy;
it does not contain a Nigeria-only database or identity model. The command:

1. reads and validates the source manifest;
2. validates WGS84 coordinates and closed Polygon/MultiPolygon rings;
3. verifies SHA-256 and feature counts;
4. derives stable public IDs, canonical keys, bounds and content hashes;
5. creates or verifies immutable dataset versions and place revisions;
6. preserves parent relationships;
7. activates the imported versions and records the import outcome.

Repeating the command is idempotent. The verified second run skips all 38
geoBoundaries records and the one GeoNames record while retaining 39 places and
39 revisions. Every run still receives its own import-history row.

Source releases must never be replaced in place. Add a new versioned directory
and manifest entry; prior revisions remain inspectable.

### Extensibility evidence

A clearly labeled synthetic second-country fixture exercises the same importer
with `CA` / `CAN` country identity and an `ADMIN1` child. Its invented rectangular
geometry is marked `PENDING_REVIEW` and `APPROXIMATE_BOUNDARY`, uses a reserved
`.invalid` provider URL, and is never presented as authentic Canadian geography.
Unit and database integration tests prove deterministic IDs/revisions and repeat
import behavior without adding country-specific branches. The production proof
still covers Nigeria only.

## 5. Services and API routes

All routes require the existing authenticated API context and an active
workspace membership with `workspace.view`. A user supplied workspace ID is not
trusted, and a non-member receives the existing safe NotFound response.

| Route | Purpose |
| --- | --- |
| `GET /api/earth/geography/countries` | List supported countries. |
| `GET /api/earth/geography/countries/{countryId}/subdivisions` | List first-level subdivisions of a supported country. |
| `GET /api/earth/geography/places` | Search/filter supported places by name, kind or parent. |
| `GET /api/earth/geography/places/{placeId}` | Retrieve one place and its hierarchy metadata. |
| `GET /api/earth/geography/places/{placeId}/boundary` | Retrieve bounded GeoJSON and source quality metadata. |
| `GET /api/earth/geography/places/{placeId}/hierarchy` | Retrieve ordered ancestors through the selected place. |
| `GET /api/earth/geography/issues` | Find point-only, missing, approximate, disputed or quarantined boundaries. |
| `GET /api/earth/geography/status` | Inspect active datasets and recent import history. |

List responses default to 25 records and reject limits above 100. Geometry
responses reject payloads above 1,000,000 bytes. Inputs pass strict Zod schemas,
and routes use the existing safe response/error layer.

## 6. Geography explorer

1. apply the schema and run the Nigeria importer;
2. start the existing app with `npm run dev` (the project uses port 3020);
3. sign in and open `http://localhost:3020/earth/geography` or select **Earth
   Lab** in the Build navigation group;
4. select Nigeria, then Lagos State, or search for Lagos;
5. inspect the source, version, CRS and boundary quality shown beside the globe.

The explorer uses MapLibre GL JS with its globe projection and a local empty
style, then renders the actual selected source GeoJSON. It does not depend on a
third-party basemap or expose an API key. If WebGL fails, the sourced hierarchy
and place lists remain usable. The final public homepage and guest interaction
flow remain Phase 3 work.

### Browser verification evidence

On 2026-10-25, Google Chrome `155.0.8059.86` was driven against `npm run dev`
on port 3020 and an isolated disposable SQLite database. The run verified:

- an anonymous explorer request redirects to authentication;
- a signed-in user receives one visible WebGL canvas;
- Nigeria renders from its sourced WGS84 boundary and exposes all 37 ADM1 rows;
- Lagos State can be searched, selected and highlighted as a generalized
  boundary;
- GeoNames Lagos renders as a point with the `POINT_ONLY` explanation;
- zoom and drag change the rendered camera, and MapLibre navigation controls are
  clickable;
- keyboard Tab moves from the search input to the labeled search button and
  Enter submits the search;
- source/version attribution and boundary-quality labels remain visible;
- the 390 by 844 layout has no document-level horizontal overflow;
- simulated unavailable WebGL shows the fallback while place selection remains
  usable; and
- no console errors, uncaught page errors or HTTP 5xx responses occurred.

The browser run exposed and fixed two real defects before passing: MapLibre v6's
separate worker URL now follows its documented Next/Turbopack setup, and the map
host uses explicit full dimensions so MapLibre's own positioning CSS cannot
collapse the interaction area. Machine-readable evidence is in
[`evidence/phase2-browser-verification.json`](evidence/phase2-browser-verification.json).
Reviewed screenshots:

- [Nigeria boundary](evidence/phase2-geography-nigeria.png)
- [Lagos State selection](evidence/phase2-geography-desktop.png)
- [390 px point-only locality](evidence/phase2-geography-mobile.png)
- [WebGL fallback](evidence/phase2-geography-webgl-fallback.png)

### Phase 3 public-globe authentication boundary

Phase 2 remains internal and authenticated: its page uses
`requirePlatformContext`, every geography API uses `requireApiContext`, and
services enforce active workspace membership plus `workspace.view`. Foreign
workspace IDs retain the safe NotFound response and are covered by integration
tests.

Phase 3 can expose an unauthenticated visual globe shell and public, allowlisted
overview data without opening the Phase 2 workspace APIs. When a guest chooses a
protected destination, the public layer should issue a bounded opaque or signed
same-origin return intent and send the guest through the existing login/register
flow. After authentication, the server must re-resolve the stable public place
identifier, recheck current workspace membership/permission and only then use
the protected API. The browser must never supply authoritative workspace,
coordinates, boundary, price or authorization state.

## 7. Verified demonstration

- 39 places: Nigeria, all 37 ADM1 subdivisions, and one supported Lagos
  locality;
- Nigeria and Lagos State use real pinned generalized boundary geometry;
- Lagos locality is nested beneath Lagos State and remains a sourced point;
- all records use `EPSG:4326`;
- country -> state -> locality hierarchy, normalized name search and source
  boundary delivery are integration tested;
- repeat import leaves stable identities and one revision per place.

## 8. Known limits and acceptance gates

- Coverage is Nigeria-only. Global country, deeper administrative and locality
  imports are **Not Started**.
- Lagos city has no validated boundary in this snapshot. It remains
  `POINT_ONLY`; boundary sourcing/review is **Not Started**.
- geoBoundaries files are generalized. They cannot determine development-zone
  or parcel eligibility.
- Disputed territory/name policy remains open before global/public expansion.
- The isolated PostGIS proof is verified, but a production PostgreSQL cutover
  remains a separate future decision and migration gate.
- Local metric projection rules are **Not Started** because Phase 2 creates no
  Development Zones or parcels.
- Vector tiles, CDN delivery and global-scale paging are **Not Started**. The
  Phase 2 proof uses bounded per-place GeoJSON.
- Chrome desktop/mobile, keyboard focus and WebGL-fallback behavior are verified;
  a broader browser/device matrix remains a later release gate.
- Public guest Earth presentation and protected destination login are Phase 3
  and therefore **Not Started** in implementation.

## 9. Verification record

Run on 2026-10-25 from `feature/simverse-earth-land`:

| Check | Result |
| --- | --- |
| Focused Phase 2 Vitest run | **Passed:** 15 tests across 3 files. |
| `npx vitest run` | **Passed:** 399 tests across 42 files. |
| `npx tsc --noEmit` | **Passed.** |
| `npx eslint .` | **Passed.** |
| `npx prisma validate` | **Passed.** |
| `npx prisma generate` | **Passed:** Prisma Client 7.10.0 generated. |
| `npm run build` | **Passed:** Next.js 16.3.5 production build, including all Earth routes. |
| `git diff --check` | **Passed.** |
| First development import | **Passed:** 38 geoBoundaries + 1 GeoNames record created. |
| Repeated development import | **Passed:** all 39 records verified and skipped without duplicate revisions. |
| Chrome browser verification | **Passed:** desktop, 390 px mobile, keyboard, search, sourced geometry, camera interaction and WebGL fallback; four screenshots visually reviewed. |
| PostGIS runtime | **Passed:** GitHub Actions run [40155016832](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40155016832) verified PostgreSQL 17.11/PostGIS 3.6.4 initialization, geometry/FK/uniqueness constraints, required indexes, atomic repeat rejection and fresh-database initialization. |
