# SIMVERSE — Master Capability Map

> A single, honest inventory of every major SIMVERSE capability and how mature it
> actually is. This exists so that significant capabilities (Animation Studio,
> Worlds, Social, Business, future Products) are never silently forgotten while
> active development focuses elsewhere. It complements, and must stay consistent
> with, [CURRENT_STATUS.md](CURRENT_STATUS.md), [vision/VISION.md](vision/VISION.md),
> and [../AGENTS.md](../AGENTS.md).

## Audit metadata

- **Audit date:** 2026-10-13.
- **Inspected checkpoint:** current `HEAD`
  (`fix: complete SIMVERSE beginner experience QA`), including the browser-QA
  and auth fix in `7a4eb47` and Beginner Creation Experience v1 in `8699345`.
- **Method:** direct inspection of `src/`, `prisma/schema.prisma`, services,
  modules, routes, components, and the committed status history. Claims are
  grounded in code that exists, not in roadmap intent.

### Percentage disclaimer

Percentages are **rough maturity indicators toward the full SIMVERSE vision**,
not code coverage, not test coverage, and not a promise of completeness. A
"PRODUCTION-READY" foundation capability can still be a small fraction of its
eventual scope; the percentage is relative to *that capability's own intended
scope*, while the state word describes *how trustworthy what exists is today*.
When evidence is ambiguous, the lower estimate is used.

### Maturity states

| State | Meaning |
| --- | --- |
| **NOT STARTED** | No implementation. Concept, placeholder page, or roadmap entry only. |
| **FOUNDATION** | Architecture, schema, or scaffolding exists; not yet usable end-to-end. |
| **PARTIAL** | Works for a narrow slice; important paths missing or stubbed. |
| **FUNCTIONAL** | Usable end-to-end for its current scope, server-authoritative, tested. |
| **PRODUCTION-READY** | Functional, hardened, isolated, audited, broadly covered by tests. |

---

## Portfolio summary

| Pillar | Overall state | Notes |
| --- | --- | --- |
| **Foundation** (Platform/Core) | FUNCTIONAL → PRODUCTION-READY | The strongest area. Core is deterministic and well-tested. |
| **Simulation Modules** | FUNCTIONAL (Battle/Race/Survival/Tournament) | Three real modules + generic tournament; all other modes NOT STARTED. |
| **Creation** | PARTIAL | Entity/World/Simulation creators are usable; media creators NOT STARTED. |
| **Experience / Runtime** | PARTIAL | Three.js Web Preview + Standard Animation work; high-fidelity/world/AI runtimes NOT STARTED or paused. |
| **Social** | NOT STARTED | No code exists. |
| **Business** | NOT STARTED | No code exists. |
| **Products** | PARTIAL (Anything Wars only) | Anything Wars is the only built product; all others are concepts. |

---

## FOUNDATION (Platform + Core)

| Capability | State | ~% | What exists today | Next meaningful milestone |
| --- | --- | --- | --- | --- |
| Platform (cross-cutting shell) | FUNCTIONAL | 65% | Authenticated platform shell, navigation, `requireApiContext`/`requirePlatformContext`, `dataResponse`/`errorResponse`, audit service, dashboard | Choose the next platform system (Collaboration or Storage) and build it as a reusable service |
| Accounts / Auth | FUNCTIONAL | 80% | Registration, sessions, authenticated user context, user service | Account lifecycle hardening (recovery, verification, external identity) as needed |
| Workspace / Roles / Permissions | PRODUCTION-READY | 85% | Workspace-scoped everything, memberships, role→permission enforcement on the server, safe NotFound, isolation proven in tests | Organizations layer above Workspaces; invitation UX |
| Projects | PRODUCTION-READY | 80% | Project CRUD, project↔entity links, auto-resolved "Quick Creations" organizer project | Add a database-enforced identity for reserved system projects before public multi-process scale; nested/tagged organization as the library grows |
| Entity system | PRODUCTION-READY | 85% | Entities, attributes, categories, tags, duplication, archive/restore, workspace isolation, audit | Richer relationships and bulk operations |
| Entity Creator | FUNCTIONAL | 75% | `/entities/new` + edit, structured attributes, visuals page | Guided/templated first-entity flow; AI-assisted drafting (later) |
| Entity Visual System | FUNCTIONAL | 70% | `EntityVisualProfile`, archetypes, Three.js model preview, transforms, animation mapping | Production asset pipeline + generated/sprite source maturity |
| Asset Library | FUNCTIONAL | 60% | Workspace-scoped assets, immutable versions, specs, relationships, safe references, CRUD | Binary upload/hosting/CDN and content optimization (Draco/KTX2/LODs) |
| World Blueprint System | FUNCTIONAL | 60% | `World` + immutable `WorldVersion`, 12-section designer, biomes, presets, Asset/Entity bindings, Simulation pinning | A World *runtime* adapter that renders a blueprint (big, future) |
| Simulation Core | PRODUCTION-READY | 85% | Deterministic fixed ticks, serialized `mulberry32-v1` RNG, actions/state/events/results, immutable run snapshots, engine registry, pause/resume/replay | Worker-driven long runs beyond request-bounded batches |

**Core authority boundary (unchanged, and must stay unchanged):** Core decides
what happens; modules compute mechanics; Experience Profiles describe
presentation; runtimes render. Nothing in the UX or Product layers may rewrite
authoritative results or historical Run snapshots.

**Pre-public-scale hardening item:** Quick Creations project creation is
logically idempotent in ordinary use but lacks a database-level uniqueness
guarantee under simultaneous first creation across multiple requests/processes.
A proper fix needs an explicit platform/schema invariant and an atomic create or
upsert path. This checkpoint deliberately avoids an in-process mutex or another
fragile workaround.

---

## SIMULATION MODULES

| Capability | State | ~% | What exists today | Next meaningful milestone |
| --- | --- | --- | --- | --- |
| Battle | PRODUCTION-READY | 85% | Deterministic `battle-v1` module, full rules/stats/schemas, 3D Web Preview replay, tournament adapter, extensive tests | Depth of mechanics; richer presentation |
| Race | FUNCTIONAL | 80% | Deterministic `race-v1` (Sprint/Circuit), fixed-tick execution, truthful progress/result views, tournament adapter, tests | 3D/visual playback via a future protocol version |
| Survival | FUNCTIONAL | 80% | Deterministic `survival-v1` (Last Standing/Endurance), hazards/resources, truthful views, tournament adapter, tests | Visual playback; multi-participant tournament matches |
| Tournament | FUNCTIONAL | 70% | Generic coordinator; single-elimination + round-robin; head-to-head Battle/Race/Survival via result adapters; lifecycle + standings | Multi-participant matches, teams, double-elim/Swiss, seasons, scheduling |
| Economy | NOT STARTED | 2% | — (listed as a future/disabled mode only) | Define the first economy mechanics package against Core |
| Civilization | NOT STARTED | 0% | — | Mechanics package design |
| Sports | NOT STARTED | 0% | — (Sports Lab is a concept product, not a module) | Mechanics package design |
| Strategy | NOT STARTED | 0% | — | Mechanics package design |
| Random / composite modes | NOT STARTED | 2% | — (visibly disabled future mode in Anything Wars) | Define how composite/random modes compose existing modules |

All simulation modules are **reusable mechanics packages**, registered through
the Core engine registry. They are not Products and must never be coupled to
Anything Wars specifically.

---

## CREATION

| Capability | State | ~% | What exists today | Next meaningful milestone |
| --- | --- | --- | --- | --- |
| Create experience (beginner gateway) | FUNCTIONAL | 70% | Visual preview-first `/create` gateway, truthful `LIVE`/`COMING_LATER` catalog, permission-aware cards, progressive disclosure | Extend previews/templates as new creators arrive |
| Entity Creator | FUNCTIONAL | 75% | See Foundation → Entity Creator | Templated first-entity flow |
| World Creator | FUNCTIONAL | 60% | Structured World Blueprint designer (not a 3D editor), presets | Rendered/live world authoring (far future) |
| Simulation Creator | FUNCTIONAL | 80% | Simulation Builder, structured Battle/Race/Survival forms, READY validation, no raw JSON for ordinary flows | Guided/templated scenario starts; more modes |
| Animation Studio | NOT STARTED | 0% | A clearly-marked **"Coming later"** preview card only. **Must not be built this phase.** | Standalone scene/character/timeline/camera/dialogue creator (independent of any Simulation/World/Product) |
| Video Studio | NOT STARTED | 0% | — | Editing/assembly/export tooling (future Creator/Media pillar) |
| Content Studio / Media Engine | NOT STARTED | 3% | `/studio` is an honest "coming soon" placeholder (AI director / highlights / exports previews) | Define the media pipeline that consumes clean Run output |
| Audio / Voice / Captions | NOT STARTED | 0% | — | Part of the Creator/Media pillar, later |
| Templates | FOUNDATION | 15% | `/templates` concept page; real presets scattered across World/Experience/Tournament + Quick War modes | A unified, first-class template system across creators |

**Creator/Media reminder:** Animation Studio, Video Studio, and the Content
Studio are the **Creator/Media Platform** pillar — they are **not** Simulation
Modules, and the Standard Animation System (runtime states) is **not** Animation
Studio.

---

## EXPERIENCE / RUNTIME

| Capability | State | ~% | What exists today | Next meaningful milestone |
| --- | --- | --- | --- | --- |
| Three.js Web Preview | FUNCTIONAL | 70% | Battle 3D replay, immersive Watch mode, orbit/zoom, saved-snapshot playback, graceful fallback | A second module adapter, or richer Battle presentation |
| Standard Animation System | FUNCTIONAL | 75% | `AnimationController`, 13 production semantic states, crossfade, loop/one-shot/terminal handling, in-place root-motion | More archetype coverage; reserved states (JUMP/FLY/SWIM/EMOTE/…) |
| Runtime Protocol | PARTIAL | 30% | `v1` Battle-only projection + generated JSON Schema + drift tests + fixtures; package service reads authorized completed Runs | `v2` (or reviewed extension) to export Race/Survival/World |
| High-Fidelity (Unreal) Runtime | FOUNDATION | 5% | Architecture + feasibility + readiness audit docs only. **Paused** — external D: drive instability / Disk Event 51. No Unreal project in this repo | Resume **only** after D: storage is stable and approved; keep out of this repo |
| Living World Runtime | NOT STARTED | 0% | — | Depends on World runtime adapter + high-fidelity runtime |
| Persistent Worlds | NOT STARTED | 0% | — | Requires world runtime + persistence model |
| AI Director | NOT STARTED | 0% | Concept preview in `/studio` only | Needs clean Run output + media engine first |
| AI agents / citizens | NOT STARTED | 0% | — | Research/design, far future |
| Player-controlled entities | NOT STARTED | 0% | — | Requires interactive runtime |
| Multiplayer / rooms / presence | NOT STARTED | 0% | — | Requires realtime transport + presence model |

**Unreal / D: warning:** the high-fidelity runtime track is paused due to
external D: drive instability. Do **not** access or modify anything on D:, and do
**not** resume Unreal work until that storage is confirmed stable and the work is
explicitly approved. This repository is the web/platform repo only.

---

## SOCIAL

Every capability below is **NOT STARTED (0%)** — no code exists. Tracked so they
are not forgotten.

| Capability | Next meaningful milestone |
| --- | --- |
| Explore | A read surface for workspace-shareable creations |
| Creator profiles | Public identity model (depends on sharing + accounts scope) |
| Following | Social graph model |
| Sharing | A reviewed public/unlisted visibility model (today: runs are workspace-scoped, Watch routes are internal) |
| Public / unlisted creations | Visibility + safe projection of Run/creation data |
| Community | Depends on profiles + sharing |
| Challenges | Depends on sharing + products |
| Livestreaming | Depends on runtime streaming (far future) |
| Audience participation | Depends on multiplayer/presence |

---

## BUSINESS

Every capability below is **NOT STARTED (0%)** — no code exists. Tracked so they
are not forgotten.

| Capability | Next meaningful milestone |
| --- | --- |
| Marketplace | Requires asset hosting + listings + permissions |
| Credits | Ledger/accounting model |
| Payments | Payment provider integration + billing service |
| Subscriptions | Plan/entitlement model |
| Creator earnings | Depends on marketplace + payments |
| Advertising / sponsorship | Far future; policy + placement model |

---

## PRODUCTS

| Capability | State | ~% | What exists today | Next meaningful milestone |
| --- | --- | --- | --- | --- |
| Anything Wars | FUNCTIONAL | 60% | v0 product shell composing Platform/Core/Modules/Creator systems; Battle/Race/Survival events; Tournaments; real workspace data; result-first run pages; **Quick War + Custom War** beginner experience | Worker-driven runs; more modes; richer worlds; sharing |
| Anything Wars — beginner UX | FUNCTIONAL | 70% | Visual Create entry, Quick War (intelligent defaults, auto "Quick Creations" project), preserved Custom War, result-first completed experience, truthful Watch gating; browser-verified at 390/768/1024/1440 px | Real-user onboarding study and instrumentation; database hardening for simultaneous first Quick Creations project creation |
| Robot Arena | NOT STARTED | 0% | Concept card only | Product design on top of a bot/behavior module |
| Farm Empire | NOT STARTED | 0% | Concept card only | Needs an Economy/Agriculture module first |
| Civilization (product) | NOT STARTED | 0% | Concept card only | Needs a Civilization module first |
| Survival (product) | NOT STARTED | 0% | Concept card only (the Survival *module* exists; the standalone *product* does not) | Product shell over the Survival module |
| Sports Lab | NOT STARTED | 0% | Concept card only | Needs a Sports module first |
| Future products | NOT STARTED | 0% | — | Compose Platform + Core + Modules + Creator/Media |

Products **consume** generic SIMVERSE systems. SIMVERSE must never be
re-architected around Anything Wars (or any single product).

---

## "Usable SIMVERSE MVP" assessment

| Dimension | State | ~% | Reading |
| --- | --- | --- | --- |
| Create → Simulate → Experience (single workspace, beginner path) | FUNCTIONAL | ~65% | A new user can create competitors, run a Battle/Race/Survival via Quick War, and see a real, truthful result with replay for Battle. |
| Create Content (media/animation/video) | NOT STARTED | ~2% | The Creator/Media pillar is not built; only honest placeholders exist. |
| Share (social/distribution) | NOT STARTED | 0% | No sharing/social/business surfaces exist. |

**Overall:** SIMVERSE today is a **functional single-workspace simulation and
product platform** with a strong deterministic Core, three real mechanics
modules, usable generic creators, and one shippable product (Anything Wars) that
now has a genuine beginner on-ramp. The **Create → Simulate → Experience** arc
works end-to-end for the beginner path; **Create Content** and **Share** are the
two largest unbuilt arcs of the full vision.

---

## Maintenance rule

Update this map at every meaningful checkpoint, in the same change set as the
code and `CURRENT_STATUS.md`. Never inflate a state or percentage to signal
progress — the map is only useful while it is honest. When a capability moves,
move its row *and* its "what exists / next milestone" so the next milestone
always points at the real next step.
