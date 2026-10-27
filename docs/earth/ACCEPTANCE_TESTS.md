# SIMVERSE Earth - Acceptance Tests

## 1. Purpose

This is the system acceptance catalog. Phases 1-3 are implemented and their
closure evidence is recorded below. Later tests become gates only when their
phase and underlying product decisions are approved. Proposed performance
numbers are starting budgets, not current claims.

## 2. Phase 1 architecture acceptance

| ID | Test | Expected result |
| --- | --- | --- |
| P1-01 | Inspect branch and baseline. | Work is on `feature/simverse-earth-land`, based on current `origin/master`, with no D: access. |
| P1-02 | Review the eight requested Earth documents. | Every file exists, is non-empty and has no contradictory authority or scope. |
| P1-03 | Search Phase 1 diff for implementation paths/dependencies/schema. | Only documentation changes; no package, source, Prisma, DB or generated artifacts. |
| P1-04 | Review classification. | Approved requirements, proposals, assumptions and open decisions are distinguishable. |
| P1-05 | Review real-world claims. | No invented town boundary, real-land ownership claim or unsupported dataset claim. |
| P1-06 | Review architecture boundary. | Existing World/Asset/Run architecture is reused without treating World JSON as global geospatial truth. |
| P1-07 | Run Markdown/path and Git whitespace checks. | Links resolve and `git diff --check` passes. |
| P1-08 | Run relevant existing repository gates if the environment permits. | Results are reported exactly; failures are not hidden or attributed to Earth docs without evidence. |

## 3. Geography ingestion and provenance

| ID | Test | Expected result |
| --- | --- | --- |
| GEO-01 | Import a licensed representative dataset fixture twice. | Same source/version/checksum produces the same manifest and place revision hashes. |
| GEO-02 | Attempt import without license/attribution/checksum. | Dataset cannot reach STAGED or ACTIVE. |
| GEO-03 | Import country, admin, city and locality hierarchy. | Parent paths and normalized types match the reviewed fixture; source admin levels remain preserved. |
| GEO-04 | Import a point-only locality. | Search succeeds; boundary is null and quality is POINT_ONLY; no polygon is generated. |
| GEO-05 | Import invalid/self-intersecting geometry. | Feature is quarantined with a reason and excluded from active tiles/zones. |
| GEO-06 | Import multipolygon islands. | All sourced components survive and display at the expected coordinates. |
| GEO-07 | Activate a new dataset revision. | New searches use it; prior revision remains addressable; saved properties keep prior context. |
| GEO-08 | Roll back an activation. | Prior reviewed revision becomes active without editing either revision. |
| GEO-09 | Query localized/alternate names. | Correct place ranks with breadcrumb and active revision. |
| GEO-10 | Render disputed/approximate feature fixture. | UI exposes reviewed label/quality treatment and retains source provenance. |
| GEO-11 | Cross antimeridian or high-latitude fixture. | View fit and geometry do not wrap incorrectly; invalid parcel projection is rejected. |
| GEO-12 | Inspect public place projection. | No staging fields, internal steward IDs or license-incompatible attributes leak. |

## 4. Map, search and guest access

| ID | Test | Expected result |
| --- | --- | --- |
| MAP-01 | Anonymous request to `/earth`. | 200 response; no Platform workspace is required. |
| MAP-02 | Guest rotates, pans, zooms and enters a destination search. | Visual navigation works without authentication and makes no write; no protected place or parcel detail is returned. |
| MAP-03 | Guest selects a protected map or search destination. | Existing login/register flow opens with a bounded destination intent; no location or parcel detail is disclosed first. |
| MAP-04 | Authenticated user selects permitted polygon place. | Camera fits sourced extent and panel shows source/quality. |
| MAP-05 | Authenticated user selects permitted point-only place. | Camera centers on point and limitation copy appears; no fake outline. |
| MAP-06 | Inspect network at world/country zoom. | Versioned vector tiles load; no global raw GeoJSON response. |
| MAP-07 | Request oversized bbox/low-zoom parcels. | API returns a bounded summary or validation error, not an unbounded grid. |
| MAP-08 | Disable WebGL. | Search/list/place detail remain usable and the visual limitation is explained. |
| MAP-09 | Responsive browser run at 390/768/1024/1440 px. | No document overflow, blocked controls, nested anchors, console exception or HTTP 500. |
| MAP-10 | Enable reduced motion. | No forced globe spin/camera animation; selection remains understandable. |

## 5. Development zones and parcels

| ID | Test | Expected result |
| --- | --- | --- |
| PAR-01 | Create zone from valid reviewed geometry. | Immutable version contains projection, origin, bearing, cell size, policy and hash. |
| PAR-02 | Attempt zone from point-only/missing boundary without explicit polygon. | Rejected. |
| PAR-03 | Generate same cell repeatedly/process independently. | Public ID, geometry, centroid and measured area are byte-for-byte/canonically identical. |
| PAR-04 | Generate adjacent cells. | No overlap beyond numeric tolerance; indices/order are stable. |
| PAR-05 | Generate 25 m by 25 m fixture in valid metric projection. | Area and side lengths meet approved tolerance. |
| PAR-06 | Test partial edge cell under full-cell policy. | Candidate is excluded. |
| PAR-07 | Test exclusion polygon. | Intersecting candidate is excluded according to approved rule. |
| PAR-08 | Request cell outside zone. | Safe not-found/invalid response; no claim row created. |
| PAR-09 | Browse unclaimed viewport. | Candidate rows are not persisted merely by viewing. |
| PAR-10 | Reserve one candidate. | Exactly one claim row materializes with frozen zone/grid/geometry. |
| PAR-11 | Supersede zone geometry. | Existing claim/property geometry and ID remain unchanged; new candidates use new zone version. |
| PAR-12 | Query parcel state after claim change. | Short-lived cache invalidates and authoritative detail reflects current state. |
| PAR-13 | Attempt Web Mercator measurement at disallowed latitude. | Validation rejects it; no silent distorted parcel. |

## 6. Reservation and acquisition concurrency

Run these against real PostgreSQL/PostGIS connections, not SQLite mocks.

| ID | Test | Expected result |
| --- | --- | --- |
| ACQ-01 | 100 concurrent users reserve one parcel. | Exactly one ACTIVE reservation; 99 stable conflicts; no duplicate claim. |
| ACQ-02 | Same user retries reservation with same idempotency key. | Same reservation/result; no additional row or extended TTL unless policy says so. |
| ACQ-03 | Different payload reuses idempotency key. | Conflict/validation error; original record unchanged. |
| ACQ-04 | Client sends false availability/coordinates. | Server re-derives parcel and ignores client authority. |
| ACQ-05 | Reservation expires by database time. | Later transaction marks it EXPIRED and may create one new reservation. |
| ACQ-06 | Client clock is changed. | No effect on server expiry. |
| ACQ-07 | Two acquisition requests race on one reservation. | One property/history sequence; retry returns original success. |
| ACQ-08 | Eligibility changes before acquisition. | Server applies approved recheck policy atomically and records rule version. |
| ACQ-09 | Inject failure after any transaction step. | Entire acquisition rolls back or idempotently completes; no partial owner/history. |
| ACQ-10 | Foreign user requests private property/reservation ID. | Safe 404; existence not disclosed. |
| ACQ-11 | Starter allocation requested twice. | Unique policy constraint allows only approved quantity. |
| ACQ-12 | Claim an already owned/blocked/retired parcel. | Conflict; no acquisition/property/history mutation. |
| ACQ-13 | Review acquisition screens and records. | Virtual-only notice present; no legal deed/real property claim. |

## 7. Authentication and preserved intent

| ID | Test | Expected result |
| --- | --- | --- |
| AUTH-01 | Guest selects a protected location, registers and returns. | Same destination intent is restored, then the server authorizes and re-resolves it before opening detail. |
| AUTH-02 | Destination intent expires during auth. | User returns to the nearest permitted Earth view with a clear expiry message. |
| AUTH-03 | Requested destination becomes unavailable during auth. | No stale protected read occurs; the nearest permitted Earth view and explanation are shown. |
| AUTH-04 | Tamper with opaque/signed intent. | Rejected; no arbitrary redirect, price or coordinate trust. |
| AUTH-05 | External return URL supplied. | Rejected or normalized to approved same-origin Earth route. |
| AUTH-06 | Session expires during mutation. | 401; safe intent/draft reference retained, mutation not partially applied. |

## 8. Ownership, units and transfers

| ID | Test | Expected result |
| --- | --- | --- |
| OWN-01 | Successful acquisition. | Current owner projection and ownership event sequence 1 agree. |
| OWN-02 | Rename/update User profile. | Historical ownership event identity remains interpretable per privacy policy. |
| OWN-03 | Transfer under approved rules. | Current owner switches once and ordered append-only history records both sides. |
| OWN-04 | Inject transfer failure. | Owner/history remain entirely before or after; never split. |
| OWN-05 | Try editing an ownership event. | No ordinary update/delete path; correction appends a compensating event. |
| OWN-06 | Acquire a unit. | Unit owner changes; land/building/exterior rights do not. |
| OWN-07 | Conflicting whole-property/unit claim. | Approved rights matrix rejects the conflict. |
| OWN-08 | View another owner's public property. | Safe public identity only; email, User/Workspace IDs and private history absent. |
| OWN-09 | Suspend/delete account. | Approved retention/transfer policy executes without cascading property history. |

## 9. Construction and Assets

| ID | Test | Expected result |
| --- | --- | --- |
| BLD-01 | Owner opens empty property editor. | Correct frozen parcel/local frame and boundary render. |
| BLD-02 | Load authorized RUNTIME_READY template. | Exact AssetVersion loads; metadata/provenance shown. |
| BLD-03 | Use foreign workspace Asset ID. | Safe 404/validation failure; no placement saved. |
| BLD-04 | Use archived/wrong-type/unlicensed Asset version. | Publication rejected with actionable safe error. |
| BLD-05 | Place building entirely inside rules. | Server footprint validates; immutable published version created. |
| BLD-06 | Cross parcel/setback/height rule. | Server rejects regardless of browser preview. |
| BLD-07 | Manipulate client-computed footprint. | Server recomputation detects mismatch and rejects. |
| BLD-08 | Save and reload draft. | All transforms/configuration and expected draft version round-trip. |
| BLD-09 | Two clients save same draft version. | First succeeds; second gets conflict and cannot overwrite silently. |
| BLD-10 | Publish revision 2. | Revision 1 and pinned Assets remain unchanged and inspectable. |
| BLD-11 | Current Asset later changes/archives. | Published building remains pinned to its historical AssetVersion. |
| BLD-12 | Delegated builder without publish grant. | May save permitted draft; cannot publish or transfer. |
| BLD-13 | Grant revoked during edit. | Next server write fails; owner state remains intact. |
| BLD-14 | WebGL/model load fails. | Fallback communicates failure; no draft/history loss. |
| BLD-15 | Inspect database/storage. | No GLTF/GLB, texture, tile or screenshot binary stored in relational fields. |

## 10. Shared world and moderation

| ID | Test | Expected result |
| --- | --- | --- |
| PUB-01 | Publish validated build. | Current safe projection appears for authorized viewers after targeted invalidation; the guest overview exposes no protected detail. |
| PUB-02 | Keep draft private. | Guest/public tile cannot infer its existence or Assets. |
| PUB-03 | Suspend/moderate build. | Public projection and caches stop serving it within approved SLA. |
| PUB-04 | Restore after review. | Only an approved immutable version republishes; private drafts remain private. |
| PUB-05 | Submit script/markup in title/config. | Rendered as inert text/data; no code execution or style escape. |
| PUB-06 | Report public construction. | Audited report created without exposing reporter to owner. |
| PUB-07 | Required Asset attribution. | Public detail displays exact approved attribution/license link. |

## 11. Historical and SIMVERSE compatibility

| ID | Test | Expected result |
| --- | --- | --- |
| HIST-01 | Run full existing suite after Earth schema/services. | Existing auth, Platform, modules, viewer, Asset, World, media and sharing behavior passes. |
| HIST-02 | Edit geography/zone/property/building after a future Earth-bound Run. | Run snapshot and outcome remain byte-for-byte/canonically unchanged. |
| HIST-03 | Parse existing Runtime Protocol v1 fixtures. | Unchanged and valid; no Earth field added to v1. |
| HIST-04 | Edit current World/Asset. | Earth/build historical versions and prior SimulationRuns remain pinned. |
| HIST-05 | Delete/archive source records. | Restrict/snapshot policy preserves histories; no broken public/private reference. |

## 12. Security tests

- boundary/parcel/ID enumeration against private resources;
- cross-workspace Asset/World references;
- horizontal and vertical privilege escalation;
- SQL injection in search, bounding boxes, IDs and spatial queries;
- oversized/complex geometry denial of service;
- malicious GLTF/URLs and credential-bearing references;
- CSRF/session/cookie behavior for mutations;
- open redirects in preserved intent;
- public projection field allowlist/no internal-ID leak;
- rate-limit and reservation abuse;
- audit metadata secret/precise-private-location leakage;
- job/import artifact tampering and checksum mismatch.

## 13. Proposed performance budgets

These budgets require measurement and owner approval on named hardware/network:

| Area | Initial proposed budget |
| --- | --- |
| Place search | p95 <= 300 ms server time for bounded indexed query. |
| Cached immutable vector tile | p95 <= 200 ms at application edge/origin; compressed tile size budget by zoom. |
| Parcel viewport query | p95 <= 500 ms for approved maximum bbox/candidate count. |
| Reservation/acquisition | p95 <= 750 ms excluding external entitlement service; correctness has priority. |
| Earth first usable view | <= 3 s on approved mid-range device/network after style/low-zoom tiles are cached. |
| Map interaction | target 30+ FPS on approved mid-range mobile and 60 FPS desktop for bounded layers. |
| Editor autosave | confirmation <= 1 s p95 for bounded draft. |
| Public projection invalidation | approved moderation SLA; proposed <= 60 s, immediate detail denial. |

Load tests must report dataset size, viewport density, hardware, concurrency,
cache state and query plans. Passing a tiny fixture does not prove global scale.

## 14. Operational acceptance

1. Import resumes safely after worker interruption.
2. Failed validation cannot activate a dataset/zone.
3. Tile build is reproducible from manifest and revision.
4. Database backup restores users, geography, claims, ownership and buildings
   with row/hash comparisons.
5. Dataset rollback does not move held property.
6. Cache purge targets a moderated property and a superseded dataset version.
7. Reservation-expiry backlog recovers without double allocation.
8. Feature flag disables new writes while keeping safe read/history access.
9. Logs/metrics identify errors and contention without exposing secrets.
10. All operational procedures avoid the unstable D: drive.

## 15. Release evidence

Every phase report must include:

- exact commit and branch;
- schema/migration version and active dataset manifests;
- test counts and command results;
- concurrency/load environment and measurements;
- browser routes/viewports and accessibility checks;
- security review results;
- known limits and deferred tests;
- `git status` and proof that databases, tiles, profiles, logs and screenshots are
  not accidentally staged.

## 16. Phase 2 closure evidence (2026-10-25)

| Gate | Actual result |
| --- | --- |
| Geography import | **Passed.** Pinned Nigeria/Lagos data produces 39 stable places; repeat import skips all 39 without duplicate revisions. |
| Country-neutral ingestion | **Passed.** A clearly synthetic `CA` / `CAN` fixture and `ADMIN1` child pass unit and database integration tests. The fixture is labeled non-authentic and never enters production data. |
| Authentication | **Passed.** The page/API/service chain requires authentication, active workspace membership and `workspace.view`; anonymous access redirects and foreign workspaces fail safely. |
| Chrome/WebGL | **Passed.** Chrome 155 renders sourced Nigeria and Lagos geometry, search, selection, zoom/drag/navigation controls, quality labels and attribution. |
| Mobile and keyboard | **Passed.** 390 by 844 has no document overflow; the labeled search control receives keyboard focus and Enter submits. |
| No-WebGL fallback | **Passed.** A WebGL-disabled browser context receives helpful fallback copy and keeps the place hierarchy usable. |
| Browser evidence | **Passed.** Four screenshots were captured and visually reviewed; the machine-readable run record is under `docs/earth/evidence/`. |
| Local regression | **Passed.** 399 tests in 42 files, TypeScript, ESLint, Prisma validate/generate, Next production build and `git diff --check`. |
| Real PostGIS execution | **Passed.** GitHub Actions run [40155016832](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40155016832) used PostgreSQL 17.11/PostGIS 3.6.4 and verified extension/schema initialization, valid and invalid geometry behavior, required spatial/hierarchy/current-revision indexes, foreign keys, one-current-revision uniqueness, atomic same-database repeat rejection and independent fresh-database initialization. |

The run used the isolated `postgis/postgis:17-3.6-alpine` service and did not
alter the SQLite application or a development database. Its complete log is
artifact
[`12584422007`](https://github.com/Zaimzaid/SIMVERSE/actions/runs/40155016832/artifacts/12584422007),
with SHA-256 digest
`de0245af73551b67512ee1ee582a30f86e978631a9d152d4aad21685b94aa65c`.

The authenticated Phase 2 explorer does not implement Phase 3 guest behavior.
Phase 3 may present a public allowlisted globe shell, but a protected selection
must travel through a bounded same-origin intent, authentication and fresh
server-side place/workspace authorization before detail is returned.

## 17. Phase 3 closure evidence (2026-10-25)

| Gate | Actual result |
| --- | --- |
| Public globe | **Passed.** Anonymous `/earth` returns 200 and renders a real MapLibre globe from local versioned MVT land tiles without requiring a workspace. |
| Public projection | **Passed.** Overview and search expose strict country-only fields. Nigeria is supported; guest Lagos search returns no locality record, and protected geography APIs return 401. |
| Tile delivery | **Passed.** The pinned Natural Earth 5.1.2 source generates 21 property-stripped tiles for zooms 0-2 totaling 35,184 bytes. A representative tile returns 200; browser network events observed worker tile responses and no raw GeoJSON request. |
| Preserved intent | **Passed.** Selection creates an HMAC-SHA-256 signed, fixed-purpose, ten-minute place intent. It contains no return URL; tampering/expiry fail safely, and both login and registration restore Nigeria only after a fresh protected service lookup. |
| Authorized hierarchy | **Passed.** An authenticated active workspace sees Nigeria's 37 subdivisions, selects Lagos State, then selects Lagos `CITY` as `POINT_ONLY` with actual `Point` geometry and no fabricated polygon. |
| Map interaction | **Passed.** Rotation, zoom and reset produce distinct rendered frames. Controls remain usable and do not overlap the public navigation surface. |
| Mobile and responsive | **Passed.** Chrome at 390, 768, 1024 and 1440 px reports viewport-width document bounds with no horizontal overflow. |
| Keyboard and motion | **Passed.** The authentication dialog has usable focus order, closes with Escape, and reduced-motion preference disables automatic globe rotation. |
| No-WebGL fallback | **Passed.** Helpful limitation copy appears and the country list/authentication path remain usable. |
| Browser diagnostics | **Passed.** No console errors, page exceptions, HTTP 500 responses or genuine request failures. Five aborted tile requests were expected camera/teardown cancellations. |
| Measured development profile | **Recorded, not a release SLO.** Chrome 155 headless/SwiftShader on Windows reported 4,968 ms navigation-to-ready, 2,547 ms map-load callback, 1,181 ms Nigeria-to-Lagos-State navigation, 25 main-thread resources, 1,410,846 transferred bytes and a 24,259,281-byte used-heap snapshot. |
| Automated regression | **Passed.** 407 tests in 46 files, TypeScript, ESLint, Prisma validate/generate, Next production build and `git diff --check`. |

The real-browser artifacts are
[the Phase 3 screenshots and machine-readable record](evidence/), and the full
implementation and verification report is
[PHASE_3_EARTH_EXPLORER.md](PHASE_3_EARTH_EXPLORER.md). The browser run used an
isolated database and profile; all disposable QA state was removed afterward.
Runtime Protocol v1, SimulationRun snapshots, the Prisma schema and simulation
mechanics were unchanged. At that checkpoint, Phase 4 had not started; the
following section records its later implementation. Ownership, acquisition and
construction remain unimplemented.

## 18. Phase 4 closure evidence (2026-10-27)

| Gate | Actual result |
| --- | --- |
| Zone authority | **Passed locally.** Only a dedicated active Earth steward can create or revise a zone; activation, retirement and rollback additionally require `canActivate`. A workspace owner without the grant is denied, and steward version history is not exposed to ordinary viewers. |
| Geometry truth | **Passed locally.** Polygon/MultiPolygon zones are validated, contained by a sourced polygon revision and tied to a recorded local UTM projection. Point-only Lagos, invalid/self-intersecting geometry, invalid projection/hemisphere and out-of-parent inputs fail safely. |
| Immutable lifecycle | **Passed locally.** Create emits version 1; meaningful edits create a new immutable version; duplicate content is rejected; review, activation, retirement and rollback append lifecycle records without editing old content. |
| Parcel determinism | **Passed locally.** Independent Node processes produce the same SHA-256-derived parcel IDs and geometry. Grid order and cursors are stable; 25 m by 25 m cells measure 625 m²; adjacent full cells do not overlap. |
| Edge and exclusion policy | **Passed locally.** Partial boundary cells, holes and cells intersecting an exclusion are omitted. Polygon and MultiPolygon fixtures are covered. |
| Bounded discovery | **Passed locally.** Parcel reads require zoom 16 or greater, enforce a maximum 500 returned rows and scan no more than 4,096 candidates. Out-of-zone viewports return an empty bounded result. |
| Sparse persistence | **Passed locally.** Browsing, detail, rules and eligibility reads create no parcel/claim row. The Prisma schema contains no reservation, ownership, property or acquisition model. |
| Authenticated API | **Passed locally.** Guest access returns 401; active workspace membership plus `workspace.view` is required for inventory reads; all inputs pass Zod validation and foreign/unknown records use safe failures. |
| Browser experience | **Passed.** Chrome 155 with SwiftShader rendered the active synthetic demonstration zone and 187 eligible plots, synchronized map/list and map-click selection, displayed exact plot detail and virtual/synthetic notices, exposed zero acquisition controls, supported keyboard selection and camera controls, fit mobile without horizontal overflow, and retained a helpful WebGL fallback. |
| Browser diagnostics | **Passed.** The isolated run recorded no console errors. Screenshots and the machine-readable record are under `docs/earth/evidence/`. |
| Measured development profile | **Recorded, not a release SLO.** Cold development compilation reached explorer-ready in 16,197 ms and zone/parcel-ready in 50,387 ms; a warm rerun reached those states in 10,974 ms and 2,649 ms respectively. The bounded zone API request measured 693.1 ms. |
| Automated regression | **Passed locally.** The exact `npx vitest run` command passes 425 tests in 48 files. The focused Phase 4 suite passes 20 tests in three files. TypeScript, ESLint, Prisma validation/client generation, the Next production build and `git diff --check` pass. |
| Real PostGIS execution | **Pending.** The reviewed workflow now applies the Phase 2 geography schema, Phase 4 land schema and both verification scripts to an isolated PostgreSQL 17/PostGIS 3.6 service. Its actual run ID, database versions and results must be recorded before Phase 4 is called fully verified. |

The browser fixture is explicitly synthetic, virtual-only and non-cadastral. It
is contained within the sourced Lagos State polygon but is not presented as an
authentic local boundary or real land inventory. The run used an isolated
SQLite database and disposable Chrome profile; those files were removed.
Runtime Protocol v1, SimulationRun snapshots and all simulation mechanics remain
unchanged. Phase 5 reservation, acquisition and ownership work has not started.
