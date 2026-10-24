# SIMVERSE Earth - Decision Log

## 1. Status vocabulary

- **APPROVED** - explicit owner requirement in the Phase 1 brief.
- **PROPOSED** - architecture recommendation awaiting owner approval.
- **OPEN** - product, legal, data or technical choice is unresolved.
- **REJECTED** - considered and deliberately excluded.
- **SUPERSEDED** - replaced by a later decision; old rationale remains recorded.

No PROPOSED decision becomes implementation authority merely because it appears
in this document.

## 2. Decisions

| ID | Status | Decision | Rationale / consequence |
| --- | --- | --- | --- |
| EARTH-001 | APPROVED | Build SIMVERSE Earth inside the existing SIMVERSE ecosystem and repository. | Reuse identity, Assets, Worlds, services and UX; no disconnected app. |
| EARTH-002 | APPROVED | Phase 1 is architecture/documentation only. | No geography ingestion, dependency, schema, acquisition or 3D implementation before review. |
| EARTH-003 | APPROVED | All properties are virtual. | No acquisition may imply real-world title or rights. |
| EARTH-004 | APPROVED | Do not pre-generate every parcel worldwide. | Availability must be derived on demand and materialized only for claims/exceptions. |
| EARTH-005 | APPROVED | Guests may see and visually manipulate Earth, but cannot open protected locations, browse parcel availability or acquire property. | Selecting a protected destination starts authentication; protected reads and all writes remain server-authorized. |
| EARTH-006 | APPROVED | Preserve a guest's intended protected destination through login/register. | Use bounded opaque/signed intent, then authorize and re-resolve the destination after auth. |
| EARTH-007 | APPROVED | Do not access D: or resume Unreal work. | The external volume has recorded I/O instability. |
| EARTH-008 | PROPOSED | Treat Earth as a Product backed by Platform and Core services, not a Simulation Module. | Geography/ownership are persistent platform capabilities; modules may consume snapshots later. |
| EARTH-009 | PROPOSED | Keep Earth in the current modular monolith initially. | Existing route/service/auth patterns are strong; extract import/tile workers only when load requires it. |
| EARTH-010 | PROPOSED | Use MapLibre GL JS for globe/map exploration after a proof. | Vector tiles, styling and feature selection fit geography better than a custom Three.js globe. |
| EARTH-011 | PROPOSED | Use a separate Three.js construction renderer. | Reuse current GLTF/cache/cleanup patterns without coupling Earth to Battle playback. |
| EARTH-012 | PROPOSED | Move production persistence to PostgreSQL + PostGIS before property writes. | SQLite lacks spatial indexes/functions and production claim concurrency. Requires a dedicated migration gate. |
| EARTH-013 | PROPOSED | Use one PostgreSQL database initially rather than a separate Earth database. | Preserves transactions and relations; avoids distributed consistency. Heavy jobs can scale separately. |
| EARTH-014 | PROPOSED | Create dedicated geography/property models; do not put Earth into `World.blueprint`. | World is workspace-authored engine-neutral metadata, not global sourced geography or ownership. |
| EARTH-015 | PROPOSED | Separate stable place identity from immutable dataset revisions. | Corrections and provider changes cannot rewrite saved context. |
| EARTH-016 | PROPOSED | Store WGS84 globally and use a recorded local metric projection per zone. | EPSG:4326 preserves global identity; parcel measurements cannot rely on Web Mercator. |
| EARTH-017 | PROPOSED | A DevelopmentZone, not a place boundary, determines virtual eligibility. | Prevents administrative/locality polygons from being mistaken for buildable land. |
| EARTH-018 | APPROVED | Use 25 m x 25 m (625 m²) as the default base parcel size, configurable by approved development-zone rules. | Establishes a stable default without forcing unsuitable dimensions on every approved zone. |
| EARTH-019 | PROPOSED | Use immutable zone versions and a deterministic zone/grid parcel key. | IDs and geometry stay stable; source updates do not move acquired property. |
| EARTH-020 | PROPOSED | Admit only full cells at launch. | Avoids irregular slivers; clipped edge parcels need a future algorithm version. |
| EARTH-021 | PROPOSED | Materialize claim rows only on reservation/acquisition/development/block/retirement. | Avoids a world-sized table while retaining exclusivity where needed. |
| EARTH-022 | PROPOSED | Attach v1 current ownership to User, with separate property grants. | Ownership should not change with active Workspace; collaboration remains explicit. |
| EARTH-023 | PROPOSED | Keep workspace permissions for Assets and add Earth resource authorization. | A role grants capability, while owner/grant checks authorize the particular property. |
| EARTH-024 | PROPOSED | Use transactional row locks, uniqueness and idempotency for claims. | Exactly one reservation/acquisition wins; retries cannot duplicate property/history. |
| EARTH-025 | PROPOSED | Make ownership events and published building versions append-only. | History remains inspectable and corrections cannot silently rewrite it. |
| EARTH-026 | PROPOSED | Pin every building template/placement to an immutable AssetVersion. | Asset edits/archive cannot change a published development. |
| EARTH-027 | PROPOSED | Keep drafts private and publish only a server-validated immutable build. | Prevents unvalidated client geometry from becoming shared state. |
| EARTH-028 | PROPOSED | Serve versioned generalized vector tiles and separate live overlays. | Global map payloads stay bounded; immutable geography caches independently from claims/builds. |
| EARTH-029 | PROPOSED | Public Earth returns allowlisted safe projections. | Follows the current public-sharing security pattern; internal IDs/history remain private. |
| EARTH-030 | PROPOSED | Future Earth-bound Runs snapshot exact dataset/zone/property/build versions. | Later edits cannot alter historical simulation truth; Runtime Protocol v1 remains untouched. |
| EARTH-031 | REJECTED | Fabricate polygons for towns with missing boundaries. | Violates geographic truth and creates false parcel eligibility. |
| EARTH-032 | REJECTED | Use browser state as ownership, price, eligibility or geometry authority. | All protected decisions must be re-derived server-side. |
| EARTH-033 | REJECTED | Store global map/model binaries in Prisma rows. | Use object/vector tile storage and safe immutable references. |
| EARTH-034 | REJECTED | Measure parcels globally in Web Mercator. | Distance/area distortion is unacceptable for stable metric parcels. |
| EARTH-035 | REJECTED | Install major dependencies during Phase 1. | Architecture must be reviewed first. |

## 3. Open decisions and approval owners

| ID | Owner/reviewer needed | Decision | Blocks |
| --- | --- | --- | --- |
| OPEN-001 | Product owner + geospatial/license review | Launch region and boundary/locality providers. | Dataset proof, Explorer. |
| OPEN-002 | Product owner + legal/license review | Redistribution, attribution, update cadence and raw-data retention. | Import/tile delivery. |
| OPEN-003 | Product owner + policy review | Disputed territory/name presentation. | Public global map. |
| OPEN-004 | Product owner + geospatial review | Approve the full-cell edge policy and rules for development-zone parcel-size overrides. | Parcel implementation. |
| OPEN-005 | Geospatial engineer | Projection selection rules for UTM boundaries, antimeridian and polar zones. | Zone activation. |
| OPEN-006 | Platform/database owner | PostgreSQL/PostGIS versions, one database, driver and migration tooling. | All authoritative Earth schema. |
| OPEN-007 | Platform owner | Whole-platform PostgreSQL cutover schedule and rollback. | Production reservations/acquisition. |
| OPEN-008 | Product/economy owner | Acquisition requirements, virtual currency/entitlement and values. | Acquisition UI/service. |
| OPEN-009 | Product owner | Reservation TTL, extension, cooldown and abuse caps. | Reservation service. |
| OPEN-010 | Product owner | Starter allocation count, regions, inactivity/reclaim and transferability. | Starter land. |
| OPEN-011 | Product/legal/account owner | Transfer, gifting, suspension, inheritance and account deletion. | Ownership lifecycle. |
| OPEN-012 | Privacy/product owner | Public owner identity and precise-property privacy. | Public property projection. |
| OPEN-013 | Creator/Asset owner + license review | How workspace Assets become globally usable Earth templates. | Construction publication. |
| OPEN-014 | Product/data owner | Whether real building footprints are used and which source/license. | Developed property/unit layer. |
| OPEN-015 | Product owner | Land/building/unit rights matrix and multi-parcel builds. | Units and transfers. |
| OPEN-016 | Trust/safety owner | Building moderation, reports, appeal, removal and cache-purge SLA. | Broad public construction. |
| OPEN-017 | Infrastructure owner | Tile/object storage, import jobs, queues and CDN. | Scale/release. |
| OPEN-018 | Product/engineering owner | Target devices, supported browsers and performance SLOs. | Release gate. |
| OPEN-019 | Accessibility owner | Advanced mobile editor scope and fallback acceptance. | Construction release. |
| OPEN-020 | Platform owner | Earth permission names and stewardship roles. | Mutating service implementation. |

## 4. Assumptions to validate

1. A single launch region is acceptable before global acquisition rollout.
2. Guest visual Earth interaction is public; opening protected locations and
   browsing parcel availability require authentication and authorization.
3. Player ownership is personal User state; workspaces remain authoring and
   collaboration contexts.
4. Existing AssetVersion metadata can identify templates, but global
   publication needs extra policy/state.
5. Existing World Blueprint remains useful as optional authored context but is
   not a geographic source.
6. Browser-based Three.js is sufficient for the initial construction editor;
   Unreal is unnecessary for this track.
7. Acquisition is initially an in-game rule, not a cash transaction.
8. Existing public sharing demonstrates projection discipline but is not a
   property marketplace or moderation system.
9. Stable C: storage or managed services can support development while D:
   remains unavailable.

## 5. Risk register

| Risk | Impact | Mitigation / gate |
| --- | --- | --- |
| Boundary/license gaps | Incorrect or legally unusable map | Start with reviewed region; immutable manifests; license approval. |
| Disputed geography | Political/reputational harm | Separate source facts from display policy; explicit owner review. |
| False real-property impression | Consumer/legal harm | Repeated virtual-only copy; terminology review; no deed/legal title claims. |
| Projection error | Overlapping/mis-sized parcels | Local metric frames; geospatial fixtures/control points; zone review. |
| Global parcel explosion | Storage/query failure | Deterministic on-demand candidates; bounded viewport; sparse claims. |
| Double allocation | Loss of trust/property integrity | PostgreSQL locks, unique constraints, idempotency and high-contention tests. |
| SQLite-to-Postgres regression | Existing SIMVERSE breakage/data loss | Dedicated migration proof, full suite, row/hash comparison, rehearsed rollback. |
| User-generated abuse | Harmful public world | Private drafts, publication validation, moderation before broad visibility. |
| Asset license or mutable URL | Removed/changed developments | Immutable AssetVersion, content-addressed storage, publication/license gate. |
| Browser GPU/memory limits | Unusable map/editor on mobile | Vector tiles, layer budgets, dynamic loading, list/no-WebGL fallback. |
| Cache leakage/staleness | Private/moderated content remains visible | Safe projections, separate overlay cache, targeted purge and denial at detail. |
| Account deletion ambiguity | Orphaned or erased history | Approve retention/transfer/pseudonymization before launch. |
| Scope expansion | Earth never reaches a reliable slice | Gated launch region and phases; finish acceptance before adding unrelated work. |

## 6. Change procedure

For every decision change:

1. append a dated entry below;
2. mark the former decision SUPERSEDED rather than deleting it;
3. identify affected requirements, schema, tests and migration data;
4. obtain the named approval before implementation;
5. update all affected Earth documents in the same checkpoint.

## 7. Chronology

### 2026-10-24 - Phase 1 draft

- Recorded owner-approved product constraints and exclusions.
- Proposed MapLibre for Earth exploration, Three.js for construction and
  PostgreSQL/PostGIS for authoritative spatial persistence.
- Proposed sparse deterministic parcels, User ownership, resource grants,
  append-only history and immutable construction versions.
- Left data sources, economy, starter/transfer/privacy/moderation and migration
  choices open for explicit approval.

### 2026-10-24 - Phase 1 closure

- Approved guest access as visual Earth interaction only. Protected location
  selection triggers authentication with bounded destination preservation.
- Approved 25 m x 25 m (625 m²) as the default base parcel size, with changes
  permitted only through approved immutable development-zone rules.
- Reconfirmed that SIMVERSE land and property are virtual and never convey
  ownership or rights in real-world land or structures.
