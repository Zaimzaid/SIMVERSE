# SIMVERSE — Current Status

> Canonical Claude ↔ Codex handoff. The repository is authoritative. Long-form
> vision: [vision/VISION.md](vision/VISION.md). Rules: [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0
- **Phase:** Phase 3 — SIMVERSE Core Engine v0.1 implemented and verified;
  **uncommitted, awaiting review**.
- **Baseline:** clean repository at `0509ce4` (`chore: prepare SIMVERSE baseline
  for Phase 3`), following Phase 2 commit `0a6c606`. Direct baseline
  `npx vitest run` passed all 146 tests before Phase 3 edits.
- **Last updated:** 2026-09-18.
- **Commit status:** No Phase 3 commit or staging. Recommended eventual message:
  `feat: complete SIMVERSE Phase 3 core simulation engine`.
- **Execution boundary:** Core executes only through a registered Engine Module.
  The production registry is **empty**. Current catalog modes remain
  configuration choices without execution. Unsupported creation returns a
  conflict and creates no run.

## Official architecture and standing constraints

SIMVERSE is a simulation, creation, and content platform, not a single game.
Its five pillars are:

1. **PLATFORM:** Identity, Organizations, Workspaces, Memberships, Permissions,
   Storage, Collaboration, AI Assistant, Marketplace, Billing, Audit/Governance.
2. **CORE:** Entities, Simulation Definitions and Runs, State, Time/ticks,
   seeded RNG, Actions, Rules foundation, Events, Results, Replay foundation.
3. **SIMULATION MODULES:** reusable mechanics packages such as Battle, Racing,
   Tournament, Survival, Economy, Agriculture, Sports and Civilization.
4. **CREATOR / MEDIA PLATFORM:** Asset Library, Media Engine, Video Studio,
   Animation Studio, Caption Studio, Audio/Voice, Image/Graphics, Rendering,
   Export, Compression and content tools.
5. **PRODUCTS:** Anything Wars, Robot Arena, Farm Empire, Civilization,
   Sports Lab and future products.

Creator/Media is **not** a Simulation Module. AI Assistant, Marketplace,
Collaboration, Storage and Billing are Platform systems. Anything Wars is one
Product, never Core itself. Core and its payloads stay generic.

**Animation Studio** is an official Creator/Media capability, separate from
World Creation, Simulation execution and Video Studio. It must eventually
support standalone content creation without any Simulation, Run, World or
Product. Phase 3 only supplies serializable run output for future consumers;
it implements no animation or media features.

Future ownership is Account → Organization → Workspace → resources. Do not
migrate workspace-scoped Phase 0–2 data now. An eventual nullable
`Workspace.organizationId` and organization role tier must be additive;
organization membership never implies workspace access. Central workspace
permissions remain authoritative. SIMVERSE's own DB is primary; external
cloud is backup/export/sync only. Future AI must honor authorization.

## Completed implementation

### Data and immutable inputs

- `prisma/schema.prisma` adds `SimulationRun`, `SimulationRunParticipant`,
  `SimulationRunAction` and `SimulationRunEvent`, plus User/Workspace/Simulation
  relations. Runs record source Simulation/workspace, lifecycle, seed, versions,
  serialized input/state/result, tick/time/sequence counters, failure details
  and timestamps. Actions/events have unique per-run sequence and tick indexes;
  runs have workspace/simulation/status indexes.
- One creation transaction snapshots a READY Simulation, configuration,
  presentation, seed, participant order/roles/overrides and relevant Entity
  data: name, short name, category, colors, image reference, metadata, tags,
  attribute definitions and values. Versioned input and stable run-participant
  rows are stored with initialized state. Ticks read only that snapshot, never
  live Entity/Simulation values. Later edits/deletion cannot change history.
- Run participants keep `sourceEntityId` as a historical scalar, not an Entity
  FK. A Simulation with runs cannot be permanently deleted: service checks
  plus `onDelete: Restrict` protect it, including Project deletion and races.
  Both sources can still be archived; shared Entities are not cascade-deleted.
- This repo historically uses Prisma `db push`. Phase 3 has additive schema
  changes and no migration file. `npx prisma db push` applied them to local
  `dev.db` without reset. Vitest prepares its isolated test DB automatically.

### Pure Core and lifecycle

- `src/lib/engine/` holds the headless engine, central lifecycle map,
  fixed-step clock, seeded RNG, validated snapshot/state/action/event/result
  schemas, Engine Module contract and registry. It has no HTTP, UI or Prisma
  dependency. Module hooks run in order: initialize, plan actions, evaluate
  rules, check completion, build result.
- Run creation copies the Simulation's validated `SV-XXXXXXXX` seed. FNV-1a
  hashes it into Mulberry32; RNG version `mulberry32-v1` and 32-bit state are
  serialized. Core never uses `Math.random` for execution. Simulation time is
  integer tick × fixed 100 ms; wall time is lifecycle metadata only.
- Persisted versions: Core `core-v0.1`, input snapshot `1`, state `1`, result
  `1`, RNG `mulberry32-v1`, config `1`, plus module ID/version. State stores
  tick/time, RNG, global/participant states and validated module state as
  serializable JSON. Incompatible module versions are rejected.
- Actions/events have increasing per-run sequence, tick, type, stable run
  participant actor/target IDs, payload schema version and validated module
  payload. Events include simulated time. A module rule callback returns next
  state and ordered events for each action. Bounded serialization limits output.
  Results use a generic versioned type/summary/metrics/module-payload envelope.
- CREATED → RUNNING ↔ PAUSED, with permitted transitions to COMPLETED, FAILED
  or CANCELLED. Terminal states cannot resume. Pause/resume preserves state and
  RNG. Each tick atomically commits state, actions, events and result. A module
  exception or invalid/oversized output rolls back its tick and marks the Run
  FAILED with a safe code/message; prior history survives. Compare-and-set
  updates protect transitions and ticks from concurrent changes. Headless
  advancement is bounded per batch and reusable by future workers.
- Replay preparation consists of immutable inputs, recorded versions, ordered
  action/event history, fixed clock and serializable RNG/state. There is no
  full replay API, worker or distributed queue in v0.1.

### Services, API, permissions and UI

- `simulation-run-snapshot-service.ts` builds input in the create transaction.
  `simulation-run-service.ts` owns creation, list/detail, lifecycle, bounded
  advancement, headless completion helper and cursor-paged action/event queries.
  API clients cannot submit state, events or results.
- Routes: `GET/POST /api/simulations/[simulationId]/runs`,
  `GET /api/simulation-runs/[runId]`, `GET .../actions`, `GET .../events`,
  `POST .../start`, `.../pause`, `.../resume`, `.../cancel`, `.../advance`.
  Advance accepts only a validated tick bound. Routes use the existing
  `requireApiContext` → service → response convention.
- Reads require workspace membership and `simulation.view`; run creation and
  lifecycle/advance require `simulation.run`. The central role map grants run
  to OWNER, ADMIN, CREATOR and OPERATOR. VIEWER can read but cannot run.
  Source/run lookups are workspace-scoped with safe NotFound for foreign IDs.
  Audit records created, started, paused, resumed, completed, failed, cancelled.
- Simulation detail separates configuration readiness from mode execution
  availability, shows a clear unsupported message and read-only run history.
  A generic Run detail page shows status, snapshot participants, seed, tick,
  time, result and cursor-paged events. Existing surfaces no longer promise
  that execution arrives in Phase 3. No fake run button appears for unsupported
  production modes.

### Verification (2026-09-18)

- `npx vitest run`: **167 passed, 12 files**, directly from normal repo state;
  all **146 Phase 0–2 baseline tests** remain. New tests cover same/different
  seed output, RNG continuation, deterministic actions/events/results, clock,
  lifecycle, snapshots after Entity edits/deletion, source deletion safety,
  pause/resume equivalence, failure rollback including oversized output,
  cursor paging, concurrent starts, permissions and workspace isolation.
- `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`, `npx next build`
  and `git diff --check`: all exit 0.
- Manual browser QA: Next dev/Turbopack on port 3020 and authenticated
  headless Chrome loaded Dashboard, Projects, Entities, Simulations and a READY
  Simulation detail. API creation of two Entities, a Project and a Simulation,
  plus READY transition, worked. Production Battle run creation returned HTTP
  409 with the unsupported message and created zero runs. A temporary visual
  Run record exercised history/detail, snapshot, result and event rendering at
  desktop and 390 px mobile sizes; it was deleted. Screenshots showed usable
  mobile layouts; Chrome reported no page exceptions. The three disposable QA
  users/workspaces were removed afterward.

## Files in this uncommitted change

**Created:** `src/lib/engine/{constants,clock,rng,schemas,module,registry,engine}.ts`,
`src/lib/engine/engine.test.ts`,
`src/server/services/simulation-run-{snapshot-service,service}.ts`,
`src/server/services/simulation-run-service.test.ts`,
`test/fixtures/deterministic-engine-module.ts`,
`src/app/api/simulations/[simulationId]/runs/route.ts`,
`src/app/api/simulation-runs/[runId]/{route,actions/route,events/route,start/route,pause/route,resume/route,cancel/route,advance/route}.ts`,
`src/app/(platform)/simulations/[simulationId]/runs/[runId]/page.tsx`.

**Modified (tracked):** `prisma/schema.prisma`, this document,
`test/helpers/db.ts`, `src/server/services/{audit,project,simulation,simulation-validation}-service.ts`,
`src/lib/simulations/{constants,modes,seed}.ts`, `src/lib/validation/schemas.ts`,
`src/components/simulations/{simulation-actions,simulation-builder,simulation-card}.tsx`,
`src/app/(platform)/create/page.tsx`,
`src/app/(platform)/projects/[projectId]/page.tsx`,
`src/app/(platform)/simulations/{page,new/page,[simulationId]/page,[simulationId]/edit/page}.tsx`,
`src/app/api/simulations/[simulationId]/ready/route.ts`.

The local `AGENTS.md` phase guidance was aligned with this status. That file is
ignored by `.gitignore` and therefore does not appear in `git status` or the
uncommitted diff; this tracked document is the durable handoff.

## Known limits

- No production module is registered; all current modes reject run creation.
  The deterministic numeric executor is test-only and never imported by
  production. Future modules must explicitly register and preserve historical
  versions if replay is needed.
- Run UI is read-only while no production modes execute. Job scheduling,
  workers, full replay, visualization, media output and product mechanics are
  future work. Service run lists are paged; the simple UI shows the first page.
  Events/actions use cursor pagination.
- No Organization migration, AI Assistant, Marketplace, Creator/Media, Video
  Studio, Animation Studio, collaboration, Battle, Racing, Tournament,
  Survival or other product mechanics were implemented in Phase 3.
- TypeScript 7 is the authoritative type check; typescript-eslint does not yet
  support typed lint for it. `next dev` may rewrite only the marked Next.js
  section of `AGENTS.md`; project guidance is outside that marker.

## Checkpoint (Claude ↔ Codex handoff)

```text
LAST COMPLETED:
  Phase 3 Core Engine v0.1 implementation and automated/manual verification.
  Clean 0509ce4 baseline had 146 tests; current uncommitted tree has 167 green.
  Local dev Prisma schema applied with db push; no migration file added.

CURRENTLY WORKING ON:
  None. Awaiting review/approval of complete uncommitted Phase 3 diff.

NOT YET COMPLETED:
  Phase 3 commit (explicit approval required). Production mechanics modules,
  worker orchestration, full replay and Creator/Media are future phases.

NEXT STEP:
  Review the Phase 3 diff. If approved, commit at the requested checkpoint.
  Add a production mechanics module only under separately approved scope.

DO NOT:
  Commit automatically. Do not register fake Battle/Race/Tournament/Survival
  modules, hardcode Anything Wars, migrate Organizations, or build Creator/Media
  or other deferred systems as part of this checkpoint.
```
