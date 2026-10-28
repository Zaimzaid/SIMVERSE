# SIMVERSE

**A simulation, creation, and virtual-world platform — under active development.**

> **Status (28 October 2026):** The repository contains a working web-platform foundation, tested feature implementations, and several browser-based 3D prototypes. It is **not** a production-ready persistent multiplayer virtual world. Major changes live in **unmerged pull requests**; do not confuse a successful GitHub build with a shipped feature.

## Vision: what we are building

SIMVERSE is intended to combine two complementary experiences:

1. **A living virtual universe:** players establish an in-world identity, explore regions and cities, hold fictional citizenship and travel documents, pursue careers, create businesses, work, trade, build property, socialize, and interact in a shared, persistent 3D world.
2. **A simulation and creator platform:** creators build entities and worlds, configure rules, run battle/racing/agriculture/economy/civilization simulations, inspect authoritative results, and turn outcomes into replayable, shareable media. **Anything Wars** is an early flagship concept, not the entire platform.

The architecture separates **Platform → Core → Simulation Modules → Creator/Media → Products**. The authoritative simulation/economy state must remain separate from the renderer; the 3D client visualizes that state.

Our target feel: **polished, accessible, cinematic and modern**, with an original SIMVERSE identity and a visually convincing Lagos-inspired starter city. Concept images show aspirations, **not working features**.

See [full product vision](docs/vision/VISION.md) and [detailed status, roadmap, and acceptance gates](docs/PROJECT_STATUS_AND_ROADMAP.md).

## Current progress

The table distinguishes code from end-to-end product readiness. “Implemented on branch” means source and tests exist, **not** merged/deployed or approved by the owner.

| Area | What exists | Current assessment |
| --- | --- | --- |
| Web platform | Next.js account/auth flows, workspaces, roles, teams, projects, entities, assets, worlds, simulations, creator pages, baseline replay and analytics | **Foundation implemented** on `master`; not a finished commercial product |
| Earth Explorer | Country-first MapLibre geography, Nigeria catalog, navigation, city/town discovery, steward-based development zones and synthetic parcel browsing | **Implemented in Earth branches**; acquisition, construction, and developed-property rights **not delivered** |
| Player identity (Phases 1–4) | Permanent fictional SIMVERSE ID, profiles, home-country preference, independent virtual citizenship/passport review, visa/travel-policy pilots, dual-citizenship policy checks | **Implemented in draft branch stack**; permissioned review is **not automatically provisioned** |
| Careers & work (Phases 5–6) | Career selection, one-time SVC starter credits, virtual company drafts, orientation quiz, reviewer-controlled company approval, jobs/applications/offers/employment records | **Implemented in draft branch stack**; no general payroll or professional licensing |
| Economy Lab (V1–V3) | Private closed GFC economy lab, 50 simulated citizens, 5 businesses, treasury, production, wages, shopping, taxes, ledger; player-owned shops and a **separate** 3D town visual | **Implemented in draft branch stack**; restricted sandbox, not an autonomous shared-world economy |
| Marina Junction 3D (V0.1/V0.2) | Walkable procedural city, roads, buildings, decorative cars/pedestrians, plaza, camera modes, graphics settings and measured browser HUD | **Playable technical visual proof**; fails desired architectural/character realism; V0.2 on a **separate branch** |
| UI reorganization | Top area tabs, contextual left navigation, right shortcuts, role-aware search, reorganized Dashboard/Create/Profile and mobile drawer | **Implemented and CI-tested in PR #17**, awaiting visual acceptance |
| Virtual cards/passports | Plastic-style player/citizenship/residency cards, fictional passport booklets, issue/expiry and validity display tied to authorized records | **Implemented and CI-tested in PR #18**; not real identification |
| Illustrated backgrounds | Original day/night city illustration, world/creator/identity artwork; public and dashboard heroes, other section headers, light/dark treatments | **Implemented and CI-tested in PR #19**; SVG art is **not 3D gameplay footage** |
| Integrated high-quality world | Optimized Blender/GLB assets, credible avatars, working interiors, persistent in-world activities, connected city areas, player-to-player interaction | **Not delivered** |
| Release and operations | Consolidated branch, migration rehearsal, staging, moderation, security review, real load/performance measurements, deployment | **Not released** |

**Reality check:** Screens seen in one branch may disappear when you switch to another. `master` does **not** contain the newer Earth/player/economy/UI features until they are reviewed and integrated. The user-tested Marina Junction V0.2 showed roughly **28–30 FPS in sampled High-quality moments**, not a guaranteed target or benchmark for future scenes.

## Where the development is saved

Current work is intentionally isolated in draft or unmerged PRs:

| Track | PR(s) | Description |
| --- | --- | --- |
| Earth navigation / visibility | [#1](https://github.com/Zaimzaid/SIMVERSE/pull/1), [#3–#5](https://github.com/Zaimzaid/SIMVERSE/pulls) | Land visibility and regional explorer navigation |
| Marina Junction | [#6](https://github.com/Zaimzaid/SIMVERSE/pull/6) → [#16](https://github.com/Zaimzaid/SIMVERSE/pull/16) | Independent browser-based city V0.1 → V0.2 |
| Player systems | [#7–#12](https://github.com/Zaimzaid/SIMVERSE/pulls) | Identity, documents, immigration, governance, careers, business and work |
| Economy Lab | [#13](https://github.com/Zaimzaid/SIMVERSE/pull/13) → [#15](https://github.com/Zaimzaid/SIMVERSE/pull/15) | Persistent GFC pilot, player commerce, economic 3D visualization |
| UI and documentation | [#17](https://github.com/Zaimzaid/SIMVERSE/pull/17) → [#19](https://github.com/Zaimzaid/SIMVERSE/pull/19) | Navigation redesign, document wallet, illustrated backgrounds |
| This documentation | Documentation-only PR (see branch `docs/project-readme-status-roadmap-20261028`) | One accessible project overview and actionable backlog |

**Important branch relationship:** PR #19 is stacked on #18 → #17 → #15 → #14 → #13 → #12 and the earlier player branches. **Marina Junction V0.2 (#16) is not part of that stack**. Integration must be planned explicitly. None of these PRs should be described as merged solely because CI passed.

## Immediate priorities

1. **Consolidation and regression protection:** audit branch history, identify incompatible changes, prepare an integration branch with a *disposable* database, and test authentication, geography, player work, economy and UI together. Do not overwrite the owner's existing SQLite database.
2. **Visual quality sign-off:** inspect the new UI and backgrounds in both light/dark modes; fix contrast, overflow, broken controls, and misleading placeholder information.
3. **Blender + Three.js asset workflow:** build **one excellent-looking street**, not another grid of boxes. Create/obtain legally reusable Blender assets, preserve `.blend` sources, export optimized `.glb`, review licenses, use LOD/compression and record FPS.
4. **One genuinely playable vertical slice:** player enters the street, walks into a shop, interacts with a character, performs a meaningful authorized business action, and sees the result persist after reload.
5. **Then expand deliberately:** geo/land ownership rules, construction, multiplayer, richer AI, advanced professions, creator systems and production operations.

For the owner-approved **10-milestone delivery sequence**, status matrix, acceptance criteria, open decisions and non-goals, read **[PROJECT_STATUS_AND_ROADMAP.md](docs/PROJECT_STATUS_AND_ROADMAP.md)**. Earth has its **own** official eight-phase plan; milestone numbers here do not replace it.

## Local development (Windows / VS Code)

**Prerequisites:** Node.js compatible with the repo (CI uses Node 24), npm, Git, a free local port, and enough disk space. Blender is *optional* until the asset-production milestone.

```powershell
git clone https://github.com/Zaimzaid/SIMVERSE.git
cd SIMVERSE
git fetch origin
# For the newest UI + documents + backgrounds features (NOT Marina Junction V0.2):
git switch --track origin/feature/platform-illustrated-backgrounds-v1
npm ci

# Only create .env if you do not already have one:
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Review `.env.example`, configure a private `SESSION_SECRET` and use a **new disposable SQLite database URL** (e.g. `DATABASE_URL="file:./simverse-roadmap-test.db"`) for experiments. Never commit `.env`, expose credentials, reset a valuable database, or run destructive test setup against user data.

```powershell
npm run db:generate
npm run db:push
npm run earth:import:nigeria
npm run dev -- --port 3020
```

Open `http://localhost:3020`, register/sign in to a **test account**, and inspect `/dashboard`, `/create`, `/profile`, `/profile/documents`, `/economy/lab` and `/earth/geography`. Country/business reviewer privileges are independently operator-provisioned and cannot be self-granted through the public UI.

Check the **separate** city branch for Marina Junction V0.2: `feature/marina-junction-visual-v02`. Switch only with a clean Git tree, and don't assume its database schema matches another branch. See [Marina visual QA](docs/economy/ECONOMY_LAB_PHASE3_VISUAL.md) for economic-town caveats.

For a production-like local run, build first: `npm run build` followed by `npm start`. Never use `npm start` without an existing production build.

## Tests and engineering rules

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

**WARNING:** the repository's integration-test helpers reset database tables. Run tests only with a **disposable test database**, never with a database holding real player work.

Development practices for humans and coding agents:

- Implement in small reviewable branches/PRs; mark **implemented**, **verified**, **laptop-reviewed**, **merged** and **deployed** separately.
- Always state which branch was tested, which data set was used and which acceptance gates passed. Fix broken gates before claiming success.
- Do not invent city features or statistics from concept illustrations. Verify all assets/licensing and measure performance on the user's hardware.
- Don't auto-approve passports, citizenships, companies or land rights. Respect reviewer boundaries, audit history and privacy.
- Never mix nonredeemable **SVC** starter credits, sandbox **GFC** money, real fiat, or real-money payments without an expressly approved design and legal/security review.
- No autonomous merge or release of unreviewed stages; owner confirmation is required for major product decisions, destructive database changes, monetary features and deployments.
- Keep `README.md` and the detailed roadmap updated in every meaningful milestone PR.

## Detailed documentation

- [Product and visual vision](docs/vision/VISION.md)
- [Status, planned work and acceptance criteria](docs/PROJECT_STATUS_AND_ROADMAP.md)
- [Earth eight-phase implementation plan](docs/earth/IMPLEMENTATION_PLAN.md)
- [Player identity and citizenship](docs/player/IDENTITY_CITIZENSHIP_PHASE1.md)
- [Player work and business approvals](docs/player/WORK_EMPLOYMENT_PHASE6.md)
- [Economy Lab](docs/economy/ECONOMY_LAB_V1.md) / [3D economy proof](docs/economy/ECONOMY_LAB_PHASE3_VISUAL.md)
- [UI navigation redesign](docs/UX_NAVIGATION_REDESIGN_V1.md)
- [Visual backgrounds](docs/UX_ILLUSTRATED_BACKGROUNDS_V1.md)
- [Virtual ID/passport designs](docs/player/VIRTUAL_DOCUMENT_WALLET_UI_V1.md)

---

**Last reviewed: 28 October 2026.** Roadmap is planning information, **not** a claim that all listed features are playable or that an overnight autonomous coding task can finish them without intervention.
