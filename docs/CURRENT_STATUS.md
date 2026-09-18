# SIMVERSE — Current Status

> Canonical Claude ↔ Codex handoff. The repository is authoritative. Long-form
> vision: [vision/VISION.md](vision/VISION.md). Local rules: [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0.
- **Phase:** Phase 5 — **Real-Time 3D Viewer Foundation v1** is the next
  implementation phase. This docs-only direction correction is awaiting review;
  do not begin implementation from this document alone.
- **Repository checkpoint:** clean `master` at `2421c2d` (`feat: add SIMVERSE
  Visual Simulation Viewer v1`). Phase 4 Battle v1 is committed at `d9be027`.
  The last recorded full test run at the checkpoint passed 190 tests in 15 files.
- **Last updated:** 2026-09-18.
- **Commit status:** The earlier Canvas 2D viewer scaffold is committed. This
  visual architecture correction is documentation-only and uncommitted.
- **Execution boundary:** Battle remains the only production mechanics module.
  The Viewer is downstream presentation of authoritative Core/Module outcomes.
  Real-time 3D refers to browser rendering, not a claim of live Run streaming.

## Official architecture

SIMVERSE is a simulation, creation and content platform, not a single game.
Its five pillars are:

1. **PLATFORM:** Identity, Organizations, Workspaces, Memberships, Permissions,
   Storage, Collaboration, AI Assistant, Marketplace, Billing, Audit/Governance.
2. **CORE:** Entities, Simulation Definitions and Runs, State, Time/ticks,
   seeded RNG, Actions, Rules foundation, Events, Results, Replay foundation.
3. **SIMULATION MODULES:** reusable mechanics packages such as Battle, Racing,
   Tournament, Survival, Economy, Agriculture, Sports and Civilization.
4. **CREATOR / MEDIA PLATFORM:** Real-Time 3D Viewer, Visual Asset System,
   Standard Animation System, Camera, Lighting, VFX and Sound presentation
   systems, Asset Library, Animation Studio, Video Studio, Caption Studio,
   Audio/Voice, Image/Graphics, Rendering, Export, Compression and content tools.
5. **PRODUCTS:** Anything Wars, Robot Arena, Farm Empire, Civilization,
   Sports Lab and future products.

Creator/Media is not a Simulation Module. AI Assistant, Marketplace,
Collaboration, Storage and Billing are Platform systems. Anything Wars is one
Product, never Core itself. Animation Studio remains an official standalone
Creator/Media capability; Phase 5 does not implement it. Future ownership is
Account → Organization → Workspace → resources; no workspace migration yet.
SIMVERSE's database remains primary; external cloud is backup/export/sync only.

## Official corrected visual direction

The previous Canvas 2D / 2.5D Viewer direction is superseded as the primary
destination. SIMVERSE's target is **premium real-time 3D, game-like simulation
playback**: a full-screen-capable spatial scene with original environments,
visible 3D entities, movement, a perspective camera, lighting and shadows,
professional animation, VFX, sound, a premium HUD, and cinematic introductions
and outcomes. Image and 2D representations remain useful fallbacks; they do not
define the default premium experience. The owner's uploaded gaming images set
the **quality class and presentation direction**, not assets to copy. Use
original SIMVERSE branding, UI, environments, models, characters and logos;
do not copy proprietary game assets or exact branded scenes.

The intended journey is Create → Configure → Run & Watch → real-time 3D
visualization of saved simulation truth → cinematic outcome → Replay → future
Edit/Export. For Lion vs Tiger, the eventual scene should show 3D animals,
positioning, movement, attacks, dodges, hit reactions, health, elimination and
the true winner. Core and Battle still decide all outcomes; the Viewer only
presents the persisted events/result.

Entities have separate **simulation data** (attributes, metadata, behavior
inputs) and **visual identity** (portrait/image fallback, 3D model, materials,
scale, orientation, archetype, rig/skeleton, animation profile and later sound/
VFX profiles). Planned archetypes are HUMANOID, QUADRUPED, CREATURE, ROBOT,
VEHICLE_GROUND, VEHICLE_AIR, VEHICLE_WATER, OBJECT, ABSTRACT and CUSTOM. Phase 5
needs model-loading and procedural 3D fallback foundations; Phase 6 formalizes
asset assignment/import, archetypes, rigs, animation profiles, model validation
and reusable standard animation sets. No automatic production-quality model
generation from an Entity name is required in Phase 5.

The reusable **Standard Animation System** must support clips, state machines,
transitions, crossfades/blending, looping/non-looping states, interruption and
completion rules, fallback animations and event-to-animation mapping. Its state
vocabulary includes IDLE, WALK, RUN, TURN, ATTACK, DEFEND, DODGE, HIT/REACTION,
DEFEATED/ELIMINATED, VICTORY and INTRO. Phase 5 establishes an animation-
controller foundation; Phase 6 develops the formal asset and standard animation
system. Crude transform-only motion is not the permanent architecture.

Animation Studio remains a separate future professional creator tool. The
Viewer automatically presents SimulationRun truth; Animation Studio lets a
creator direct scenes, including standalone work unrelated to a Run. They may
share models, rigs, clips, environments, camera primitives, VFX and audio.
Neither system replaces Core or Simulation Modules.

### Revised visual roadmap

1. **Phase 5:** Real-Time 3D Viewer Foundation v1 — browser 3D renderer,
   generic Viewer Core and adapters, Battle adapter, Watch/Run & Watch, original
   SIMVERSE Arena, model-loading and procedural fallback foundations, animation
   controller, camera, lighting, VFX and sound foundations, HUD, controls and
   fullscreen.
2. **Phase 6:** Entity Visual Asset + Standard Animation System.
3. **Phase 7:** 3D Environments / Worlds.
4. **Phase 8:** Cinematic Camera + Lighting + VFX + Sound.
5. **Phase 9:** Animation Studio / Video Studio preparation.

Later work may include AI Director, advanced cinematic rendering, Animation
Studio, Video Studio and the media export pipeline. This sequence supersedes
any roadmap that defines Phase 5 primarily as a Canvas 2D Viewer.

## Committed baseline before corrected Phase 5

- **Phases 0–2:** Platform foundation, Entities, Projects and Simulation Builder.
  READY means configuration validity, independent of execution support.
- **Phase 3** (`5fd60ff`): immutable SimulationRun and participant snapshots,
  Core actions/events/results, fixed 100 ms ticks, seeded RNG, module hooks,
  atomic persistence, lifecycle, bounded execution, permissions, audit,
  paginated events and generic Run detail.
- **Phase 4** (`d9be027`): category and product agnostic Battle v1 (`battle`,
  `battle-v1`) is the only registered execution module. Duel and free for all
  consume frozen snapshot stats, apply seeded turn selection, attacks, dodge,
  critical, defend, damage and elimination, then persist structured ordered
  events and a ranked result. Team Battle remains configuration only. The
  existing Core run services and endpoints are authoritative. The Phase 4 Run
  detail retains metrics and the cursor-paged event feed. Its 184 tests passed.
- **Earlier viewer scaffold** (`2421c2d`): a Canvas 2D replay, generic cue and
  adapter concepts, Battle event mapping, Watch/Run & Watch routes, controls
  and QA were committed before the visual direction was corrected. The code
  remains in the repository as a functional baseline, not the accepted
  premium/default Phase 5 destination. The new Phase 5 prompt will govern how
  it is replaced or extended toward real browser 3D.

## Existing Canvas 2D viewer scaffold — factual implementation record

This section records what `2421c2d` contains; it does not define the current
Phase 5 target. The corrected 3D direction and roadmap above are authoritative.

### Architecture and source of truth

- `src/lib/viewer/` defines a generic `SimulationViewerAdapter`, normalized
  `VisualEntityInstance`, `VisualSource`, `ViewerCue`, `ViewerMoment`,
  `ViewerTimeline`, `ViewerFrame`, presentation clock and renderer boundary.
  `ViewerAdapterRegistry` registers only `battle/battle-v1`. Unsupported module
  versions show an honest unavailable message. The Viewer never imports Battle
  mechanics or decides damage, dodge, elimination, winner or ranking.
- The Battle adapter validates the versioned persisted event stream, participant
  IDs, sequence/tick/time order, saved Battle result and final participant
  health/elimination consistency. Invalid or unsupported history displays a
  safe replay error without changing the Run. Events for one Core tick form one
  visual moment; `attack → critical/dodge → damage → elimination → completion`
  cues retain persisted order. Visual times are derived from ordered ticks;
  simulated timestamps remain in cues. Seeking reconstructs visual state from
  events. The browser clock only controls presentation at 0.5×, 1×, 1.5× or 2×.
- `Canvas2DViewerRenderer` implements the replaceable `ViewerRenderer`
  boundary. One requestAnimationFrame loop runs only during playback; React HUD
  state updates at about 10 Hz or on a control action. Deterministic camera
  focus, pan, fit, restrained zoom and bounded impact shake follow the active
  event. No `Math.random`, database write or mechanics recalculation is used.
- Frozen `RunParticipant` snapshots supply name, short name, category, image
  URL and colors. HTTP(S) and allowed inline data images preload with a 3.5 s
  timeout. Missing, unsupported or broken images use a colored initials avatar.
  Later live Entity edits do not alter old Run visuals. `VisualSource` currently
  supports IMAGE and FALLBACK; its type can grow to sprite/model sources later.
- Duel entities face each other. FFA uses deterministic radial placement by
  participant position. Both use an honestly generic SIMVERSE Arena, not a
  fabricated World. A short intro can be skipped. The renderer visibly moves
  attackers, dodges targets, shows guard, hit/critical feedback, damage numbers,
  knockback, defeat and winner or time-limit presentation. Participant health
  and final standings remain available as text, including completion reason.

### Route, controls and security

- Authenticated `/simulations/[simulationId]/runs/[runId]/watch` loads a saved
  Run through `getSimulationRun`, which enforces `simulation.view`, active
  workspace and safe NotFound. The route also verifies the simulation ID and
  requires a completed result. Client event pages use the existing authorized
  `/api/simulation-runs/[runId]/events?after=&limit=100` API until the saved
  event count is loaded. Refresh and Replay never create a Run. Loading and
  route error states are explicit.
- Completed Battle Run detail links to **Watch Replay**; the Viewer links to
  **View Results**. READY Battle detail makes **Run & Watch** primary and keeps
  **Run Battle** for nonvisual operation. A synchronous click guard permits one
  create/start/advance flow through existing server APIs; navigation to Watch
  happens only after completion. Errors retain a saved Run recovery link.
- Controls: play/pause, restart, deterministic scrub/previous/next moment,
  0.5×/1×/1.5×/2×, Skip Intro, fullscreen, keyboard Space/R/←/→/M, mute and
  volume. Short original browser-synth tones start only after an audio gesture;
  autoplay restrictions leave silent playback functional. The Viewer respects
  reduced motion by minimizing entity travel/tilt and removing camera zoom/
  shake; text, health and result do not depend on motion. RAF, image listeners/
  timers, resize/keyboard/fullscreen
  listeners and AudioContext are released on unmount.

## Prior scaffold verification (2026-09-18)

- Direct `npx vitest run`: **190 passed, 15 files**. All 184 Phase 0–4 tests
  remain. Six new tests cover the registry, snapshot visuals/fallback, duel/FFA
  layout, real Battle event grouping, exact final health and ranking, timeout,
  corrupt/out-of-order events, repeatable seek/reset and clock speed/pause.
- `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`, `npx next build`
  and `git diff --check`: passed. Production build generated the Watch route.
- Authenticated headless Chrome QA used `npx next start` on port 3020 against
  disposable `prisma/phase5-qa.db`, never `dev.db` or `test.db`. Lion vs Tiger
  used illustrated inline image URLs and the specified 90/72/82/60/65 and
  87/70/88/63/70 stats. Chrome clicked **Run & Watch**; exactly one Run was
  created. Screenshots showed the intro, both historical images, attack lunge,
  health drop, knockout and saved winner. Pause held position, Restart reset,
  replay refresh created no Run, and changing the live Lion image did not
  change the old Run snapshot. Nigeria/Ghana, Titan X/Thunder Beast, four
  country FFA, a two-tick time-limit Run and a broken image URL all loaded;
  the broken image displayed initials. FFA final winner and time-limit result
  were visually inspected. Foreign workspace event API and Watch URL returned
  safe 404. At 390, 768, 1024 and 1440 px plus 844×390 landscape, Chrome found
  expected participant HUDs and no horizontal overflow. A separate isolated
  Chrome check measured about 533/1050/2108 ms of timeline progress over about
  1.05 s at 0.5×/1×/2×; event count and result remained unchanged. A real
  pointer-triggered fullscreen entered successfully. QA images, scripts,
  browser profiles and databases were removed after inspection.

## Files in committed viewer scaffold (`2421c2d`)

**Created:** `src/lib/viewer/{types,scene,clock,registry,battle-adapter,canvas-renderer}.ts`,
`src/lib/viewer/viewer.test.ts`, `src/components/viewer/simulation-viewer.tsx`,
`src/app/(platform)/simulations/[simulationId]/runs/[runId]/watch/{page,loading,error}.tsx`.

**Modified:** `src/components/battle/battle-run-controls.tsx`,
`src/app/(platform)/simulations/[simulationId]/runs/[runId]/page.tsx`, and this
document at that checkpoint. No Prisma schema/migration change or dependency
was added by the scaffold. The current visual correction changes only tracked
documentation: `docs/CURRENT_STATUS.md`, `docs/vision/VISION.md` and
`docs/vision/REFERENCE_INDEX.md`.

## Known limits and next boundary

- Playback completes server-side first, then animates saved history; it is not
  live streaming. Images remain URL references in historical snapshots, so an
  unavailable remote image falls back to initials. The committed Canvas view is
  a scaffold; real-time browser 3D is the corrected Phase 5 objective. Public
  sharing, full World scenes, video export and advanced cinematics are later
  phases. Battle
  remains the only supported Viewer adapter. Team Battle and Race, Tournament,
  Survival, Economy, Agriculture, Sports and Civilization mechanics are not
  implemented. No Battle mechanics were changed in the earlier scaffold.
- Viewer timelines currently prefetch all authorized pages before playback;
  this is suitable for Battle v1's 160-tick cap. Larger future histories may
  need streaming/paged timeline windows. The simple synthesized audio is muted
  by default; browsers can still restrict sound until a user gesture. Headless
  Chrome blocked fullscreen activation from a programmatic DOM click but
  accepted a real pointer event; the control catches browser rejection and
  leaves normal playback working. Audio was not audibly evaluated by automation.
- TypeScript 7 remains authoritative; typescript-eslint does not yet support
  typed lint for it. The ignored local `AGENTS.md` is stale and must not be
  force-added. This tracked document is the durable phase handoff.

```text
LAST COMPLETED:
  Phase 4 Battle Module v1 and earlier Canvas 2D viewer scaffold are committed.
  The last recorded full run at 2421c2d passed 190 tests.

CURRENTLY WORKING ON:
  Docs-only correction of SIMVERSE's official visual direction, awaiting review.

NOT YET COMPLETED:
  This docs correction's review/commit; corrected Phase 5 Real-Time 3D Viewer
  Foundation v1 implementation; Phase 6+ visual systems.

NEXT STEP:
  Review/approve this docs-only correction, then commit it only with explicit
  approval. Await the full corrected Phase 5 implementation prompt.

DO NOT:
  Commit automatically or begin corrected Phase 5 from this correction alone.
  Do not implement Phase 6, Race mechanics, Animation Studio, Video Studio,
  Organizations or product-specific mechanics now.
```
