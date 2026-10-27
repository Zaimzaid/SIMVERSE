# SIMVERSE Earth - Phase 4 Development Zones and Parcel Discovery

## 1. Checkpoint status

- **Branch:** `feature/simverse-earth-land`
- **Baseline:** `9e98bcd` (`feat: add SIMVERSE Earth interactive explorer`)
- **Local verification:** 2026-10-27
- **Implementation commit:** `2f6214d`
- **Status:** implemented and fully verified; Phase 5 has not started.

Phase 4 adds reviewed virtual Development Zones and deterministic, on-demand
plot discovery to the authenticated Earth geography explorer. It does not add
reservations, acquisition, ownership, payments, transfers or construction.

Every zone is SIMVERSE policy metadata. It is not a cadastral boundary. Every
plot is virtual and grants no right in real-world land. The committed browser
fixture is explicitly synthetic and exists only to verify the product flow.

## 2. Delivered architecture

### Application metadata

The existing SQLite application remains the active datasource and continues to
use the repository's `prisma db push` convention. Phase 4 adds:

- `EarthSteward` - a global grant separate from workspace roles;
- `EarthDevelopmentZone` - stable identity, current lifecycle status and active
  immutable version pointer;
- `EarthDevelopmentZoneVersion` - geometry, exclusions, metric grid, policy,
  provenance and content hash;
- `EarthDevelopmentZoneLifecycleEvent` - append-only actor, transition and
  timestamp history;
- relations from `User`, `EarthGeoPlace` and `EarthGeoPlaceRevision`.

No parcel, reservation, claim, property or ownership table was added. Merely
browsing a viewport never writes a candidate plot.

### Native spatial proof

`infrastructure/earth-postgis/init/002-earth-land.sql` expresses the same zone
architecture using native PostGIS types and constraints:

- `geometry(MultiPolygon, 4326)` for zone versions and exclusions;
- `geometry(Point, 4326)` for grid origins;
- valid, non-empty, SRID and longitude-span checks;
- reviewed parent-containment and grid-origin validation triggers;
- recorded UTM origin coordinates checked to 1 cm;
- immutable version-content trigger;
- exclusion-containment trigger;
- composite foreign keys for active-version and lifecycle consistency;
- GiST indexes for zone and exclusion geometry;
- a partial unique index allowing one ACTIVE version per zone.

This is an isolated proof. It does not cut the application over from SQLite and
does not alter `dev.db`.

## 3. Zone lifecycle and authority

The lifecycle is:

```text
DRAFT -> REVIEW -> ACTIVE -> RETIRED
                    ^          |
                    +-- reviewed-version rollback
```

- Creation produces immutable version 1.
- A meaningful edit creates the next monotonically increasing version.
- An identical content hash is rejected rather than duplicated.
- Submission, activation, retirement and rollback append lifecycle events.
- Rollback selects a prior reviewed immutable version; it does not rewrite that
  version.
- Only an active `EarthSteward` can create, edit or submit a zone.
- Activation, retirement and rollback additionally require `canActivate`.
- A workspace OWNER or ADMIN receives no Earth stewardship implicitly.
- Active inventory reads still require an authenticated user, active workspace
  membership and the existing `workspace.view` permission.
- Version history is steward-only and is not part of the viewer projection.

All route input is validated with Zod. Service code owns Prisma access and uses
safe failures for unknown or unauthorized records.

## 4. Geometry and projection rules

A Development Zone requires an explicit reviewed Polygon or MultiPolygon in
WGS84. The service rejects:

- a Point, including the sourced point-only Lagos locality;
- open or malformed rings, non-finite coordinates and self-intersections;
- overlapping MultiPolygon members or invalid holes;
- geometry outside its sourced polygon parent revision;
- a grid origin outside the zone;
- antimeridian-spanning v1 geometry;
- unsupported, wrong-zone or wrong-hemisphere projections.

Phase 4 supports UTM EPSG 32601-32660 and 32701-32760. Each immutable version
records the SRID, projection description, WGS84 grid origin, metric origin,
bearing, cell dimensions, algorithm version, edge policy, restrictions and
provenance.

The source place boundary supplies containment context only. It never becomes
eligible inventory automatically.

## 5. Deterministic parcel algorithm

`earth-parcel-grid-v1` is a pure TypeScript WGS84/UTM engine with no new runtime
dependency. Its contract is:

- default cell width and height: 25 m by 25 m;
- default area: 625 m²;
- local origin and clockwise bearing are versioned inputs;
- only complete cells covered by the zone are admitted;
- a cell intersecting any exclusion is omitted;
- row and column determine stable order and cursor pagination;
- public ID is a truncated SHA-256 digest of algorithm version, immutable zone
  version and grid indices;
- repeat queries and independent Node processes return the same ID and geometry;
- generation requires zoom 16 or greater;
- at most 500 rows are returned and at most 4,096 candidate cells are scanned
  per request;
- an out-of-zone viewport returns an empty bounded result.

The engine supports Polygon, Polygon-with-holes and MultiPolygon zones. It
derives candidates for the requested viewport only and does not materialize
unclaimed plots.

## 6. Authenticated routes

| Route | Methods | Responsibility |
| --- | --- | --- |
| `/api/earth/zones` | GET, POST | List active safe projections; steward creates version 1. |
| `/api/earth/zones/[zoneId]` | GET | Read one active viewer-safe zone. |
| `/api/earth/zones/[zoneId]/versions` | GET, POST | Steward-only history and immutable next version. |
| `/api/earth/zones/[zoneId]/versions/[versionId]` | POST | Validated `SUBMIT_FOR_REVIEW`, `ACTIVATE` or `ROLLBACK` action. |
| `/api/earth/zones/[zoneId]/retire` | POST | Authorized active-inventory retirement. |
| `/api/earth/zones/[zoneId]/parcels` | GET | Bounded viewport generation with stable cursor. |
| `/api/earth/zones/[zoneId]/parcels/[parcelId]` | GET | Re-derive one parcel from its row/column and verify the public ID. |
| `/api/earth/zones/[zoneId]/rules` | GET | Safe immutable restrictions and grid policy. |
| `/api/earth/zones/[zoneId]/eligibility` | GET | Read-only virtual plot eligibility statement. |

There is no public guest parcel endpoint and no mutation that reserves, claims,
buys or owns a plot.

## 7. Explorer experience

The authenticated `/earth/geography` page now:

- loads active zones for the selected place;
- displays a truthful empty state where no approved zone exists;
- overlays zone geometry, exclusions, eligible full cells and selection;
- synchronizes map clicks and a keyboard-operable plot list;
- shows stable plot ID, grid indices, 25 m dimensions, 625 m² area, center,
  zoning and rule summary;
- labels synthetic demonstration geometry and repeats the virtual-only notice;
- provides a list fallback when WebGL is unavailable;
- exposes no acquire, reserve, claim, purchase or ownership action.

### Local development visibility setup

The repository includes a guarded, repeatable command that publishes the
existing synthetic Phase 4 fixture to the repository-local development
database:

```powershell
npm run earth:setup:phase4-demo -- --user-email <your-local-account-email>
```

The email must belong to an existing local user with a workspace membership.
When exactly one eligible local account exists, `--user-email` may be omitted.
The command does not create accounts, grant Earth stewardship, or write any
ownership, reservation or acquisition data.

Safety behavior:

- refuses `NODE_ENV=production`, non-SQLite URLs and every database except the
  repository-root `dev.db`;
- creates a consistent backup under the operating-system temporary directory
  before applying a missing additive Prisma schema with the repository's
  existing `prisma db push` convention and without `--accept-data-loss`;
- imports the pinned Nigeria geography bundle only when the active sourced
  Lagos State polygon is absent;
- manages only `earth:zone:lagos-phase4-synthetic-grid` and refuses to replace
  a non-demonstration record at that key;
- validates containment, exclusions, UTM projection and grid origin with the
  same pure Phase 4 geometry functions used by the application;
- preserves immutable versions and is a no-op when the canonical active
  definition already exists.

After running `npm run dev -- --port 3020`, sign in and open:

```text
http://localhost:3020/earth/geography?place=geo_d4f56f4ce4e43d111f22eea1
```

Select **Lagos Phase 4 Synthetic Test Zone**. The explorer displays 187
eligible synthetic plots for the fixture. Each plot is 25 m by 25 m / 625 m²;
clicking a map cell or its accessible list row displays its deterministic ID,
approximate center, dimensions, area and synthetic zoning. The zone is clearly
labeled as synthetic test geometry positioned in sourced Lagos State context,
not authentic Lagos land inventory.

On 2026-10-27 this workflow was run twice against local `dev.db`; the second
setup was a no-op. Chrome 155.0.8059.86 then selected a rendered map cell and
displayed the complete plot detail with zero severe browser events. The Next
development server was stopped and restarted, after which the same authenticated
URL again rendered 187 plots and passed the same map-click/detail checks. The
development server restart does not affect the persistent SQLite setup.

## 8. Browser verification

Actual browser verification used Google Chrome `155.0.8059.86` on Windows,
headless with SwiftShader, an isolated SQLite database and a disposable browser
profile. The synthetic zone is contained within the sourced Lagos State polygon
but is not presented as an authentic boundary.

Verified results:

- guest zone API access returned 401;
- authenticated explorer and MapLibre canvas became ready;
- 187 eligible plots rendered for the tested viewport;
- list selection, keyboard selection and direct map-click selection agreed;
- camera zoom controls worked;
- the selected plot reported 625 m², 25 m by 25 m and its geographic center;
- virtual-only and synthetic/non-cadastral notices were visible;
- zero acquisition controls were present;
- the 390 px mobile layout had no horizontal overflow and retained a usable
  map/list experience;
- the WebGL-disabled state gave useful guidance and kept the list available;
- no browser console error was recorded.

Evidence:

- [Desktop zone and grid](evidence/phase4-land-desktop.png)
- [Selected parcel details](evidence/phase4-land-selected-parcel.png)
- [Map-click selection](evidence/phase4-land-map-selection.png)
- [Mobile layout](evidence/phase4-land-mobile.png)
- [WebGL fallback](evidence/phase4-land-webgl-fallback.png)
- [Machine-readable browser record](evidence/phase4-browser-verification.json)

## 9. Measured development profile

These are local development-mode measurements from the named headless browser,
including Turbopack route compilation. They are not production performance
budgets.

| Measurement | Result |
| --- | ---: |
| Cold explorer ready | 16,197 ms |
| Cold zone and parcels ready | 50,387 ms |
| Warm explorer ready | 10,974 ms |
| Warm zone and parcels ready | 2,649 ms |
| Bounded zone API request | 693.1 ms |
| Query return limit used | 200 parcels |

## 10. Automated verification

| Command | Result |
| --- | --- |
| Focused Phase 4 tests | Passed; 20 tests across 3 files. |
| `npx vitest run` | Passed; 425 tests across 48 files. |
| `npx tsc --noEmit` | Passed. |
| `npx eslint .` | Passed. |
| `npx prisma validate` | Passed. |
| `npx prisma generate` | Passed; Prisma Client 7.10.0. |
| `npm run build` | Passed; all zone/parcel routes emitted. |
| `git diff --check` | Passed. |
| GitHub Actions PostGIS gate | Passed; run [40460420570](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40460420570). |

The pure and service tests cover dimensions, deterministic cross-process IDs,
pagination, full-cell edges, holes/exclusions, MultiPolygon handling, invalid
geometry/projections, antimeridian and hemisphere rejection, lifecycle
immutability, authorization, workspace-session boundaries, point-only rejection,
query bounds and absence of parcel persistence. Structural tests keep the SQL
schema and workflow wired into the repository gate.

## 11. Native PostGIS execution

GitHub Actions run
[40460420570](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40460420570)
executed commit `2f6214d` in an Ubuntu 24.04 runner against
`postgis/postgis:17-3.6-alpine`:

| Component | Actual version |
| --- | --- |
| PostgreSQL | 17.11 |
| PostGIS | 3.6.4 |
| GEOS | 3.14.1 |
| PROJ | 9.8.1 |

The real database accepted valid Polygon, MultiPolygon and hole geometry and
rejected invalid/self-intersecting, non-WGS84, point-only, out-of-parent,
out-of-zone exclusion and unsupported projection records. It verified the
spatial/partial indexes, composite foreign keys, immutable version trigger,
active lifecycle record, 187 bounded full cells, exact 25 m sides and 625 m²
area, stable SHA-256 parcel ID and non-overlap. Reapplying each one-time schema
failed atomically without changing row counts, while the ordered schemas
initialized an independent fresh database with ten Earth tables.

Artifact
[`12714525681`](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40460420570/artifacts/12714525681)
contains the verification log. Its ZIP SHA-256 is
`7e1f83cd297e2995660b766c6f020ea9b9c6141b81eb80a4495abd4cf04cf8b8`.

## 12. Known limits

- SQLite remains the current application datasource; there is no production
  PostGIS cutover.
- The only demonstration zone is synthetic. No approved production inventory
  is claimed.
- Candidate generation is deliberately bounded and viewport-driven; global
  scale and named production-device budgets remain later release gates.
- UTM v1 does not support a single zone crossing the antimeridian or UTM zone
  boundary.
- No reservation, acquisition, starter allocation, ownership, transfer,
  payment, construction, terrain or real-estate workflow exists.
- Runtime Protocol v1, SimulationRun snapshots, Battle/Race/Survival mechanics
  and Unreal work are unchanged. D: remains off limits.

Phase 5 must not start until Phase 4 receives owner approval after the real
PostGIS gate.
