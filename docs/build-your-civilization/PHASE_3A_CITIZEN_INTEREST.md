# SIMVERSE — Build Your Civilization | Phase 3A: Identity, Nation Preference and Pilot Interest

**Branch:** `feature/build-your-civilization-phase3-citizen-interest`  
**Base:** `feature/build-your-civilization-foundation` (Phase 1 draft PR #47).  
**Status:** First testable Phase 3 slice, not Phase 3 completion. Phase 2 is paused and none of its draft country polygons are required by this branch.

## Goal

Support a real signed-in user workflow for selecting **one preferred founding nation** and optionally indicating interest in an **unapproved proposed citizen-led pilot district**. Preserve the existing permanent SIMVERSE ID, legacy sourced-Earth home-country field, virtual citizenship review ledger, passports, travel and privacy policies. **Do not grant fictional national citizenship, district residence, membership, voting powers or land rights.**

## Implemented

- Approved naming vocabulary: Valdora, Arandia, Novara, Dravonia, Marovia, Solandia, Vestria, Altavia, Eldoria and Terranova, independent of Phase 2's unmerged draft geometry.
- New isolated Prisma `FoundingCitizenInterest` model: one record per user, nullable preferred nation, optional proposed pilot interest, timestamps and cascading deletion with the user.
- Session-authorized `GET/PATCH /api/civilization/my-interest` endpoint; strict JSON schema, no client-supplied userId or privilege fields.
- Service reads/writes only this preference model; audit logs record changes; no citizenship documents, legacy Earth places or official FictionalCountry model changes.
- `/profile/civilization` authenticated page with current preference, proposed pilot-interest state and explicit unassigned residence.
- Citizen dashboard and profile links to the new page, with citizen navigation.
- Integration tests for ten names, empty defaults, persistent update/clear, strict validation, user isolation, preserved original SIMVERSE ID, no grants, and audit history.
- `test/helpers/db.ts` explicitly deletes test preference rows on disposable test databases only.

## Important product distinctions

- **SIMVERSE ID:** existing permanent player ID, unchanged.
- **Founding nation preference:** a changeable expression of interest, not official nationality.
- **Existing `homeCountryId` and `PlayerCitizenship`:** linked to legacy EarthGeoPlace records and reviewed virtual document workflows; *not reinterpreted* as one of the ten fictional country nations by this PR.
- **Pilot interest:** an optional non-binding interest flag relating to the proposed Arandia founding district, not a guaranteed queue position, migration, residence or district membership. Citizens may express interest regardless of preferred nation.
- **Actual citizenship:** future authorization workflow must refer to an approved/published fictional country ID (not a name or planned slot); it must reconcile any existing citizenship records and enforce only one primary citizenship.
- **Residence and vote eligibility:** future persistent country/state/city/district IDs, official active district record, explicit assignment, transfer and anti-double-voting rules required. Those are **not** in Phase 3A.

## Database and testing safety

This slice adds a Prisma model; **it requires a schema change** on the environment where it is run. GitHub CI uses disposable SQLite and `prisma db push`, but do not run `db:push`, migration, reset or integration tests on a valuable existing database. Use a separate clone and a newly configured **disposable local SQLite `DATABASE_URL`** and run the usual generate, typecheck, lint, tests, build commands there. Never reuse real player data merely to test.

For production, first design and execute an explicit reviewed migration with backup, restore rehearsal, monitoring and rollback plan. The pull request does not apply a migration or write any existing database.

## Acceptance checks

1. Automated CI (disposable schema, TypeScript, lint, unit/integration, Next build) passes.
2. Signup/login and `/profile/civilization` load after isolated database schema setup.
3. Nation select offers exactly ten choices; saving is remembered after refresh/sign-out/sign-in; clearing works.
4. Toggle pilot interest on/off independently; no district is marked active and no nationality or document is automatically issued.
5. Two accounts remain isolated; request userId injection is rejected; endpoints refuse signed-out requests.
6. Existing `/profile`, `/profile/documents`, `/social`, creator area and prior Earth country preference still work.
7. Mobile and desktop UI, dark/light, errors and save-feedback behavior are visually verified.
8. Data backup/restore and migration approach reviewed before merge or deployment.

## Next Phase 3 milestones (dependent on Phase 2 approval)

- **3B — Official fictional primary citizenship:** reviewed one-primary-citizenship enrollment linked to a published `FictionalCountry`, with nationality policies, fraud/duplicate constraints and no self-issued privileged documents.
- **3C — Actual residence/district join:** approved active geographic district IDs, capacity/waitlist controls, authenticated assignment, moderation policies and durable historical migrations; separate from nationality.
- **3D — Travel vs residency and governance:** distinct current visit location, one ballot district, migration cooldown, eligibility checks and cross-country settlement rules.
- **3E — Browser beta and signoff:** tested two-player path and documented abuse/privacy/accessibility results.

### Merge dependency note

This Phase 3 branch is **independent of paused Phase 2 code**. It duplicates only the ten previously agreed display names in a new small vocabulary. Before eventually merging either branch, reconcile catalogs and plan the stable official identifiers. **Do not merge draft Phase 2 into Phase 3 automatically.**
