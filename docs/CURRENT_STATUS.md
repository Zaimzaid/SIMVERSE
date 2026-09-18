# SIMVERSE — Current Status

> Canonical Claude ↔ Codex handoff. The repository is authoritative. Long-form
> vision: [vision/VISION.md](vision/VISION.md). Local rules: [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0.
- **Current work:** Phase 5 — Real-Time 3D Viewer Foundation v1, implemented in
  the working tree for review. **Do not commit without approval.** Phase 6 has
  not started.
- **Committed checkpoint:** `25864f1` (`docs: establish SIMVERSE real-time 3D
  visual direction`), following the earlier Viewer scaffold `2421c2d` and
  Phase 4 Battle `d9be027`. The working tree was clean before this Phase 5 work.
- **Last updated:** 2026-09-18.
- **Boundary:** Battle remains the only production mechanics module. The Viewer
  animates completed, saved Core events and never decides or changes outcomes.
  Real-time 3D means browser rendering, not live simulation streaming.

## Official architecture and visual direction

SIMVERSE is a simulation, creation and content platform with five pillars:

1. **PLATFORM:** Identity, Organizations, Workspaces, Memberships, Permissions,
   Storage, Collaboration, AI Assistant, Marketplace, Billing and governance.
2. **CORE:** Entities, Simulation Definitions/Runs, State, ticks/time, seeded RNG,
   Actions, Rules foundation, Events, Results and Replay foundation.
3. **SIMULATION MODULES:** reusable mechanics such as Battle, Racing, Tournament,
   Survival, Economy, Agriculture, Sports and Civilization.
4. **CREATOR / MEDIA PLATFORM:** Real-Time 3D Viewer, Visual Assets, Standard
   Animation, Camera/Lighting/VFX/Sound presentation, Asset Library, Animation
   Studio, Video Studio, rendering/export and content tools.
5. **PRODUCTS:** Anything Wars, Robot Arena, Farm Empire, Civilization, Sports
   Lab and future products.

Creator/Media is not a Simulation Module. AI Assistant, Marketplace,
Collaboration, Storage and Billing are Platform systems. Anything Wars is a
Product, not Core. Animation Studio remains a separate official creator system
that must also support standalone work; it is not part of Phase 5. The owner's
gaming references define a **quality class and presentation direction**, not
assets to copy. Use original SIMVERSE branding and assets.

The corrected target is premium, full-screen-capable, real-time browser **3D**
simulation playback with spatial participants, movement, perspective camera,
lighting/shadows, animation, VFX, sound, HUD and cinematic presentation. The
earlier Canvas 2D/2.5D direction is superseded as the primary Viewer. A named
Entity does not automatically imply an accurate production 3D model; Phase 5
shows a deliberate 3D fallback when no such asset exists.

### Visual roadmap

1. **Phase 5:** Real-Time 3D Viewer Foundation v1 (current review).
2. **Phase 6:** Entity Visual Asset + Standard Animation System.
3. **Phase 7:** 3D Environments / Worlds.
4. **Phase 8:** Cinematic Camera + Lighting + VFX + Sound.
5. **Phase 9:** Animation Studio / Video Studio preparation.

## Implemented Phase 5 design

### Renderer and scene

- **One primary renderer: Three.js 0.186.0**, with `@types/three` 0.186.0.
  Direct Three integration fits the existing React client playback clock and
  one controlled requestAnimationFrame loop. `GLTFLoader`, `AnimationMixer`,
  camera, shadows, materials and reusable scene primitives cover this phase;
  the same asset/animation primitives can serve future Worlds and Animation
  Studio. React Three Fiber would add a second render lifecycle around the
  existing clock; Babylon would be a broader engine migration. Neither is
  included. The old Canvas 2D renderer was removed.
- `ThreeViewerRenderer` owns a WebGL renderer, scene, perspective camera,
  resource lifecycle, model preloading, quality settings and drawing. The Watch
  client loads it dynamically after authenticated events are fetched. An
  unavailable WebGL context produces a safe replay error and preserves the
  Results link.
- `ViewerEnvironment` separates environment creation from the Battle adapter.
  `simverseArena` supplies an original chamber floor, holographic rings,
  beacons, a background horizon, fog, fill/key/rim/accent lights and shadows.
  Duel spawns opposite; FFA uses deterministic radial world positions. Camera
  framing is rule based: establishing, actor/target focus, FFA wide framing,
  bounded impact shake and final winner focus. No random camera behavior.
- The 3D motion layer translates saved cues into approach, strike, dodge, hit
  recoil, guard, elimination and victory poses. It never uses collisions or
  physics to decide damage. VFX rings and guard shell are reusable 3D scene
  primitives, triggered only by saved cues. The HUD supplies semantic health,
  category, current action, tick, result and final standings.

### Visual assets and animation

- `EntityVisualProfile` is derived only from the immutable Run participant
  snapshot. `metadata.visualProfile` may contain `modelUrl`, `scale`,
  `orientationDegrees`, `archetype` and `animationProfile`; snapshot image URL
  remains a future portrait source. Phase 5 accepts same-origin root paths or
  HTTPS `.gltf`/`.glb` model URLs. Invalid URLs become procedural 3D. No Entity
  or Prisma schema was changed. Phase 6 owns managed import/assignment and
  rigorous Visual Asset validation. The vocabulary anticipates IMAGE, SPRITE,
  ANIMATED_SPRITE, MODEL_3D, PROCEDURAL_3D and CUSTOM; this renderer supports
  MODEL_3D and PROCEDURAL_3D now.
- `GLTFLoader` preloads each distinct URL once. Cloned scenes allow multiple
  entities to share one asset while keeping independent animation controllers.
  Missing, broken, invalid or timed-out models keep the 3D fallback and show a
  warning without interrupting replay. Bounding-box normalization prevents
  extreme imported sizes; profile scale and orientation are bounded. Geometry,
  materials, textures, mixers and the WebGL context are disposed on unmount.
- `AnimationController` maps semantic IDLE/WALK/RUN/ATTACK/DEFEND/DODGE/HIT/
  DEFEATED/VICTORY states through explicit profile names or common clip aliases.
  It uses Three `AnimationMixer` crossfades, loop/one-shot handling, interruption,
  completion tracking and reset. A missing state clip uses an idle clip plus
  procedural pose fallback. **Root motion contract:** model clips should be
  authored in place; deterministic cue choreography drives world position.
  Models use Three's Y-up, +Z-forward convention; profile orientation adjusts
  imported forward direction. Phase 6 will formalize rigs, clips and profiles.
- The original geometric Sentinel demo at
  `public/models/simverse-sentinel.gltf` is project-authored, generated by
  `scripts/generate-viewer-demo-model.mjs`. It has no external/copyrighted
  source and includes idle, attack and victory clips. Its purpose is to prove
  the model and clip pipeline, not to represent a real animal or finished
  production character. Other entities use colored geometric/holographic 3D
  stand-ins with name and category markers until actual assets are assigned.

### Playback and security

- Generic `SimulationViewerAdapter`, registry, Battle adapter, ordered
  `ViewerTimeline` and `ViewerCue` remain separate from Battle mechanics. The
  Battle adapter validates persisted event payloads, participant IDs, ordering
  and exact final result/health before playback. Same-tick attack, dodge or
  critical, damage and elimination are composed into one visual moment. Invalid
  history shows a safe warning without changing the Run.
- Existing Watch, Watch Replay and Run & Watch routes are reused. Run & Watch
  creates and completes one authorized Core Run, then opens its Watch URL.
  Watch Replay reads the saved Run without creating another. Event pages load
  through the existing authorized cursor API. Run and event access remain
  scoped by active workspace and `simulation.view`; Run creation still requires
  `simulation.run`.
- Play/pause, restart, 0.5×/1×/1.5×/2×, scrub, previous/next moment, intro
  skip, fullscreen and keyboard controls are presentation only. `ViewerAudio`
  provides original synthesized cues after a user gesture with mute/volume;
  browser autoplay refusal leaves silent playback functional. Reduced-motion
  preference suppresses camera shake and limits travel/tilt. AUTO/LOW/MEDIUM/
  HIGH quality caps device pixel ratio and disables shadows on LOW. Responsive
  HUD and textual event/result information remain usable without 3D motion.

## Verification and QA

- Before Phase 5 edits: `npx vitest run` passed **190 tests in 15 files**.
- Final direct `npx vitest run`: **193 passed in 16 files**, including all 190
  baseline tests. `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`,
  `npx next build` and `git diff --check` passed.
- Viewer tests cover registry/version lookup, snapshot VisualProfile safety,
  duel/FFA placement, real Battle event grouping/order/result reconstruction,
  invalid history, motion, clock controls, actual glTF parsing and clip playback.
- Isolated headless Chrome QA uses `phase5-qa.db` only; no development/test DB.
  Lion/Tiger, Nigeria/Ghana, a loaded original Sentinel model versus a broken
  model fallback, and four-participant FFA all displayed real WebGL 3D scenes.
  The original model returned HTTP 200; the broken model returned 404 and
  showed the 3D fallback. Updating the live Sentinel Entity after Run creation
  did not change the historical model reference. Browser JavaScript errors:
  none in the latest completed run.
- QA checked 390, 768, 1024 and 1440 px and mobile landscape without horizontal
  overflow; pause, restart and pointer-triggered fullscreen worked. Scrubbing
  to a saved dodge showed its caption and spatial evade. A final FFA seek showed
  the saved winner and standings. In a comparable 0.8 s browser interval,
  2× reached 1,633 ms and 0.5× reached 412 ms of presentation time. A browser
  click through Run & Watch created exactly one completed Run; replay reload
  kept the count at one. Disposable QA files were removed. Headless software
  rendering is not a reliable desktop FPS benchmark.
- A foreign workspace's event API returned 404. The foreign Watch route showed
  Next's 404 page and no Run identity; Next streamed the page shell with HTTP
  200 before rendering that 404 UI. This status behavior is a known Next route
  limitation to revisit if strict HTTP 404 on streamed pages becomes required.

## Limits and next action

- Playback animates **completed saved history**; it is not live streamed.
  Battle v1 is the only registered Viewer adapter. A real Lion/Tiger model must
  be supplied as an asset; procedural 3D stand-ins do not claim to be zoological
  models. No managed asset upload/preview, full world system, advanced rig
  validation, AI Director, video export, public sharing or Animation Studio is
  in Phase 5. The bounded Battle replay currently fetches all event pages
  before playback; larger future Runs may need timeline windowing.
- No new Battle or Race mechanics, Core simulation changes, Organization work,
  schema changes, Animation Studio or Video Studio were introduced.
- **Next:** review the uncommitted Phase 5 implementation. Commit only after
  the owner's approval. Phase 6 starts only under a later prompt.

## Working-tree files in this Phase 5 review checkpoint

- **Created:** `src/lib/viewer/{animation-controller,audio,choreography,
  environment,fallback-avatar,three-renderer}.ts`,
  `src/lib/viewer/assets.test.ts`,
  `public/models/simverse-sentinel.gltf`,
  `scripts/generate-viewer-demo-model.mjs`.
- **Modified:** `src/lib/viewer/{types,scene,battle-adapter,viewer.test}.ts`,
  `src/components/viewer/simulation-viewer.tsx`, `package.json`,
  `package-lock.json`, this document.
- **Removed:** `src/lib/viewer/canvas-renderer.ts` (superseded 2D primary
  renderer). No Prisma schema or migration changed. Disposable browser QA
  files, profile and database have been removed.

```text
LAST COMMITTED:
  25864f1 docs: establish SIMVERSE real-time 3D visual direction

CURRENTLY WORKING ON:
  Phase 5 Real-Time 3D Viewer Foundation v1, uncommitted review checkpoint.

NOT YET STARTED:
  Phase 6 Visual Assets/Standard Animation system, Phase 7 Worlds,
  Phase 8 advanced cinematics, Phase 9 Animation/Video Studio preparation.

NEXT ACTION:
  Report changed files and limitations, stop for review. Do not commit.
```
