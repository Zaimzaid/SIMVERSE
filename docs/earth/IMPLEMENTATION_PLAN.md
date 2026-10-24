# SIMVERSE Earth - Implementation Plan

## 1. Delivery rule

The owner intends to finish the defined SIMVERSE Earth system before returning
to unrelated features. Work should proceed through the gated slices below. Each
slice must preserve existing SIMVERSE behavior and produce a reviewable,
tested checkpoint. A failed gate is fixed within the Earth track rather than
hidden by starting another feature.

Phase 1 is documentation only. No later phase begins until this architecture and
the blocking decisions in [DECISION_LOG.md](DECISION_LOG.md) are approved.

## 2. Baseline and branch policy

- Baseline: `0faaa71` on `origin/master`.
- Feature branch: `feature/simverse-earth-land`.
- D: remains off limits because of recorded storage I/O instability.
- Do not mix Unreal runtime work into this branch.
- Keep commits aligned to the gated slices below.
- Rebase/merge from `master` only with a clean tree and reviewed conflicts.
- Use disposable databases and profiles for tests; never repurpose `dev.db`.
- Major dependencies require approval after a focused technical proof.

## 3. Phase 1 - Foundation and architecture (current)

### Deliverables

- repository reuse audit;
- product requirements and exclusions;
- geography, parcel and uncertainty model;
- proposed PostgreSQL/PostGIS data model and migration path;
- MapLibre/Three.js responsibilities;
- acquisition/concurrency design;
- complete user journeys;
- staged implementation and acceptance plan;
- decision/risk log.

### Exit criteria

- all eight `docs/earth/` documents exist and cross-agree;
- approved requirements, proposals, assumptions and open decisions are clear;
- no code, dependency, Prisma schema, database or generated artifact changes;
- documentation passes `git diff --check` and link/path review;
- branch and working-tree status are reported;
- owner explicitly approves or changes the architecture.

## 4. Phase 2 - Technical foundations and regional proof

This phase proves risky foundations before product UI.

### 2A. PostgreSQL/PostGIS migration proof

1. Approve target PostgreSQL/PostGIS versions and migration tooling.
2. Create a reproducible local/test environment on stable storage.
3. Baseline the existing schema in reviewed migrations.
4. Convert a copy of SQLite data and compare every model/relationship.
5. Run the complete existing suite and browser smoke flows on PostgreSQL.
6. Prove backup, restore, rollback and a documented developer workflow.
7. Keep production/dev cutover separate from the proof until review.

**Exit:** zero data-loss discrepancies; existing auth, workspace, simulation,
Asset, World and media behavior passes; PostGIS extension/index creation is
reproducible; owner approves cutover.

### 2B. Geography and MapLibre proof

1. Approve one launch region and dataset/license.
2. Import a small representative subset containing polygon, multipolygon,
   islands, point-only locality and known boundary edge cases.
3. Validate provenance manifest, geometry and hierarchy.
4. Generate zoom-specific vector tiles.
5. Build a disposable MapLibre prototype for globe/map, feature selection,
   attribution, mobile memory and accessible list synchronization.
6. Test antimeridian/polar behavior if relevant to the chosen scope.

**Exit:** no fabricated boundary, correct attribution, bounded tile sizes, a
measured browser report at 390/768/1024/1440 px, and a dependency decision.

### 2C. Parcel algorithm proof

1. Implement a pure versioned coordinate/grid library.
2. Verify local metric projection against known control distances.
3. Derive 25 m candidate cells for representative zone shapes/exclusions.
4. Prove stable IDs, no overlap, edge policy and repeatability.
5. Benchmark viewport generation without storing unclaimed cells.

**Exit:** conformance fixtures and hashes are stable across repeated runs and
the owner approves parcel size/edge rules.

## 5. Phase 3 - Read-only Earth Explorer

### Scope

- public `/earth` route outside the authenticated Platform shell;
- globe/map and accessible list/search;
- place hierarchy, breadcrumbs, boundary-quality disclosure and attribution;
- public globe overview and required attribution without protected location
  detail;
- existing login/register flow with bounded protected-destination intent;
- responsive loading/error/no-WebGL states;
- feature flag and initially bounded launch scope.

### APIs

- place search/detail/children;
- immutable dataset-version vector tiles;
- active zone summaries;
- health/manifest diagnostics for administrators.

### Exit criteria

- guests can visually manipulate Earth but protected selection triggers auth;
- authenticated destination restoration is authorized and re-resolved;
- foreign/private SIMVERSE data never appears in public projections;
- raw world-scale GeoJSON is never loaded;
- accessibility and responsive browser cases pass;
- no acquisition or misleading unavailable action is exposed.

## 6. Phase 4 - Development zones and parcel discovery

### Scope

- steward-only versioned DevelopmentZone workflow;
- validation/activation/rollback gates;
- on-demand parcel viewport and detail queries;
- zoning/availability overlays;
- stable parcel URLs and query-time availability language;
- no reservations or ownership yet.

### Exit criteria

- only ACTIVE immutable zone versions produce candidates;
- point-only/missing boundaries cannot auto-create a zone;
- parcel IDs/geometries match Phase 2 fixtures;
- viewport/zoom limits stop unbounded generation;
- zone edits cannot move an existing materialized test parcel;
- safe public projection omits internal/steward fields.

## 7. Phase 5 - Reservation, acquisition and starter land

### Prerequisite policy approvals

- acquisition requirement provider and rule version;
- virtual currency/entitlement behavior, if any;
- reservation TTL and retry behavior;
- starter allocation allowance and lifecycle;
- account deletion/suspension and owner privacy;
- legal/product copy.

### Scope

- central Earth permissions and resource owner policy;
- safe protected-location intent across login/register;
- materialized parcel claims;
- transactional reservations and expiry;
- idempotent in-game acquisition;
- property dashboard and append-only ownership history;
- starter allocation through the same claim path;
- map indicators for mine/reserved/owned;
- audit and operational metrics.

### Exit criteria

- a concurrency test with at least 100 simultaneous attempts creates exactly
  one active reservation/owner and no partial histories;
- retrying every mutation returns a stable idempotent result;
- client clock/coordinates/eligibility cannot override server truth;
- one user cannot mutate another property or infer a private record;
- guest intent restores and authorizes the protected location before parcel
  browsing begins;
- virtual-property notice appears at selection, confirmation and history;
- acquisition never touches real-money or real-land terminology.

## 8. Phase 6 - Construction editor and persistence

### Prerequisites

- approved global Asset publication/license rule;
- approved zoning/build constraints;
- stable object storage/reference strategy;
- reviewed Three.js editor proof.

### Scope

- separate Earth construction renderer using general Three.js patterns;
- parcel-local coordinate frame and boundary visualization;
- RUNTIME_READY AssetVersion template catalog;
- placement, rotation, scale and bounded customization;
- private drafts, autosave and optimistic conflict handling;
- server footprint/zoning/Asset validation;
- immutable publish revisions and current public projection;
- property owner and delegated builder grants;
- save/load and mobile-compatible controls.

### Exit criteria

- published footprints are server-derived and covered by authorized parcels;
- invalid/out-of-bounds/foreign/archived Asset references fail atomically;
- old BuildingVersions and Assets remain inspectable and unchanged;
- concurrent drafts do not silently overwrite;
- map projection updates/revokes without stale private content;
- WebGL failure leaves property management usable and truthful;
- no model binary is stored in PostgreSQL.

## 9. Phase 7 - Developed property, units and transfers

### Prerequisite policy approvals

- whole-property/unit rights matrix;
- transfer/gift/revocation rules;
- multi-parcel building policy;
- real building-footprint source and license, if used;
- moderation/report/appeal process.

### Scope

- developed-property acquisition;
- Building and PropertyUnit browsing;
- separate land/building/unit claim rights;
- transfers with reservation/escrow-like state if approved;
- multi-parcel validation where approved;
- public visibility, reporting, moderation and cache purge;
- complete ownership timeline and safe public presentation.

### Exit criteria

- no unit claim grants implicit land/exterior rights;
- a transfer is all-or-nothing and appends exactly one ordered history sequence;
- overlapping whole-property/unit claims are rejected by policy constraints;
- moderated content disappears from public projections and caches promptly;
- source building data never implies real ownership or guessed interiors.

## 10. Phase 8 - Global hardening and release gate

### Scope

- incremental multi-region dataset rollout;
- import/tile job operations and rollback;
- load, soak, contention and failure-injection testing;
- backup/restore and disaster recovery exercises;
- privacy, security, legal/license and accessibility review;
- rate limiting and abuse protection;
- observability dashboards and incident runbooks;
- performance budgets on named devices/networks;
- final beginner journey polish.

### Release criteria

- all acceptance tests for approved scope pass;
- every active dataset/Asset has verified license/provenance;
- no unresolved critical security, ownership or concurrency defect;
- restore and dataset rollback are rehearsed;
- public construction moderation is staffed/operational;
- the product makes the virtual-only nature clear in every acquisition surface;
- existing SIMVERSE test/build gates remain green.

## 11. Test strategy

### Pure tests

- coordinate validation and transformations;
- parcel IDs, geometry, exclusions and edge rules;
- schema contracts and public projections;
- ownership policy and construction bounds;
- dataset manifest/content hashing.

### PostgreSQL/PostGIS integration tests

- imports, spatial queries and hierarchy;
- GiST-index query plans on representative data;
- reservation/acquisition locks and idempotency;
- history and immutable revisions;
- workspace Asset isolation and resource grants;
- building coverage/overlap.

SQLite cannot stand in for concurrency or PostGIS tests. Keep fast pure tests in
Vitest, and run integration tests against a disposable PostgreSQL/PostGIS
database in local/CI environments.

### Browser tests

- real Chrome/Firefox/Safari-equivalent coverage where available;
- 390, 768, 1024 and 1440 px;
- guest protected-location selection -> login/register -> authorized destination
  restoration -> authenticated parcel discovery and acquisition;
- map/list synchronization, keyboard and reduced motion;
- construction draft/save/publish and conflict recovery;
- no console errors, HTTP 500s, nested anchors or page overflow.

### Operational tests

- dataset import resume/rollback;
- tile cache/version purge;
- database backup/restore;
- reservation expiry worker delay;
- object-storage/CDN failure;
- feature-flag rollback.

See [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) for the complete matrix.

## 12. Dependencies and staffing

Potential dependencies, installed only after approval:

- MapLibre GL JS and any React integration kept thin;
- PostgreSQL driver/Prisma adapter and PostGIS-enabled database;
- migration tooling compatible with PostGIS SQL;
- vector tile/import tooling selected after dataset proof;
- object storage/CDN and a job runner when asynchronous work begins.

Specialist review is needed for geospatial data/licensing, database migration,
property/economy design, moderation, accessibility and 3D content. AI agents can
implement and test code and documentation, but cannot approve legal claims,
licenses, disputed-boundary policy or visual/artistic acceptance.

## 13. Rollout strategy

1. Hide Earth behind a server-side feature flag.
2. Enable staff/stewards on one small approved region.
3. Open guest visual Earth interaction without protected location or parcel
   access.
4. Enable parcel discovery for invited test users.
5. Enable reservations/acquisition with caps and operational monitoring.
6. Enable private drafts, then moderated public construction.
7. Add regions only after data/license/operations review.

At every step, immutable dataset and zone versions make rollback a selection of
the prior reviewed revision rather than an in-place geometry rewrite.

## 14. Immediate next action

Owner reviews Phase 1 and resolves the blocking decisions. After approval, the
first implementation work is Phase 2A/2B/2C technical proof, not acquisition or
the building editor.
