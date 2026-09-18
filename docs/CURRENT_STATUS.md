# SIMVERSE — Current Status

> Canonical Claude ↔ Codex handoff. The repository is authoritative. Long-form
> vision: [vision/VISION.md](vision/VISION.md). Local rules: [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0.
- **Phase:** Phase 4 — Battle Module v1 implemented and verified; uncommitted,
  awaiting review. Do not begin Phase 5.
- **Baseline:** clean `master` at `5fd60ff` (`feat: complete SIMVERSE Phase 3 core
  simulation engine`). Direct baseline `npx vitest run` passed 167 tests.
- **Last updated:** 2026-09-18.
- **Commit status:** No Phase 4 staging or commit. Recommended message:
  `feat: add SIMVERSE Battle Module v1`.
- **Execution boundary:** Battle is the only production registered mechanics
  module. Race, Tournament and Survival remain configuration choices without
  execution. The Module Registry and server permissions authorize runs.

## Official architecture and standing constraints

SIMVERSE is a simulation, creation and content platform, not a single game. Its
five pillars are:

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

Creator/Media is not a Simulation Module. AI Assistant, Marketplace,
Collaboration, Storage and Billing are Platform systems. Anything Wars is one
Product, never Core itself. Animation Studio is an official, standalone capable
Creator/Media capability; Phase 4 implements none of it. Future ownership is
Account → Organization → Workspace → resources; do not migrate workspace data
yet. SIMVERSE's DB is primary; external cloud is backup/export/sync only.

## Completed before Phase 4

- Phases 0–2 built Platform, Entities, Projects and the Simulation Builder.
  READY means configuration is valid, independent of module execution support.
- Phase 3 commit `5fd60ff` built immutable SimulationRun snapshots, run
  participants/actions/events, versioned Core state/results, fixed 100 ms ticks,
  seeded `mulberry32-v1` RNG, module hooks/registry, atomic tick persistence,
  lifecycle, bounded headless execution, workspace authorization, audit and
  generic run API/detail. `prisma/schema.prisma` was applied through `db push`.
  Its 167 tests passed at the Phase 4 baseline. No Phase 4 schema change.
- The Phase 3 deterministic numeric module remains test-only. Production did
  not execute any mode until Battle v1 was registered in Phase 4.

## Phase 4 — Battle Module v1

### Mechanics and versions

- `src/lib/modules/battle/` owns a category and product agnostic module with
  ID `battle`, module version `battle-v1`, execution config version 1, module
  state version 1 and module result version 1. The production registry registers
  only Battle. Core still owns RNG, tick/order envelopes, lifecycle,
  persistence, snapshots, permissions and the generic result envelope.
- Existing Phase 2 Battle config is interpreted without migration. `duel`
  requires exactly two participants; `free_for_all` requires at least two.
  `team` remains saveable as configuration but returns a typed, safe validation
  error on execution because team relationships are not yet modeled. Creation
  validates READY, mode, snapshot, version, format and cardinality server-side.
- Stat resolver reads frozen Entity attribute **keys** (`strength`, `defense`,
  `speed`, `intelligence`, `luck`) from the Run snapshot. Missing stats default
  to 50; valid numeric values are rounded and clamped to 0–100. Duplicate,
  nonnumeric and wrong-type standard attributes reject execution. No live
  Entity read or mutation occurs during execution.
- Each participant starts at 100/100 health. Module state stores the resolved
  profile, health/alive/defending flags, elimination tick, ordered turn queue,
  round, completion reason and counters for damage dealt/received, attacks
  attempted/landed, critical hits, dodges and defends. Only one actor takes an
  action per Core tick; at most one elimination can happen in a tick. Eliminated
  participants are removed from the queue and never act again.
- Initiative each round is Speed + seeded integer jitter 0–10, descending;
  participant position breaks ties. Rule-driven action selection may defend;
  the chance is `0.015 + 0.0005 × Intelligence`, or
  `0.12 + 0.002 × Intelligence` at 40 health or less. Otherwise the actor
  attacks. In FFA, living target score weights missing health by
  `0.15 + Intelligence/250`, plus target damage threat × 0.1 and seeded jitter
  0–10; position breaks ties. A guard costs the action and halves one landed
  hit, then ends; it also expires at the defender's next action.
- Attack base damage is `round(5 + 0.18 × Strength + 0.04 × Intelligence −
  0.08 × target Defense + seeded jitter [-2,2])`, clamped to 2–28. Dodge chance
  is `clamp(0.04 + 0.0015 × (defender Speed − attacker Speed) + 0.0004 ×
  defender Luck, 0.02, 0.22)`. Critical chance is
  `clamp(0.03 + 0.001 × attacker Luck + 0.00025 × attacker Intelligence,
  0.03, 0.16)`; a critical multiplies damage by 1.5, at most 40 before guard.
  Three seeded RNG rolls are consumed per attack, including dodges. Health
  never falls below zero. Core's RNG is the only randomness source.
- `battle.attack` and `battle.defend` are versioned module actions. Structured
  versioned events are `battle.started`, `battle.attack`, `battle.defend`,
  `battle.dodged`, `battle.critical_hit`, `battle.damage`, `battle.eliminated`,
  `battle.timeout` and `battle.completed`. Actor/target Run participant IDs,
  tick, simulated time, ordered sequence and numeric outcomes are persisted.
  Display text is generated from event data; AuditLog remains distinct.
- A knockout ends at one survivor. The configured `roundLimit` is interpreted
  as a tick cap; blank uses 120 and any value above 160 is capped at 160. On
  timeout, completion reason is `TIME_LIMIT`, never a knockout claim. Timeout
  living participants rank by remaining health, then damage dealt, then stable
  position; eliminated participants follow in reverse elimination order. A
  knockout ranks survivor first, then reverse elimination order. If ties are
  allowed and top living health/damage are equal, the result records their IDs
  as a tie. The result includes format, reason, winner/ties, ranking,
  elimination order, ticks, simulated duration and frozen participant metrics.

### Services and UI

- Phase 3 create/start/advance/pause/resume services and APIs are reused. The
  create service maps Battle input errors to safe `ValidationError`s; all
  persisted state/events/results continue through Core. Run creation requires
  `simulation.run`, reads require `simulation.view`, and foreign workspace IDs
  remain hidden. Audit logs cover creation, lifecycle and completion.
- A READY Battle detail shows **Run Battle** only for duel/FFA configurations
  that meet cardinality and for roles with `simulation.run`. The button creates
  a Run, starts it and advances through bounded batches of 40 ticks (at most
  four batches for the 160-tick cap), then opens Run detail. Existing CREATED,
  RUNNING and PAUSED runs can start/continue/resume there; RUNNING can pause.
  If a request fails after creation, the saved Run remains available in history.
- Battle Run detail shows result or current progress, knockout winner or honest
  timeout/tie, ranking, health, damage/hit/critical/dodge/defend counters and a
  readable cursor-paged event feed generated from structured events. Existing
  generic historical Run detail remains available for other module IDs.
- The Mode Catalog now labels configuration and execution separately: Battle
  available/available; Race, Tournament and Survival available/future. This is
  presentation metadata only; the server registry is authoritative. Builder
  copy explains Battle seed, format and tick limit behavior and marks team
  execution as future. No separate Battle engine or new run storage was added.

## Verification (2026-09-18)

- `npx vitest run`: **184 passed, 14 files** directly from normal repository
  state. All 167 Phase 0–3 baseline tests remain. New pure tests cover stat
  defaults/clamping/rejection, duel/FFA, team/cardinality rejection,
  initiative, target/action choices, stat influence, bounded damage, guard,
  dodge, critical, knockout/elimination, timeout/tie, same/different seed,
  invalid target/state and registry. New database tests cover real Battle
  persistence, frozen source edits/deletion, FFA, audit, deletion protection,
  pause/resume, permissions and workspace isolation. Vitest uses only its
  automatically prepared isolated `test.db`.
- `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`, `npx next build`
  and `git diff --check`: exit 0. Production Turbopack build generated routes.
- Manual browser QA used Next dev/Turbopack on port 3020 with a **disposable
  `phase4-qa.db`**, never `dev.db` or `test.db`. Authenticated headless Chrome
  clicked Run Battle for Nigeria/Ghana (14 ticks, 30 events, Nigeria knockout),
  Atlas Robot/Ember Mage (14 ticks, Atlas knockout) and mixed 3-way FFA
  (19 ticks, three ranked, Nigeria knockout). A second country run with the
  same seed and source state matched after mapping distinct generated Run
  participant IDs by position. Team detail showed its unsupported message and
  no run button. Race detail had no run button; server creation returned 409.
  Battle result and events were visible. At 390 px mobile width, document width
  was 390 px, result/events remained present, and Chrome reported no page
  exceptions. The disposable QA database, script and screenshot were removed
  after inspection.

## Files in this uncommitted Phase 4 change

**Created:** `src/lib/modules/battle/{config,stats,schemas,rules,battle-module}.ts`,
`src/lib/modules/battle/battle-module.test.ts`,
`src/server/services/battle-run-service.test.ts`,
`src/components/battle/{battle-run-controls,battle-run-summary}.tsx`.

**Modified:** `src/lib/engine/{module,registry}.ts`,
`src/server/services/{simulation-run-service,simulation-run-service.test}.ts`,
`src/lib/simulations/{config,modes}.ts`,
`src/components/simulations/{entity-picker,mode-card,simulation-builder}.tsx`,
`src/app/(platform)/simulations/[simulationId]/page.tsx`,
`src/app/(platform)/simulations/[simulationId]/runs/[runId]/page.tsx`,
and this document. No Prisma schema/migration changes.

The ignored local `AGENTS.md` may still describe Phase 2/3; do not force-add
it. This tracked document is the durable phase handoff.

## Known limits and next boundary

- Team Battle has no execution semantics. Very large FFA fights may reach the
  160-tick cap before every participant acts; the timeout result is explicit.
  Battle v1 has no equipment, human tactical controls, queues, full replay UI,
  tournament integration or cinematic visualization. The generic settings
  `speed`, `difficulty` and `randomEvents` do not modify Battle v1 mechanics.
- Race, Tournament, Survival, Economy, Agriculture, Sports and Civilization
  mechanics remain future work. No Viewer, AI commentary/Director,
  Creator/Media, Organization, Marketplace or Anything Wars product code was
  added. TypeScript 7 is authoritative; typescript-eslint does not yet support
  typed lint for it.
- **Next action:** review this complete uncommitted Phase 4 diff and its QA
  evidence. If approved, commit a Phase 4 checkpoint. Do not start the next
  phase until separately authorized.

```text
LAST COMPLETED:
  Phase 4 Battle Module v1 and automated/browser verification.
  184 tests pass; all 167 Phase 0–3 baseline tests remain.

CURRENTLY WORKING ON:
  None. Awaiting review of the complete uncommitted Phase 4 change.

NOT YET COMPLETED:
  Phase 4 review and commit. All other mechanics modules and downstream systems.

NEXT STEP:
  Review uncommitted Phase 4 diff; await explicit approval before commit or
  next-phase implementation.

DO NOT:
  Commit automatically. Do not implement Phase 5, Viewer, Race, Tournament,
  Survival, Creator/Media, Organizations or product-specific mechanics now.
```
