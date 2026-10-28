# SIMVERSE — Project Status, Product Scope and Release Roadmap

**Snapshot:** 28 October 2026  
**Source of truth:** `Zaimzaid/SIMVERSE` (private GitHub repository), current source and open PRs, plus the owner's laptop reviews.  
**Document purpose:** guide the owner, future coding agents and collaborators on exactly what exists, what is incomplete and what to build next. This is **not** a release certificate or delivery estimate.

[Return to project README](../README.md) · [Product vision](vision/VISION.md) · [Earth's authoritative 8-phase plan](earth/IMPLEMENTATION_PLAN.md)

## A. Product vision and boundaries

### A1. What SIMVERSE should become

An original global virtual universe combined with a general-purpose simulation/creator platform:

- **Living-world gameplay:** users create a player identity, explore a persistent interconnected world, travel between fictional regions, inhabit virtual property, enter realistic buildings, take jobs, create and operate businesses, manage in-world inventory, earn/spend in-game credits under explicit rules, and communicate with other players.
- **Society simulation:** careers, residents, production, transport, logistics, public services, health, education, farming, manufacturing, construction, markets, governance and economic circulation should have meaningful causal effects rather than decorative dashboard counters.
- **Simulation studio:** players/creators configure entities, worlds, rules, battle/race/sports/agriculture/robotics/economy scenarios, run authoritative simulations, analyze outcomes and create content from replays.
- **Creator ecosystem:** reusable 3D assets, simulation tools, creators' worlds, events, media production, accessible mobile/web clients, and future eligible monetization after legal, technical and financial checks.
- **Quality target:** credible browser-friendly hybrid-realistic 3D; immersive streets and interiors, natural characters and traffic, coherent lighting, useful controls and polished dark/light UI. SIMVERSE should not resemble a simple administrative dashboard or 32 plain building boxes.

### A2. Non-negotiable engineering rules

- **Preserve the truth:** do not infer that a visual concept, endpoint, unit test or CI pass means a commercial gameplay experience exists.
- **Independent authority:** player identity is not citizenship. Virtual citizenship, passports, company approval, government roles and land approvals use separately granted authority. Submitted forms do not self-approve.
- **Currency boundaries:** starting credits `SVC` and economy-sandbox `GFC` are different, nonredeemable balances. Never merge them into fiat or paid purchase logic by accident.
- **State/presentation separation:** the server stores authoritative transactions and simulation events. Renderers show them; they must not invent earned funds, land titles or approvals.
- **No destructive testing:** never run database-reset helpers, `db push` experiments, migrations or import scripts against a valuable data store without an explicit backup and safe plan.
- **Original visual design:** respect asset copyrights, keep editable Blender sources, document licenses; no copying existing games, game characters or government credentials.
- **Human review gates:** a code merge, production rollout or irreversible operator action needs explicit authorization. Unattended coding may continue only within a defined, non-destructive scope.

## B. Status vocabulary

| Label | Exact meaning |
| --- | --- |
| **Implemented on branch** | Source for the feature exists and is committed to a specific development branch. It is not necessarily integrated, visible in `master`, or browser-approved. |
| **CI verified** | That exact commit passed the workflow checks. No claim about a physical device, usability or real-world correctness. |
| **Browser observed** | A user/tester actually opened the feature, provided a recording or reproduced the behavior. |
| **Integrated** | Required independent branches are reconciled together and pass combined regression tests. |
| **Released** | Merged, deployed, monitored, documented and accepted for the target users. |
| **Planned** | Design/roadmap only; no reliable implementation or release claim. |

## C. Detailed inventory — implemented or prototyped

| Capability | Code already committed | What is still missing or unverified |
| --- | --- | --- |
| Shared platform | Account registration/login, workspace/team/role routes, creation studios, projects, entities, assets, worlds, simulation pages, events and management routes on `master`. | Production observability, broad end-to-end smoke QA, creator maturity, security review and scaling. |
| Viewer & Anything Wars | Existing generic simulation runtime/web preview, pages for Anything Wars events/tournaments/Watch and media foundation. | Realistic 3D playback quality, broad mode completeness, robust content export/live presentation; concept references are not production evidence. |
| Earth | Initial Earth architecture + geography import, country-based map, accessible navigation, Nigeria datasets, synthetic zone/parcel discovery, expanded LGA/settlement follow-ups on Earth branches. | Earth **Phase 5 acquisition, 6 construction, 7 developed property, 8 hardening**; no live parcel purchasing or verified ownership. |
| Marina 3D V0.1 | Procedural neighborhood, 32 basic buildings, roads, 9 decorative cars, overview/walk mode, basic parcel visualization. | High visual fidelity, avatars, interiors, credible traffic, broader environment. |
| Marina 3D V0.2 | Detailed frontages, landscaping, signage, benches, simplistic animated pedestrians, adjusted camera and draw-call/FPS overlay. Browser recording showed features visible at about 28–30 FPS on High in sampled moments. | Poor visual realism remains; excessive aerial draw calls; full low/medium testing and mobile profiling; isolated from Economy/UI branch. |
| Player 1: identity | Stable `SV-` player identifier, username/profile controls, visibility, experience type, optional fictional home-country preference. | A fully integrated playable avatar and physical in-world representation. |
| Player 2: documents | Virtual citizenship and passport applications, reviewed independently by country-scoped grants, issuance and expiry for approved travel documents. | Operator onboarding, renewals, revocation management UI, appeals and public verification policy. |
| Player 3: travel | In-world route/visa eligibility and approval flows; default routes locked. | Actual 3D transportation and cross-region travel; realistic travel experiences. |
| Player 4: governance | Dual-citizenship prerequisites, bilateral virtual visa-waiver policies and guarded country governance. | Mature virtual state administration; policy onboarding/workflow UI. |
| Player 5: careers | Choice among eight professions, one-time `SVC` career balance and fictional business drafts. | Rich career training, detailed job simulation, professional in-world activities. |
| Player 6: work | Safety orientation, independent business approvals, vacancies, applications, employer offers, candidate acceptance and virtual employment ledger. | Real in-world work activity, salaries integrated into a shared economic world, contracts, moderation. |
| Economy Lab 1 | Deterministic private lab: 50 virtual residents, 5 companies, treasury, taxes, wages, production, shopping, 13,000 GFC fixed money supply and audit ledger. | Real-time/offline autonomous population, global economy, cross-region trading; an operator-driven daily simulation is not an always-on world. |
| Economy Lab 2 | Invited workspace players can join, invest in an approved company, stock shops, receive simulated purchases and take paid local shifts with constrained GFC transfers. | Genuine 3D customer interactions, rich inventory, connected persistent city and player-facing money experience. |
| Economy Lab 3 | Separate 3D town route with animated symbolic economic representations tied to lab state. | NPC pathfinding, authentic interiors and visual realism, personal avatar in-world work; human browser quality signoff. |
| UI V1 | Six product-area tabs, focused left sidebar, right action rail, searchable navigation, mobile drawer, dashboard/Create/Profile rearrangement. PR #17 CI verified. | Owner's light/dark desktop/mobile approval; finer detail styling and accessibility audits. |
| Virtual documents UI | Personal SIMVERSE player card after username, fictional citizenship/residency cards, two passport booklet treatments, stored issue/expiry and expired/revoked display. PR #18 CI verified. | Old citizenship-approval backfill requires authorized operator; renewal workflow and owner visual signoff. |
| Background art | Five original static SVG city/world/creator/identity scenes wired into home/dashboard and several sections, with different day/night images. PR #19 CI verified. | Owner visual review and any required upgraded art; **not** city 3D assets or playable environment. |

### Confirmed from owner videos
- Marina Junction V0.1 and V0.2 **ran in the browser** with roads/buildings, overview and walk modes; V0.2 showed added plaza objects, small residents and vehicles.
- **V0.2 failed the visual standard**; the solution is a new Blender/GLB asset workflow, not adding more procedural boxes.
- Sampled High-quality scenes showed about **28–30 FPS**, and an aerial scene roughly **828 draw calls** in the visible HUD. This is a limited observation, not a representative performance certification.
- Recent UI, virtual document and illustrated background changes passed automated CI; they still need owner device review.

## D. Branches and unmerged PRs — critical to avoid lost features

| Track | Pull requests and branches | Relationship |
| --- | --- | --- |
| Earth | #1, #3, #4, #5 | Earth chain, separate from most player/economy branches |
| Marina | #6 → #16 | `feature/earth-neighborhood-3d-proof` → `feature/marina-junction-visual-v02` |
| Player and work | #7 → #12 | Identity → Documents → Travel → Governance → Career → Employment |
| Economy | #13 → #15 | Built on Player Phase 6; private GFC lab → local commerce → 3D town |
| Workspace UI | #17 | Built on Economy Phase 3 (#15) |
| Document wallet | #18 | Built on the UI branch (#17) |
| Art backgrounds | #19 | Built on Virtual Document Wallet (#18) |
| This documentation | A new documentation-only branch off #19 | Proposes root `README.md` and this file |

As of the snapshot, **all the above PRs are open/unmerged**, and most are draft. The original `master` does not include them. An integrated build must reconcile **at least the Earth enhancement chain, the player/economy/UI branch chain and the independent Marina V0.2 chain**. A branch checkout can legitimately show an earlier UI or city because another branch's commits are not included.

**Do not mass-merge PRs without reviewing data migrations and the overlapping Three.js renderer.** Use a dedicated integration branch with a reproducible database and a staged merge/rebase plan.

## E. What is NOT yet delivered

### Visual/interactive world
- Detailed Blender-sourced architecture, optimized GLB/glTF assets and controlled asset library.
- Fully rigged and customizable playable humans, realistic locomotion, interaction states and collision.
- Enterable shops, homes, workplaces, factories, interiors and usable objects.
- Street vehicles with steering, traffic rules, public transport and real travel.
- Cohesive city districts, connected road network and credible world boundaries.
- Scene LOD/culling/compression and acceptable measured FPS on the owner's laptop.

### Virtual society
- Persistent in-world property ownership/acquisition, rentals and building placement.
- Applied Earth land policies beyond exploratory synthetic plots.
- Authentic jobs/skills/work schedules in 3D, production chains and merchant transactions.
- Always-running population and multi-user, shared persistent social/economic world.
- Multiplayer visibility, chat, presence, privacy, moderation and reporting.
- In-game public institutions, rich governance and cross-region travel systems.
- Genuine interoperability between player citizenship, city access, economic ledger and map/world state.

### Creator/business/release
- Rich standalone animation/media studio, high-fidelity simulation Watch, content publishing and sharing.
- Cross-world creator marketplace, subscription/payment review and fraud prevention.
- Dedicated staging/prod environment, migrations/rollback/backup, telemetry, security and privacy reviews.
- Strong moderation/abuse response, automated end-to-end suite and supported-device release testing.

## F. Release roadmap — 10 proposed milestone gates

**These are forward-looking release milestones, NOT a claim that “Player Phase 1–10” is complete.** The separate [Earth plan](earth/IMPLEMENTATION_PLAN.md) has 8 authoritative phases and must retain its own numbering.

| Milestone | Goal | Current position | Completion / acceptance gate |
| --- | --- | --- | --- |
| **M0 — Inventory and baseline** | Confirm latest branch graph, code health, databases, visible features and owner-approved scope. | **Partially done** via audit and this documentation | Branch graph, known issues and reproducible smoke checklist signed off. |
| **M1 — One integrated development build** | Reconcile relevant Earth, player/economy/UI and Marina city features. | **Not done** | One branch with all chosen routes, Prisma schema and auth working; CI + combined integration tests; no lost work. |
| **M2 — UI / UX validation** | Finalize dark/light navigation, backgrounds, profile, virtual cards and mobile controls. | **Implemented in PRs #17–#19; visual signoff pending** | Owner walkthrough at 390/768/1366px, every active button works, legible contrast and no broken routes. |
| **M3 — Blender asset pipeline** | Source original/legally usable assets, make `.blend` masters and optimized `.glb` exports. | **Not started** | Three distinct credible buildings, one better vehicle, one rigged character and a material/asset license registry loaded in Three.js. |
| **M4 — First polished playable street** | Deliver street, plaza, working camera, player avatar and enterable shop. | **Not started** (procedural prototypes only) | Player can explore and enter shop, interact, exit and reload without blocking errors; measured performance on target laptop. |
| **M5 — First complete economic gameplay loop** | Join approved company/shop activity to persistent SVC/GFC-backed game state safely. | **Partial sandbox backend exists; interaction missing** | Player enters a shop, performs one authorized business action, views ledger/state and confirms persistence after refresh. No currency mint exploit. |
| **M6 — Virtual property and construction proof** | Begin governed land acquisition and one buildable plot after Earth Phase 5 approval. | **Not started** | Owner-acquired synthetic plot under explicit rules; build one structure with saved rights; audited rollback and no overlapping claims. |
| **M7 — Housing, vehicles and NPC depth** | Expand interiors, work routines, travel and AI movement deliberately. | **Not started** | One residence, one driveable vehicle, one NPC routine and one genuine work action tested end to end. |
| **M8 — Shared world** | Two-player authenticated coexistence in one persistent location. | **Not started** | Two clients see each other, synchronized movement/interactions, safe disconnection/rejoin and owner-scoped data. |
| **M9 — Creator/play and social ecosystem** | Connect high-quality simulations, events, replays and publishing to player-facing world. | **Foundational code exists; full product not delivered** | Create → run → watch real result → replay/publish one supported experience, with moderation and permissions. |
| **M10 — Closed beta readiness** | Secure, monitor, migrate and release a bounded first product. | **Not started** | Staging, performance budget, backups/restores, accessibility, security/privacy and abuse testing, pilot users and owner go/no-go. |

### Priority: one vertical slice, not another large empty world
**Target test:** Sign in → walk into one visually credible street → enter a shop → speak/interact with a character or object → execute one authorized work/business action → verify persisted economic outcome → return after reload to see correct state.

The feature must be *visually convincing*, *playable*, *auditable* and *repeatable*. Expanding map area or adding decorative characters without this loop does not satisfy the milestone.

## G. Immediate next actions (in suggested order)

1. **Do not merge early.** Freeze the current visual/background branch at its known CI-passing state and preserve the separately evaluated Marina V0.2 branch.
2. **Review UI in browser.** Capture homepage/dashboard in dark and light mode, 390px mobile, Profile, Create, Documents, Simulations and Economy. Log contrast/layout defects.
3. **Build an integration plan.** Compare PR #16's procedural renderer with PR #15's economy-town 3D component; address route, dependency and Prisma differences before merging. Create an isolated reproducible GitHub branch.
4. **Prepare Blender tooling:** install on the owner's Windows PC when approved; create an `assets/source` or equivalent original model registry, unit scale/axis convention, Blender→glTF export preset, texture budgets and visual benchmarks.
5. **Model one showcase block first:** one shop with exterior/interior, one apartment, one landmark, pavement/road sections, one vehicle and an animated character. Measure model sizes and draw calls.
6. **Implement interaction/persistence:** player/camera/animation, collisions, shop interaction API and audit-safe economic transaction. Regression-test the 2D economy and document reviewer paths.
7. **Only then** authorize expansion and higher-order society systems.

## H. Test, quality and security gates

### Automated
- Install deterministically: `npm ci`.
- Prisma: validate/generate, then push only to a **disposable** database.
- Static: `npm run typecheck`, `npm run lint`.
- Unit/integration: `npm run test` on isolated disposable DB; test helper can clear tables.
- Production: `npm run build`; for start use `npm start` **only after build**.
- Document any schema and migration requirements; avoid environment-specific shortcuts.

### Manual
- Role A (ordinary player), B (separate candidate) and C (independently authorized reviewer) for business/documents. Never bypass review prerequisites to make a screenshot look complete.
- Test UI at several widths and in both themes, keyboard navigation and visible error states.
- Test 3D WebGL fallback, camera collision, input, asset loading, performance at Low/Medium/High, unload/re-entry and private lab authorization.
- Verify balance conservation and immutable transfer histories for GFC; no collision between SVC and GFC.
- Verify cross-user/cross-workspace data isolation, no self-review, no unapproved passport or company issuance.

### Operations before any beta
- Database backup and restore rehearsal; migration forward/rollback.
- Separate development/staging/production secrets; credential rotation and least privilege.
- Abuse reports, content moderation, logging, alerting and rate limiting.
- License review for every imported model, texture, font and animation.
- Benchmarked time-to-interactive and FPS; track overdraw, draw calls, GPU memory and crash rates.

## I. Guidelines for unattended coding agents / long tasks

A coding agent can take **bounded phases** without owner interaction if permissions/tools allow, but cannot guarantee uninterrupted multi-hour progress, automatic task completion or deadlines. Use this contract:

1. **Before writing:** read `README.md`, this roadmap, `docs/vision/VISION.md` and the relevant subsystem specs. Inspect current branch/PR graph and clean worktree.
2. **Define scope:** one milestone/vertical slice and an exact `Definition of Done`; list exclusions, edge cases and data safety constraints.
3. **Work sequentially:** implement → add tests → run all checks → review diff → update docs → commit → open/update **draft** PR. Continue only if gates pass.
4. **Report actual evidence:** branch, commit SHA, tests/results, live browser verification (if actually run), missing work, blockers and reproduction commands.
5. **Stop for decisions:** real-money changes, explicit grants, reviewer access, destructive migrations, broad dependency changes, paid assets, merging, deployment and ambiguous product policy.
6. **Avoid unsupported progress claims:** do not call a simulated 3D animation an AI resident; do not label a visual concept a completed world; do not invent reviews, FPS or user acceptance.
7. **End with status:** COMPLETED / PARTIAL / NOT STARTED by acceptance criteria, not by arbitrary percentage.

## J. Owner decisions still needed

- Confirm the **first playable slice**: one Marina Junction street + enterable shop + verified GFC transaction, versus a different route.
- Confirm a practical Blender asset style target (hybrid-realistic, optimized for browser), legal asset sources and maximum scene budget.
- Define specific release platform priority: laptop browser first, then mobile responsive and/or streaming/native.
- Approve integration sequencing, safe DB migration path and when to merge existing draft PRs.
- Choose how fictional region travel, citizenship documents and land ownership integrate with actual gameplay; no real passport/fiat implications.
- Later: moderation rules, economics, monetization, beta access, reliability/SLO and privacy requirements.

---

**Maintaining this file:** update the inventory, gate evidence and GitHub PR table whenever code is merged, reverted, reviewed or released. A green CI workflow changes **CI verification status**, not browser QA or shipping status. Never silently change past statuses to “done” without evidence.
