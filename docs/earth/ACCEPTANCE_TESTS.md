# SIMVERSE Earth - Acceptance Tests

## 1. Purpose

This is the system acceptance catalog. Tests labeled **Phase 1** apply now.
Later tests become gates only when their phase and underlying product decisions
are approved. Proposed performance numbers are starting budgets, not current
claims.

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
