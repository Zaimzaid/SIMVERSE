# SIMVERSE Earth - Product Requirements

## Document status

- **Phase:** 4 - Development Zones and Parcel Discovery
- **Implementation status:** Phase 4 is implemented and locally verified; the
  isolated PostgreSQL/PostGIS execution gate remains pending.
- **Branch:** `feature/simverse-earth-land`
- **Baseline:** `9e98bcd` (`feat: add SIMVERSE Earth interactive explorer`)
- **Last reviewed:** 2026-10-27

The labels below are used throughout the Earth documents:

- **Approved requirement** - stated by the owner in the Phase 1 brief.
- **Proposed decision** - recommended architecture that still requires owner review.
- **Assumption** - used to make the plan concrete and must be confirmed.
- **Open decision** - blocks or materially changes implementation.

## 1. Product definition

**Approved requirement.** SIMVERSE Earth is the persistent global land and
property system within the existing SIMVERSE ecosystem. It combines the
Platform's identity, permissions, assets and audit systems with persistent
world state and creator tooling. It is neither a replacement for SIMVERSE nor a
standalone application.

**Proposed decision.** Treat Earth as a product surface backed by reusable
Platform and Core services:

- the **Platform** owns accounts, authorization, provenance, storage references,
  moderation hooks and audit history;
- **Core persistent-world services** own geography versions, virtual parcels,
  reservations, properties, ownership history and saved construction state;
- the **Creator / Media Platform** contributes the Asset Library and future
  creation workflows used by the building editor;
- **SIMVERSE Earth** presents Explore, Acquire, Build and View workflows;
- Simulation Modules may later use Earth locations, but no module owns Earth.

## 2. Product promise

A person can explore a recognizable virtual Earth, navigate through real place
hierarchies, find an eligible virtual property, satisfy in-game acquisition
rules, build within its virtual boundaries and see the saved development on the
shared map.

Every acquisition surface must state clearly:

> SIMVERSE properties are virtual items. They do not convey ownership, title,
> tenancy, mineral rights or any other right in real-world land or structures.

The UI must never call an item a deed to real land or imply a legal relationship
with a government, landowner or occupant.

## 3. Goals

### GEO - Geography and discovery

1. **GEO-01 - Approved requirement.** Present real-world countries with real
   shapes and scale from traceable licensed data.
2. **GEO-02 - Approved requirement.** Support administrative states, provinces
   and regions, followed by cities, towns and localities where source data
   supports them.
3. **GEO-03 - Approved requirement.** Provide geographical search, hierarchical
   selection, globe rotation, pan and progressive zoom.
4. **GEO-04 - Approved requirement.** Store accurate geospatial position and
   preserve dataset version, source, license, retrieval date and checksum.
5. **GEO-05 - Approved requirement.** Represent missing, approximate, disputed
   or point-only boundaries honestly. A town name or point must never be given a
   fabricated polygon.
6. **GEO-06 - Proposed decision.** Separate stable place identity from immutable
   dataset revisions so corrections do not rewrite prior property context.
7. **GEO-07 - Proposed decision.** Serve generalized vector tiles by zoom level;
   do not send national or global raw GeoJSON to the browser.

### LAND - Virtual land and property

1. **LAND-01 - Approved requirement.** Use 25 m by 25 m (625 m²) as the default
   base parcel size. An approved development-zone rule may configure different
   dimensions for that immutable zone version.
2. **LAND-02 - Approved requirement.** Generate parcel candidates only inside
   approved development zones. Do not pre-generate every possible parcel.
3. **LAND-03 - Approved requirement.** Give every parcel a stable globally
   unique identifier and deterministic geometry.
4. **LAND-04 - Approved requirement.** Expose availability, zoning and relevant
   acquisition conditions.
5. **LAND-05 - Approved requirement.** Support virtual empty-land property,
   developed property and eligible residential or commercial units.
6. **LAND-06 - Approved requirement.** Support expiring reservations, exclusive
   ownership, concurrency protection, ownership history and transfers.
7. **LAND-07 - Approved requirement.** Support in-game eligibility checks and
   starter-land rules without implying a real-money or real-property purchase.
8. **LAND-08 - Approved requirement.** Show owner-specific indicators on the map.
9. **LAND-09 - Proposed decision.** Persist only parcels that are reserved,
   acquired, developed, retired or explicitly exceptional. Unclaimed
   availability remains a deterministic query result.
10. **LAND-10 - Proposed decision.** Freeze an acquired parcel to its development
    zone revision. Later source-boundary changes may retire future availability
    but cannot silently move a held property.
11. **LAND-11 - Approved requirement.** Represent Development Zones as reviewed,
    immutable versions with explicit draft, review, active and retired lifecycle
    states, provenance, local metric grid definition and rollback history.
12. **LAND-12 - Approved requirement.** Never treat a point-only locality as a
    boundary. A zone requires an explicit reviewed Polygon or MultiPolygon
    contained by a sourced polygon parent revision.
13. **LAND-13 - Approved requirement.** Keep Earth stewardship separate from
    workspace administration. Ordinary workspace owners and administrators do
    not receive global zone mutation or activation authority.
14. **LAND-14 - Approved requirement.** Phase 4 admits complete grid cells only,
    excludes cells that touch configured exclusions and derives unclaimed plots
    at query time without persistence.
15. **LAND-15 - Approved requirement.** Label demonstration geometry as
    synthetic and every plot as virtual. It must not be described as cadastral
    data or as conveying real-world land rights.
16. **LAND-16 - Approved requirement.** Parcel viewport queries require a
    sufficiently detailed zoom and enforce fixed result and candidate-scan
    bounds.

### BUILD - Construction

1. **BUILD-01 - Approved requirement.** Place web-compatible 3D building
   templates on an owned or authorized virtual property.
2. **BUILD-02 - Approved requirement.** Support position, rotation and bounded
   customization.
3. **BUILD-03 - Approved requirement.** Enforce parcel boundaries and zoning on
   the server. Browser collision or outline checks are guidance only.
4. **BUILD-04 - Approved requirement.** Save, load and version persistent
   construction records.
5. **BUILD-05 - Approved requirement.** Make approved developments visible to
   other Earth viewers.
6. **BUILD-06 - Approved requirement.** Check property ownership and delegated
   building permission for every mutation.
7. **BUILD-07 - Proposed decision.** Pin templates and placed content to
   immutable Asset versions. Store references and transforms, never 3D binaries,
   in relational rows.
8. **BUILD-08 - Proposed decision.** Keep draft construction revisions private
   until a server validation step publishes one revision as the visible build.

### UX - User journey

1. **UX-01 - Approved requirement.** Support this primary flow: Explore Earth ->
   Country -> State/Province -> City -> Town/Locality -> Property -> Complete
   Acquisition -> Build -> Save -> View Property on Earth.
2. **UX-02 - Approved requirement.** Guests may see Earth and rotate, pan and
   zoom the visual surface without authentication. They cannot open protected
   locations, browse available parcels or acquire property.
3. **UX-03 - Approved requirement.** Selecting a protected location while
   signed out starts login or registration and preserves that intended
   destination. After authentication, the server authorizes and re-resolves the
   destination before showing protected geography or availability.
4. **UX-04 - Approved requirement.** Make the flow responsive,
   beginner-friendly and explicit about the next available action.
5. **UX-05 - Proposed decision.** Pair the map with a keyboard-operable search
   and list view so geographic discovery is not pointer-only.

## 4. People and access

| Person | Expected access |
| --- | --- |
| Guest | See and visually manipulate Earth; selecting a protected location starts authentication. Cannot browse parcel availability, acquire or build. |
| Authenticated player | Guest access plus authorized location detail, parcel discovery, eligibility checks, reservations and acquisition where allowed. |
| Property owner | Manage the virtual property, construction drafts, grants and visibility within policy. |
| Delegated builder | Edit only the properties and drafts explicitly granted to them. |
| Workspace creator | Reuse authorized workspace Assets and Worlds when a property workflow permits it. |
| Data steward | Import, validate, activate and supersede geographic datasets and development zones. |
| Platform administrator | Resolve operational incidents, policy actions and audited corrections through dedicated tools. |

**Proposed decision.** Current property ownership should be attached to a
SIMVERSE `User`, not to the user's active Workspace. Workspace roles continue to
govern workspace Assets and collaborative designs. Property access uses an
additional resource-level owner/grant check. This avoids changing ownership when
a player switches workspaces while preserving collaboration.

## 5. Invariants

1. Geography shown as authoritative always identifies its dataset revision.
2. Missing boundaries remain missing; a label point is not a polygon.
3. A parcel exists inside one immutable development-zone revision.
4. A parcel can have at most one active reservation and one current virtual
   property claim.
5. Reservation expiry and acquisition are evaluated by server time.
6. Acquisition is idempotent and transactional.
7. Ownership history is append-only. Corrections append compensating events.
8. A published building revision cannot be changed in place.
9. Every placed Asset is authorized and version-pinned.
10. Editing a current geography source, Asset, World or building cannot rewrite
    historical SimulationRun or property history.
11. Client coordinates, prices, eligibility and ownership claims are never
    trusted without server validation.

## 6. Non-functional requirements

### Integrity and security

- Use the existing session, safe NotFound, validation, service and audit
  conventions.
- Apply resource-level checks in addition to workspace permissions.
- Prevent cross-workspace Asset references and cross-user property mutation.
- Use transactional locks, idempotency keys and database uniqueness constraints
  for reservations and acquisitions.
- Sanitize user copy and treat all uploaded or referenced content as untrusted.

### Scale

- Avoid global parcel materialization.
- Query geography and parcels by viewport, hierarchy or stable identifier.
- Use spatial indexes and zoom-specific vector tiles.
- Keep large map, terrain and model binaries outside the relational database.
- Permit independent cache invalidation by dataset and zone revision.

### Accessibility and devices

- Support keyboard search, structured lists, visible focus, meaningful labels,
  reduced motion and a non-WebGL explanation/fallback.
- Keep acquisition and building actions usable on mobile; the advanced 3D editor
  may offer a simplified mobile mode rather than concealing unsupported controls.
- Never encode availability or ownership by color alone.

### Provenance and policy

- Record source, version, attribution, license and checksum for geography and
  third-party Asset inputs.
- Preserve disputed-name and boundary policy independently of raw source data.
- Require moderation and abuse-reporting design before global user-generated
  structures become broadly visible.

## 7. Phase 1 exclusions

Phase 1 does not include:

- MapLibre, PostgreSQL/PostGIS or any other new dependency;
- geography ingestion or generated tiles;
- a Prisma schema change or database migration;
- virtual property acquisition, currency, entitlements or starter allocation;
- parcel generation in production;
- a globe route or 3D building editor;
- fabricated town boundaries, terrain or structures;
- Unreal Engine, the D: drive, multiplayer or cloud runtime work.

## 8. Open product decisions

The following require owner approval before their dependent implementation
phase:

1. launch country/region and authoritative data providers;
2. attribution, redistribution and data-refresh policy;
3. treatment and labeling of disputed territories and names;
4. acquisition eligibility, in-game currency/entitlement and reservation TTL;
5. starter-land quantity, eligibility, inactivity and reclamation rules;
6. transfer, gifting, inheritance, suspension and account-deletion behavior;
7. public owner-name visibility and privacy controls;
8. who may publish building templates into the global Earth catalog;
9. moderation, reporting and appeals for visible constructions;
10. whether real building footprints are used and under which source/license;
11. accessibility and performance launch budgets on named target devices.

See [DECISION_LOG.md](DECISION_LOG.md) for the proposed decisions and approval
gates, and [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) for measurable outcomes.
