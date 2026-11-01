# SIMVERSE — Phase 7: Schematic Land, Protected Zones and District Planning

**Branch:** `feature/build-your-civilization-phase7-land-planning`
**Base:** Phase 6 draft PR #59, stacked on previous unmerged civilization PRs.
**Phase 2:** still paused. No verified district-boundary polygons are available as authoritative geographic sources.

## Delivered in this phase

- District-scoped, independently granted `FoundingLandPlanningGrant` (inactive by default), NOT automatically inherited from country administrator, resident, moderator, platform account or workspace owner.
- `FoundingLandPlan` with version counter and immutable `SCHEMATIC_DRAFT` state. Does not transition to approved, published or active.
- `FoundingLandArea` normalized rectangular areas (0–10,000 diagram units each axis), categorized:
  - **PROTECTED:** `ECOLOGICAL` or `CORRIDOR`
  - **PUBLIC_RESERVE:** `CIVIC`
  - **DEVELOPMENT:** `RESIDENTIAL`, `COMMERCIAL` or `MIXED_USE`
- Strictly validated non-overlap among all planning categories; shared edges allowed. Schematic board only, and protected zones have no user-visible edit/delete/conversion path.
- Stale-revision conditional update in the same transaction as area creation to block simultaneous writes that would bypass area-collision checks.
- Authenticated APIs `GET/POST /api/civilization/land` for a caller's own grants, draft plan, `CREATE_DRAFT` and `ADD_AREA`. No publish/land title/building/project funding endpoint.
- `/profile/civilization/land`, linked from My Civilization: responsive graphic diagram with labelled protected and public zones, planner-only editor, and **clearly fictional non-interactive example board** for accounts with no grant.
- Audited creation records, regression tests for permission gating, protected area overlap, bounds, category compatibility, immutable preview status, revocation, and zero wallet/citizenship/residence effects.

## Critical boundaries

**These are NOT real geographic parcels.** The planning grid is abstract and not an Earth or SIMVERSE planet coordinate system, cadastral parcel, surveyed district boundary, site reservation, ownership title, building permission, project feasibility decision or currency-backed land asset. Neither draft nor example board may be sold, transferred, occupied or used to fund development.

The existing `FoundingDistrict.verifiedGeoVersionId` is only a plain string marker. It is **not** sufficient proof of a spatially approved boundary; adding a geographic version ID to that field must not automatically publish the Phase 7 planning diagram. No public interface can activate parcels or approve district plans.

Additional site-validation work is required *after* Phase 2 is accepted: a normalized country/district polygon coordinate system, verifiable geometry-version foreign keys, no-overlap for arbitrary polygons (not rectangles), containment within district, reserved road and utility corridors, shoreline/topography exclusions, area/capacity metrics, plan-review records, approvals, authoritative version updates, topology and storage migration. Only then can parcel identifiers and site-selection/approval proceed.

## Tests and release gates

- [ ] GitHub Actions: disposable Prisma SQLite, TS, lint, unit/integration tests, production build.
- [ ] Review at 320/390/768/1366 px, dark and light mode, diagram labels and keyboard form controls.
- [ ] Cross-account permission isolation with explicit planner grant fixture; revoked planner cannot write.
- [ ] Backup/restore and additive DB migration review. **No db:push against a valuable SIMVERSE database**.
- [ ] Security/performance review of geometric collision checks, future Postgres isolation and grant-provisioning lifecycle.
- [ ] Owner approves fictional geography in Phase 2 before any real map overlays are made available.
- [ ] No merge/deploy until stacked draft PR dependencies and separate account deletion/export implications have been checked.

## Phase 8 handoff

Phase 8 will connect community-shortlisted proposals to **human staff feasibility review** and site proposals, with independently approved geography, a protected land envelope, explicit staff development capacity and funding controls. Neither a district vote nor a drawn diagram is enough to construct a building or spend Vascoin.
