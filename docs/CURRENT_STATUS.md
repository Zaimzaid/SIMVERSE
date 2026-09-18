# SIMVERSE — Current Status

> Living handoff document. Update at every meaningful checkpoint. This is the
> source of truth for Claude ↔ Codex handoff. Long-form vision lives in
> [vision/VISION.md](vision/VISION.md); project rules live in
> [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0
- **Phase:** Phase 2 — Projects & Simulation Builder — **COMPLETE**
- **Subphase:** — (all Phase 2 work landed; quality gates green)
- **Committed:** **Yes.** Phase 2 landed in commit `0a6c606`
  (`feat: complete SIMVERSE Phase 2 projects and simulation builder`); working
  tree clean at last check.
- **Next phase:** Phase 3 — **SIMVERSE Core Engine v0.1** (execution).
  **Defined, NOT started.** Awaiting the Phase 3 implementation prompt.
- **Last updated:** 2026-09-18 (architecture-update addendum — see
  "Long-term architecture" and "Phase 3 boundary" below).
- **Handoff:** This document is the canonical Claude ↔ Codex source of truth.
  The repository and committed code are authoritative over conversation memory.
- **Execution boundary:** No runtime. Simulations are *configuration only*.
  SimulationRun / ticks / results / mechanics are **Phase 3** and must not exist.

---

## Long-term architecture (OFFICIAL — future-compatibility constraints)

These are official long-term SIMVERSE requirements (Master Architecture Update).
They are **not** all Phase 3. Do **not** implement future systems merely because
they are listed — but every architecture/implementation choice must stay
compatible with them.

- **Five pillars (OFFICIAL taxonomy).**
  - **PLATFORM** (cross-cutting systems): Identity/Accounts, Organizations,
    Workspaces, Memberships/Invitations, Roles/Permissions, Storage,
    Collaboration, AI Assistant, Marketplace, Billing, Audit/Governance.
  - **CORE**: Entities, Simulation Definitions, Simulation Runs, State,
    Time/ticks, RNG, Actions, Rules foundation, Events, Results, Replay
    foundation.
  - **SIMULATION MODULES** (reusable simulation *mechanics* packages): Battle,
    Racing, Tournament, Survival, Economy, Agriculture, Sports, Civilization,
    future mechanics packages.
  - **CREATOR / MEDIA PLATFORM** (its own major pillar — *consumes* simulation
    output and turns it into content): Asset Library, Media Engine, Video Studio,
    Caption Studio, Audio/Voice, Rendering, Export, Compression, Content tooling.
  - **PRODUCTS**: Anything Wars, Robot Arena, Farm Empire, Civilization,
    Sports Lab, future products.
  - **Not modules:** Creator/Media is NOT a Simulation Module. AI Assistant,
    Marketplace, Collaboration, Storage and Billing are PLATFORM/cross-cutting
    systems, NOT Simulation Modules. SIMVERSE is the platform; "Anything Wars" is
    one PRODUCT, never something the platform hardcodes around.
- **Ownership hierarchy (future).** Account → **Organization** → Workspace →
  Resources. The Organization tier slots **above** Workspace via an additive,
  nullable `Workspace.organizationId` when its dedicated phase arrives.
- **§24 — do NOT migrate now.** Current workspace-scoped Phase 0–2 resources are
  acceptable and stay workspace-scoped. Do not migrate data for Organizations
  now; keep the model additively migratable.
- **Org membership must NOT auto-imply workspace access.** Workspace access stays
  gated by an explicit `WorkspaceMember` row (already true today).
- **Centralized authorization only.** Roles are permission bundles; permissions
  are the authoritative model. Ask `can(role, permission)` — never scatter role
  checks. Org roles (OWNER/ADMIN/BILLING_ADMIN/MEMBER) compose with workspace
  roles later, in the one central place (`src/lib/permissions`).
- **§25 — stay generic.** No hardcoding around any single product (Anything Wars,
  battle, race, tournament, countries, robots, marbles, video, agriculture).
- **Storage.** SIMVERSE's own DB is the primary system. External cloud
  (Drive/Dropbox/OneDrive/Box) is backup/export/sync only — never the primary DB.
- **AI Assistant** (future, Levels 1–4) must **never** bypass authorization.
- **Future-only (do not build now):** Organizations/invitations/billing,
  Creator/Media & Video-editing platform, captions/voice/audio, collaboration
  chat, object comments, external cloud sync, onboarding/Academy, monetization,
  Marketplace, API/Developer platform.

## Phase 3 boundary (defined — NOT started)

**Phase 3 = SIMVERSE Core Engine v0.1** (§26), product-agnostic execution.

- **Phase 3 IS responsible for:** `SimulationRun`; deterministic seeded
  randomness; simulation state; clock/tick; actions; rules-evaluation foundation;
  events; run lifecycle; **immutable execution-input snapshots**; results
  foundation; headless execution; pause/resume where appropriate; deterministic
  replay preparation.
- **Phase 3 must NOT implement (§27):** Organizations UI/invitations/billing,
  Video Studio, Media Engine, Captions, Voiceover, Cloud backups, Chat, Comments,
  Onboarding, Marketplace, AI Assistant, Battle/Race/Tournament mechanics, World
  Editor, Content Engine, AI Director.
- **Standing design constraint (from the §28 analysis):** a `SimulationRun` must
  **snapshot its execution inputs** (seed + config version + participant inputs)
  so its correctness never depends on later edits to the live Simulation/Entity.
  This is what keeps replay, media, and collaboration compatible downstream.
- **§28 conclusion:** **no blocking** compatibility issues before Phase 3. All
  deferred, additive, and safe: (1) `Workspace.organizationId` FK; (2) an
  org-role tier composed into authorization; (3) `AuditLog.organizationId`;
  (4) the run↔simulation delete policy (a Phase 3 decision, resolved by input
  snapshots). Runs are workspace-scoped, so they migrate under §24 like every
  other resource.

---

## Scope of Phase 2

A real Project System, a reusable Simulation Definition + Builder, Project↔Entity
organization, and Simulation drafts. The journey is:

Login → Create Project → Add existing Entities → Open Project → Create Simulation
→ Choose mode → Select Entities → Configure settings / seed / environment
placeholder → Review → Save as Draft → reopen / Edit / Duplicate / Archive /
Restore.

**The user must NOT be able to run a simulation.** "READY" means the
configuration is complete, not that anything executes. Every surface that
mentions running states the execution engine arrives in Phase 3.

---

## Completed

### Data & services
- `prisma/schema.prisma` — Project, Simulation, join models, status columns.
- `src/server/services/project-service.ts` — CRUD + archive/restore/delete,
  `addProjectEntities` / `removeProjectEntity` (workspace-scoped, rejects
  foreign entities, skips duplicates), `listProjects` with filters/paging.
- `src/server/services/simulation-service.ts` — CRUD, `listSimulations`,
  `getSimulation` → `SimulationView`, duplicate/archive/restore/draft,
  `createSimulation` (config v1 + presentation normalization, resolveParticipants,
  seed generation).
- `src/server/services/simulation-validation-service.ts` — READY validation.
- `src/server/services/serialization.ts` — JSON string column (de)serialization.
- `src/lib/simulations/` — `config.ts` (SimulationConfigV1, general/mode/
  presentation, normalizers), `modes.ts` (Mode Catalog + availability),
  `seed.ts` (client-safe seed generate/normalize), `constants.ts`.
- `src/lib/projects/constants.ts`.
- Permissions: `simulation.run` exists in the role map but is **inert** (no run
  UI, no run endpoint, no runtime).

### API routes
- `api/projects` + `[projectId]` (route, archive, restore, entities,
  entities/[entityId]).
- `api/simulations` + `[simulationId]` (route, ready, draft, duplicate, archive,
  restore).
- All use `requireApiContext` → `dataResponse` / `errorResponse`; server-side
  Zod validation; safe-NotFound for foreign workspace IDs.

### Components
- Projects: `project-form`, `project-card`, `project-actions`,
  `project-entities-manager`, `project-library-controls`, `project-pagination`.
- Simulations: `simulation-builder` (8-step wizard, create + edit),
  `simulation-builder-model` (server-safe form model), `entity-picker`,
  `mode-card`, `simulation-card`, `simulation-actions`,
  `simulation-library-controls`, `simulation-pagination`.

### Pages (all built)
- `projects/page.tsx` — project library (list/filter/paginate + CTA).
- `projects/new/page.tsx` — create project.
- `projects/[projectId]/edit/page.tsx` — edit project.
- `projects/[projectId]/page.tsx` — detail (Overview / Entities / Simulations
  tabs; entities manager; project-scoped simulations + "Create Simulation" →
  `/simulations/new?projectId=…`).
- `simulations/new/page.tsx` — gates `simulation.create`; reads `?projectId=`;
  lists active projects; safe-resolves the preselected project;
  `<SimulationBuilder mode="create" …>`.
- `simulations/page.tsx` — real library (reads `q/status/mode/project/sort/page`;
  controls + card grid + pagination; CTA when empty).
- `simulations/[simulationId]/page.tsx` — detail (config / participants / seed /
  presentation; **no run button**, execution-engine notice for Phase 3;
  actions with `showView={false}`).
- `simulations/[simulationId]/edit/page.tsx` — `simulationToBuilderInitial` →
  `<SimulationBuilder mode="edit" …>`; blocks ARCHIVED; keeps current project in
  the list.

### Integration
- `/create` hub — `New simulation` → `/simulations/new` and `New project` →
  `/projects/new` are live (no "Soon" badge).
- `/dashboard` — real Projects (ACTIVE) / Simulations (non-archived) / Entities
  (ACTIVE) counts via `getWorkspaceStats`; Exports stays 0.

### Tests (Phase 2 — written & green)
- `src/server/services/project-service.test.ts` — 22 tests: create (slug, ACTIVE,
  audit, empty-name ValidationError, VIEWER AuthorizationError), update + re-slug,
  archive/restore (entities untouched), delete (cascades links + owned sims,
  entities preserved; CREATOR forbidden), workspace isolation & safe-NotFound,
  project↔entity links (count, dedupe, **foreign-workspace entity rejected with 0
  links**, all-or-nothing batch, foreign project NotFound, VIEWER forbidden,
  remove link keeps entity, no-op remove), list search/filter/sort/paginate,
  dashboard ACTIVE count.
- `src/server/services/simulation-service.test.ts` — 38 tests: create (DRAFT,
  config v1 defaults, battle mode default, presentation defaults, seed format,
  ordered participants, config/presentation normalization incl. themeColor
  uppercasing, explicit seed, mode slugification, duplicate-participant collapse,
  invalid mode config / bad seed / empty name → ValidationError, foreign project →
  ValidationError, foreign participant → ValidationError, VIEWER →
  AuthorizationError, audit), workspace isolation, update (scalars, READY→DRAFT on
  validity change, name-only keeps READY, participant replace, mode-change resets
  mode config keeps general), duplicate (new seed, DRAFT, copy name), archive/
  restore (restore re-derives READY vs DRAFT), delete (cascades participant links,
  entities preserved; CREATOR forbidden), markReady/markDraft (min-participant
  ValidationError, status unchanged on failure), list filter/mode/project/status/
  search/sort/paginate, dashboard non-archived count.
- Phase 0 / Phase 1 suites (8 files) preserved and green.

### Quality gates — all green (2026-09-18)
- `npx vitest run` — **146 passed** (10 files; +60 over Phase 1's 86).
- `npx tsc --noEmit` — **exit 0** (authoritative type check).
- `npx eslint .` — **exit 0**.
- `npx next build` — **exit 0**; all Phase 2 routes compiled.

---

## Architecture decisions

- **Config versioning:** `SimulationConfigV1 { version, general, mode }`;
  presentation stored separately; both serialized to JSON string columns; status
  stored as a validated string. New versions can be added without migration.
- **Server-safe form model split:** the builder's shape + pure mapper live in a
  non-`"use client"` model module so Server Components can build initial state;
  the client form re-exports only the erased type.
- **Participants reference entities by id** (never copied); selection order is
  participant position. No mechanics attached.
- **Mode Catalog** drives availability — unavailable modes render disabled
  ("Soon"), so new modes are data, not new code paths.
- **Next 16:** route `params` and page `searchParams` are Promises — always await.

## Known problems / watch-outs

- `simulation.run` must stay inert — do not wire any execution.
- `Switch` renders its own `<label>` when given a `label` prop; pair it with an
  external `<label htmlFor>` instead to avoid nested labels.
- typescript-eslint doesn't support TS 7.0, so `.ts/.tsx` are typechecked (tsc)
  but not lint-typed; `tsc --noEmit` is authoritative.
- `next dev` re-writes the agent-files block in `AGENTS.md`; commit it with the
  work to keep the tree clean (SIMVERSE rules live outside that marker block).

## Tests

- Phase 0 / Phase 1 suites: present and green (8 files).
- Phase 2 suites: **written and green** (project-service, simulation-service).

---

## Not done (deferred, by design)

- **Manual dev-server walkthrough** (port 3020) of the two genericity scenarios —
  "African Nations Battle" and "Greenheart Farm Experiments" — is a human QA step;
  the automated gates above stand in for it in CI. No blocking issues expected:
  the platform uses generic Entity/Simulation/Mode/Project terms throughout.
- **Phase 3 execution engine** — not started, by mandate.

## Exact next action

Phase 2 is **complete and committed** (`0a6c606`); all automated gates pass and
the working tree is clean. No Phase 2 code work is outstanding. The only optional
Phase 2 item is a human dev-server walkthrough (port 3020) of the two genericity
scenarios — a QA nicety, not a blocker. **Wait for the explicit Phase 3
implementation prompt before writing any execution/runtime code.**

---

## Checkpoint (Claude ↔ Codex handoff)

```text
LAST COMPLETED:
  Phase 2 — Projects & Simulation Builder. Complete; 146 tests green;
  tsc / eslint / next build all exit 0. Committed at 0a6c606.
  §28 architecture-understanding report delivered (read-only; no code changed).

CURRENTLY WORKING ON:
  Nothing in code. Long-term architecture requirements have been made official
  and recorded above ("Long-term architecture", "Phase 3 boundary").

NOT YET COMPLETED:
  - Phase 3 — SIMVERSE Core Engine v0.1 (execution). Defined, not started.
  - Optional human dev-server walkthrough of the two genericity scenarios (QA).

NEXT STEP:
  Wait for the explicit Phase 3 implementation prompt, then implement the §26
  scope ONLY (see "Phase 3 boundary").

DO NOT:
  - Begin Phase 3 or write any execution/runtime code before that prompt.
  - Wire anything to `simulation.run` — keep it inert until Phase 3 activates it.
  - Implement any §27 "must not" system (Orgs UI, Media/Video, Chat/Comments,
    Marketplace, AI Assistant, product mechanics, World Editor, …).
  - Migrate Phase 0–2 workspace-scoped data for Organizations (defer, §24).
  - Add scattered role checks — authorization stays centralized in
    src/lib/permissions.
  - Hardcode around any single product — keep generic domain terms.
```
