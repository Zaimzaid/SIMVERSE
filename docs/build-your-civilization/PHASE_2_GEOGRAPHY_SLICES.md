# SIMVERSE — Build Your Civilization | Phase 2 Fictional World Geography

**Status:** Phase 2A implementation on review branch, not a published ten-country virtual world.  
**Branch:** `feature/build-your-civilization-phase2-geography`  
**Parent branch:** `feature/build-your-civilization-foundation` (Phase 1 draft PR #47).  
**No geography publication, country seeding, player data writes or database migrations in Phase 2A.**

## Established strategy and proposed numbers

- One fictional SIMVERSE planet (existing planet-local radius: **6,000 km**) with **five proposed continents**; continent shapes/names not yet settled.
- Founding country names: Valdora, Arandia, Novara, Dravonia, Marovia, Solandia, Vestria, Altavia, Eldoria, Terranova.
- **Provisional** 38 states, 76 cities/towns, 228 potential districts.
- Planning distribution: Valdora 4 states; Arandia 5; Novara 2; Dravonia 6; Marovia 2; Solandia 4; Vestria 3; Altavia 4; Eldoria 2; Terranova 6. Two planned city/town slots per state, three district slots per city.
- **Aven** is the agreed proposed capital name of Valdora, without a fixed state or geographic position.
- Proposals requiring review: Valdora as staff-managed showcase country, Arandia as first citizen-led pilot; one pilot district candidate in Arandia's first state/city planning slot and two expansion candidates.
- Inactive proposed districts are **not** part of a live community or a claim of land rights.
- Urban pilot size 4 km²; mixed-use 8 km²; rural 16 km²; standard urban SIMVERSE-reserved land target 10%. None of these is mapped/allocated in this slice.

## Phase 2A — Browsable founding plan (this PR)

**Delivered as source code subject to CI and browser QA:**
- `src/lib/planet/founding-plan.ts`: typed canonical proposal and deterministic hierarchical slot generation. The planning IDs intentionally are NOT final persistent geographic IDs.
- `src/lib/planet/founding-plan.test.ts`: 10-country inventory, 38/76/228 total, uniqueness, one pilot/two expansion candidates, and unpublished state.
- `/planet/planning`: read-only responsive founding-world overview with 10 country cards, counts and an explanation that this is *not* published geography.
- `/planet/planning/[slug]`: detailed state/city/district planning slots with zero active districts, clear capital placement uncertainty, and pilot candidates.
- `GET /api/planet/planning`: independent read-only proposed plan summary, without geometry or property claims.
- `/planet` globe status links to the plan without suggesting that the ten countries have appeared on the surface.
- No data migrations, no staff grant changes, no live country records, no imaginary coordinates, no old Earth changes.

**Acceptance checks:**
1. Typecheck, lint, tests, production build on disposable DB.
2. Public planned-world page accessible without login; links and 404 behavior correct.
3. Ten country cards and hierarchy totals correct; 1 candidate and 2 future pilot expansions marked non-active.
4. No published polygons appear on the globe just because the plan has ten proposed names.
5. Old `GET /api/planet/countries` remains authoritative for published countries.
6. Test mobile/desktop /planet and /planet/planning in light/dark; inspect overflow and legibility.
7. Owner reviews country sizes, hierarchy, capitals, district activation and proposed staff country before approving official placement.

## Phase 2B — Continent and country shape design (next)

- Draft **original** five-continent geometry and coastlines on the existing fictional sphere (no Natural Earth imports); obtain owner visual acceptance before publication.
- Design ten non-overlapping sovereign territory polygons with measured areas and resources; map Aven to an approved position.
- Decide which territory is staff-managed and which is pilot; verify access and natural geography.
- Use existing `FictionalCountry` draft/publish APIs with explicit independent `FictionalPlanetSteward` grants. No auto-publication or unknown admin role escalation.
- Add genuine published-country globe overlays and select/panel behaviors based on the real API, accessible list fallback, correct empty state.
- Record versioning/rollback policy for existing published polygons before shape revisions.

## Phase 2C — Persistent geographic hierarchy (later)

- Define proper fictional Continent, State, City/Town, District entities and verified parent-child boundaries.
- Choose authoritative database and migration path (currently SQLite dev and a separate PostGIS proof); no destructive migration.
- Bind each administrative area to a published country/version; validate topological containment and prevent overlapping district allocation.
- Give each district reviewed area, type (urban/mixed/rural), status (planned/reserved/active), land-use constraints and optional official reserve.
- Keep citizenship, district residence, staff planning permissions and plot rights **separate**; do not infer them from planning slots.
- Test cross-country parent integrity, immutable published versions, steward authority, rollback, concurrency and no stale parcel collisions.

## Phase 2D — Citizen-ready pilot map (later)

- Show approved country/state/city/district drill-down using real geography and real published data.
- Activate one reviewed citizen-led district only when platform and population readiness gates pass.
- Expose candidate zones and infrastructure constraints only; voting and actual constructions belong to Phase 7/8.
- Run performance/accessibility/browser QA and owner acceptance; avoid empty or fake playable cities.

## Release gates and cross-track sequencing

Phase 1 PR #47 is a **draft** and has not been merged. This Phase 2 branch is stacked on the Phase 1 feature branch, not merged into `master`. CI passing is necessary but not a substitute for owner browser review or world design approval. The existing `/earth` real-world data is preserved and is not a seed for a fictional planet.

**Phase 2A is the starting geographical planning layer, not Phase 2 completion.**
