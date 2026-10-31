# SIMVERSE — Build Your Civilization | Phase 0 Repository Baseline Audit

**Date:** 2026-10-31  
**Repository:** `Zaimzaid/SIMVERSE`  
**Audited baseline:** `master` at `b22c4108228b292111f745a6470392b46226e36e` (2026-10-30)  
**New roadmap branch:** `feature/build-your-civilization-foundation`  
**Audit type:** connected GitHub source/document inspection; **not** a locally executed build, device QA, security penetration test, backup or deployment.

## Purpose

Prepare the existing software for a new **SIMVERSE — Build Your Civilization** citizen-led virtual-world direction while preserving accounts, social data, assets, old creators, economy experiments, and all existing geographic records. No old functionality is to be deleted during Phase 0.

## Observed source inventory

- `master` exists and was confirmed at the SHA above. The repository is public as observed on 2026-10-31.
- Next.js 16.3.5, React 19.3, TypeScript 7.0.2, Prisma 7.10.0/SQLite dev, MapLibre 6.15 and Three.js 0.186 appear in `package.json`.
- The `src` tree includes **87 page routes**, **179 API route files**, and **94 local `*.test.ts(x)` files** at this checkpoint; `prisma/schema.prisma` defines **104 Prisma models**. These are code counts, **not evidence that routes work or tests pass**.
- Source includes registration, login, virtual player identity, citizenship/document reviews, social friendships, group messaging, notifications, reviewer-controlled business applications, jobs, Economy Lab and historic simulation/creator systems.
- `src/app/(platform)/dashboard/page.tsx` currently promotes Explore Earth, Build something, Run a simulation and Economy Lab; stats prioritize Projects, Simulations, Entities and Exports. It is not yet a citizen civilization dashboard.
- `src/lib/platform-navigation.ts` currently exposes Home, Explore, Build, Play & Simulate, Economy, Marketplace, Community, My Life. `src/app/(platform)/create/page.tsx` exposes creator and simulation tools.
- `src/app/(platform)/social/page.tsx` uses `CommunityV3`; preserve existing social permissions, friends, blocks, group messages, profiles and private-data boundaries.

## Two separate geography systems — critical

1. **Legacy Earth geography:** `/earth`, `/earth/geography`, `EarthGeo*` models, Nigeria real-world catalog, maps and exploratory zones/parcels. These are real-Earth oriented historical systems. No destructive replacement.
2. **New fictional planet:** `/planet` and `src/components/planet/signature-planet-explorer.tsx` are a procedural visual proof. `FictionalPlanet`, `FictionalCountry`, `FictionalCountryVersion` and `FictionalPlanetSteward` models exist. Public country API: `/api/planet/countries`; steward-only country administration/publish/archive endpoints exist. `src/server/services/fictional-planet-service.ts` has bounded geometry validation and independent steward grant checks.

**Not established by this audit:** any published country, working ten-country globe, fictional states/cities/districts, current local database contents, completed fictional-world entry, or production release. `docs/planet/PHASE_2_GEOGRAPHIC_CORE.md` explicitly describes a backend without a country-creator UI or rendered country overlays. `/planet` is an empty visual proof at this checkpoint.

**Design reconciliation:** `docs/planet/SIGNATURE_ORBITAL_PLANET_V1.md` is an earlier locked fictional-planet specification. Our new country/district/citizen-development model is a proposed extension and does **not** authorize rewriting published country polygons or seeding coordinates without validated geography and owner approval. Ten founding country **names** are agreed, but their shapes and state/district locations are not yet approved.

## Feature disposition recommendation (source-informed, preliminary)

| Area | Code evidence | Decision for citizen experience | Conditions |
| --- | --- | --- | --- |
| Accounts/auth, sessions, account controls | `app/api/auth`, `app/(auth)`, `User` | **KEEP / IMPROVE** | Browser and permissions regression required |
| Profiles, SIMVERSE ID, fictional citizenship | `PlayerIdentity`, `PlayerCitizenship`, `/profile` | **KEEP / ADAPT** | Separate primary citizenship, residence, current location |
| Social friendships, chat, groups, notifications | `/social`, social API, `CommunityV3` | **KEEP / IMPROVE** | Preserve block/privacy tests, live delivery QA |
| Fictional `/planet` and steward backend | Planet routes/services/models | **KEEP / EXTEND** | Verify 3D viewer and steward approval boundary |
| Real-world Earth explorer/zones | `/earth`, `EarthGeo*` | **STAFF/LEGACY / RETAIN DATA** | No deletion; do not mix with fictional country records |
| Creator Projects, Entities, Worlds, Experiences | `/projects`, `/entities`, `/worlds`, `/experiences` | **HIDE FROM CITIZEN NAV; STAFF/CREATOR ACCESS** | Hiding navigation is not authorization: preserve route guards |
| Create Simulation / Create Experience | `/create`, `/simulations` | **HIDE / STAFF-ONLY initially** | Preserve underlying simulations and their tests |
| Anything Wars, tournaments | `/anything-wars`, `/tournaments` | **EVALUATE for games pilot** | Select only a genuinely fun, reliably playable mode |
| Economy Lab; current SVC/GFC | `/economy/lab`, Wallet/Economy models | **RETAIN SANDBOX, DO NOT MIX** | Vascoin needs separate design/ledger/anti-abuse |
| Animation / video / asset creator tools | `/animation`, `/studio`, `/assets` | **STAFF/CREATOR OR POSTPONE** | No code deletion or loss of existing creations |
| Marketplace, advanced jobs/businesses | `/marketplace`, `/profile/work` | **POSTPONE public emphasis** | Preserve approved records and permissions |
| District assembly, development projects, treasury | No complete citizen-led end-to-end flow established | **NEW** | Design/specify + gated implementation |
| 3D neighborhoods, economy town | `/earth/neighborhood`, `/economy/lab/[labId]/world` | **PRESERVE PROOFS; NOT LAUNCH BLOCKER** | No claim of polished, integrated 3D gameplay |

## Baseline risks and gaps to address

1. **Product drift:** old creator-centric navigation and new citizen-first proposition currently coexist.
2. **Geography collision:** do not relabel real Earth places as fictional countries or create new countries using legacy Earth identifiers.
3. **Currency confusion:** current `SVC` and `GFC` are not Vascoin. No fiat value or transferability is approved for Vascoin.
4. **Identity/governance permission leakage:** workspace owner/admin rights are distinct from planet steward rights and district-authorized actions.
5. **Insufficient operational evidence:** repository docs describe integrated code but not signed-off staging, backups, device QA or production launch.
6. **Docs drift:** `docs/CURRENT_STATUS.md` and `docs/MASTER_CAPABILITY_MAP.md` contain older checkpoints. Cross-document reconciliation is needed after verified implementation.
7. **Unfunded development commitments:** virtual credits must never create an enforceable promise that a team will construct custom 3D assets on a weekly deadline.

## Remaining Phase 0 verification work (not completed)

- Run `npm ci`, Prisma validate/generate, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` **only on an isolated test checkout and disposable database**. Some integration helpers reset tables.
- Verify two-account registration/login, profile privacy, friend/block permissions and group chat in an actual browser.
- Inspect the live /planet viewer, fictional-country API, publication permissions and current database records.
- Inventory branch/PR merge status and any unmerged improvements not on master.
- Audit schema migration path; rehearse database backup/restore and rollback before any write/migration.
- Confirm security posture of protected APIs, reward farming threats and proposed map authorization.
- Sign off which UI links are hidden without removing access for authorized staff.
- Record the owner's browser acceptance before Phase 1 is marked completed.

## Safe change policy

This branch is **documentation-only** for the current checkpoint. No account data, migrations, UI behavior, currency balances or live deployment have been modified by this Phase 0 work. Do not merge until reviewed. Keep previous roadmap as history until explicit supersession is approved.

## Next

1. Review `ROADMAP_V1.md`.
2. Review `PHASE_1_SCOPE_AND_ACCEPTANCE.md`.
3. Finish the above audit gates on a disposable database.
4. Begin Phase 1 UI changes only after the audited baseline and feature access strategy are accepted.
