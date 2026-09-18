# SIMVERSE — Current Status

> Living handoff document. Update at every meaningful checkpoint. This is the
> source of truth for Claude ↔ Codex handoff. Long-form vision lives in
> [vision/VISION.md](vision/VISION.md); project rules live in
> [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0
- **Phase:** Phase 2 — Projects & Simulation Builder — **COMPLETE**
- **Subphase:** — (all Phase 2 work landed; quality gates green)
- **Last updated:** 2026-09-18
- **Execution boundary:** No runtime. Simulations are *configuration only*.
  SimulationRun / ticks / results / mechanics are **Phase 3** and must not exist.

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

Phase 2 is functionally complete and all automated gates pass. Remaining before
declaring the phase closed: (1) optional human walkthrough of the two scenarios
on the dev server, (2) commit the work (recommended message
`feat: complete SIMVERSE Phase 2 projects and simulation builder`). Do **not**
begin Phase 3 (the execution engine) without an explicit new instruction.
