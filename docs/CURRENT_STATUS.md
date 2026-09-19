# SIMVERSE — Current Status

> Canonical Claude ↔ Codex handoff. The repository is authoritative. Long-form
> vision: [vision/VISION.md](vision/VISION.md). Local rules: [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0.
- **Current work:** Phase 6.5 — High-Fidelity Game Runtime Architecture is being
  documented in the working tree. This is architecture/feasibility work only;
  **do not commit without approval**. Phase 7 implementation has not started.
- **Committed checkpoint:** `b08df45` (`feat: add SIMVERSE entity visuals and
  animation system`), after Phase 5 `22a7560` and Phase 4 `d9be027`. The working
  tree was clean before Phase 6.5 began.
- **Last updated:** 2026-09-19.
- **Boundary:** Battle remains the only production mechanics module. Core and
  Modules remain authoritative. Three.js is now formally the Web Preview Viewer;
  no Unreal project, Runtime Protocol code, World code or Phase 7 code exists.

## Official architecture and visual direction

SIMVERSE has five pillars: **Platform**, **Core**, **Simulation Modules**,
**Creator / Media Platform**, and **Products**. Creator/Media is not a Simulation
Module. AI Assistant, Marketplace, Collaboration, Storage and Billing are
Platform systems. Anything Wars is a Product. Animation Studio remains a
separate official Creator/Media capability that must eventually support
standalone creation; it is not implemented here.

The visual target is premium, full-screen-capable, real-time 3D simulation
playback through a native runtime and, later, browser streaming. Uploaded gaming
references establish a quality class and presentation direction only. SIMVERSE
uses original branding and assets.

### Revised runtime roadmap

1. **Phase 5:** Web 3D Viewer Foundation — committed in `22a7560`.
2. **Phase 6:** Entity Visual Assets + Standard Animation — committed in
   `b08df45`.
3. **Phase 6.5:** High-Fidelity Runtime architecture and feasibility — current
   documentation review.
4. **Phase 7A:** Runtime Protocol v1 + separate Unreal bootstrap.
5. **Phase 7B:** High-Fidelity Character Pipeline.
6. **Phase 7C:** Lion vs Tiger Savannah proof.
7. **Phase 8:** reusable World Runtime.
8. **Phase 9:** reusable cinematic presentation systems.
9. **Later:** additional archetypes, native/cloud delivery at scale, live
   streams, Animation Studio, Video Studio and media export.

The previous plan to make general Worlds the immediate Phase 7 task is
superseded. Phase 7A is the exact next recommended implementation phase, subject
to approval after Phase 6.5 review.

## Phase 6.5 high-fidelity runtime decision

The premium visual destination is a separate **SIMVERSE High-Fidelity Experience
Runtime**, with **Unreal Engine 5** recommended for its first implementation.
The existing Three.js implementation remains the **SIMVERSE Web Preview Viewer**
for instant previews, fallback playback, low-resource devices, creator/editor
preview and debugging.

The detailed decision is in
[architecture/HIGH_FIDELITY_RUNTIME.md](architecture/HIGH_FIDELITY_RUNTIME.md).
The conceptual engine-neutral package and event boundary is in
[architecture/RUNTIME_PROTOCOL.md](architecture/RUNTIME_PROTOCOL.md).

### Responsibilities

- **Next.js Platform:** accounts, authentication, workspaces, permissions,
  Entities, Projects, Simulation Builder, asset/World metadata, launch UI,
  history/results, collaboration/marketplace later.
- **Core and Modules:** actions, state, targets, RNG, damage, eliminations,
  ordered events, rankings and results.
- **Runtime Protocol:** versioned projection of a completed Run, participant and
  visual snapshots, immutable asset/World bindings, ordered events, result and
  presentation metadata.
- **Three.js Web Preview:** lightweight/fallback/debug consumer.
- **Unreal High-Fidelity Runtime:** downstream premium consumer responsible for
  world loading, characters, animation, camera, VFX, audio, HUD and presentation
  physics without deciding simulation facts.

### Engine feasibility

- Unreal provides the most direct integrated path for large worlds,
  high-fidelity lighting/rendering, skeletal animation, Animation Blueprints,
  IK/Control Rig, Chaos, Niagara, MetaSounds, Sequencer, packaged desktop builds
  and Pixel Streaming browser delivery.
- Unity 6 remains a viable C#/cross-platform alternative. Godot 4 is the
  strongest open-source alternative. Both would require a different balance of
  custom high-end runtime, content and streaming work.
- Licensing, runtime distribution and cloud-stream classification must be
  reviewed before commercial release. Current official terms and verified
  primary links are recorded in the architecture document.

### Repository and delivery decision

- When approved, create a separate private `SIMVERSE-RUNTIME` Unreal repository.
  Do not place Unreal caches, builds or giant binary-content directories in this
  Next.js repository.
- Use Git + Git LFS/locks initially for a small team and evaluate Perforce as the
  binary content team grows. Store cooked builds outside Git.
- Start with a local developer runtime consuming a sanitized completed Run
  fixture, then a packaged desktop runtime. Pilot Pixel Streaming only after the
  runtime/protocol boundary and measured unit economics are stable.

## Committed Phase 6 foundation

### Persistent Entity visual profiles

- `EntityVisualProfile` is an optional one-to-one record owned by an `Entity`.
  It stores source type, portrait/model references, archetype, bounded scale,
  XYZ rotation and offset, enabled state, revision, and a compact JSON animation
  map. Visual identity stays separate from simulation identity and mechanics.
- Current source types are `MODEL_3D`, `IMAGE`, and `PROCEDURAL`; future-safe
  vocabulary also recognizes sprite, animated-sprite, and generated-3D sources.
  The Viewer renders managed `MODEL_3D` assets and procedural fallback. HTTPS or
  same-origin `.gltf`/`.glb` model references are accepted; invalid references
  are rejected at the API boundary.
- Archetypes are `HUMANOID`, `QUADRUPED`, `CREATURE`, `ROBOT`,
  `VEHICLE_GROUND`, `VEHICLE_AIR`, `VEHICLE_WATER`, `OBJECT`, `ABSTRACT`, and
  `CUSTOM`. They describe visual behavior without adding module mechanics.
- Read/write/delete operations require authenticated workspace context,
  `entity.view` or `entity.edit`, and a workspace-scoped Entity lookup. Foreign
  IDs use the existing safe NotFound strategy. Updates are audited and increment
  the profile revision. Entity duplication creates an independent copied
  profile; archive/restore preserves it; Entity deletion cascades it.
- Prisma has no migration directory or committed SQL history in this repository.
  Phase 6 therefore follows the existing schema workflow: the Prisma model is
  committed, test setup creates its isolated database with `prisma db push`, and
  local schema synchronization uses the same command. No fabricated partial SQL
  migration was introduced.

### Entity Visuals creator flow

- Each Entity now has a dedicated `/entities/[entityId]/visuals` page, linked
  from its overview and edit pages. The page respects read-only permissions.
- Creators choose source, portrait, model URL, archetype, enabled state, scale,
  orientation, offset, and semantic animation-to-clip mappings.
- The Three.js preview loads the real model, supports orbit/zoom, applies saved
  transforms, switches preview animations, and cleans up its renderer, scene,
  controls, animation mixer, and resources. WebGL or model failures produce an
  actionable fallback instead of crashing the page.
- Inspection reports scene count, mesh/skinned-mesh and skeleton presence,
  bounds, discovered clips, and file size when the remote server supports HEAD.
  The UI warns on large assets and missing mappings. Validation states are
  `READY`, `PARTIAL`, `FALLBACK REQUIRED`, and `INVALID`.
- Clip suggestions use conservative normalized-name matching and never persist
  until the creator saves. Dropdowns expose only clips actually found in the
  model. Multiple semantic states may intentionally map to one clip.

### Standard animation system

- Production semantic states are `IDLE`, `WALK`, `RUN`, `TURN`,
  `ATTACK_PRIMARY`, `ATTACK_SECONDARY`, `DEFEND`, `DODGE`, `HIT_LIGHT`,
  `HIT_HEAVY`, `DEFEATED`, `VICTORY`, and `INTRO`. Reserved future states are
  `SPECIAL`, `STUNNED`, `JUMP`, `LAND`, `FLY`, `SWIM`, and `EMOTE`.
- `AnimationController` resolves explicit creator mappings first, then bounded
  aliases. It crossfades over 0.22 seconds. Idle, walk, and run loop; action,
  reaction, intro, defeat, and victory states are one-shots. Completed
  nonterminal one-shots return to idle; defeat remains terminal.
- Terminal states cannot be interrupted. Passive idle does not cut off an
  unfinished one-shot; saved action and reaction cues may interrupt as needed.
  Missing clips retain procedural pose animation and never stop replay.
- Model animation is kept in place by removing only scene-root position tracks.
  Deterministic Viewer choreography owns world movement, so model root motion
  cannot change participant placement or simulation state.

### Run snapshots and historical compatibility

- New Run participant snapshots include optional `visualProfileVersion: 1` and
  a bounded copy of source, model/portrait references, archetype, transforms,
  revision, and animation mappings. Binary asset data is never copied into a
  Run. Disabled or absent profiles snapshot as `null`.
- Playback reads the immutable Run snapshot and never consults the current
  Entity. Editing an Entity after Run creation therefore does not change that
  Run's selected visual metadata. Asset URLs are expected to be immutable;
  future Asset Library records should add stable asset/version IDs.
- The new fields are optional, so Phase 3–5 Runs remain valid. Phase 5
  `metadata.visualProfile` is still read as a compatibility fallback, including
  old `ATTACK` and `HIT` state aliases. Missing or unsupported data uses the
  procedural participant.

### Battle Viewer and asset runtime

- The Viewer prefers a valid managed snapshot model and its saved mappings,
  then the older Phase 5 metadata shape, then procedural 3D. Broken, missing,
  timed-out, disabled, or unsupported assets preserve playback and show a
  fallback warning.
- Each distinct model URL is preloaded and cached once. `SkeletonUtils.clone`
  gives every participant an independent scene, skeleton, mixer, and animation
  controller. Model load timeout remains eight seconds.
- Saved attacks select `ATTACK_PRIMARY`, or deterministically alternate to a
  mapped secondary attack. Saved dodges use `DODGE`; critical damage uses
  `HIT_HEAVY`; other damage uses `HIT_LIGHT`; eliminations and completion use
  `DEFEATED` and `VICTORY`. Reduced dodge translation prevents mapped clip
  movement from looking doubled. No Battle rule, damage, target, RNG, event, or
  result code changed.
- `public/models/simverse-rigged-proxy.gltf` is original SIMVERSE content built
  by `scripts/generate-rigged-viewer-demo-model.mjs`. The 5.24 KiB asset has a
  skinned mesh, skeleton, and idle/run/attack/hit/defeat/victory clips. It proves
  the rigged model path; it is not a finished animal, robot, or production hero.
  The original Phase 5 Sentinel asset remains unchanged.

### Immersive Watch Mode

- Exact Run Watch routes suppress the Platform sidebar and dashboard header.
  The Viewer fills the available browser window and retains a compact HUD,
  playback controls, an explicit **Exit Viewer** action, and browser fullscreen.
- Participant portraits can appear in the intro and health HUD. The mobile
  stage uses the full flexible viewport rather than a fixed short canvas.
- Keyboard controls, text event context, semantic buttons, reduced motion,
  quality controls, and silent playback behavior remain available.

## Verification and QA

- Before Phase 6 edits, direct `npx vitest run` passed **193 tests in 16 files**.
- Phase 6 automated coverage includes VisualProfile validation and suggestions,
  service authorization/isolation/lifecycle, immutable Run snapshots, old-run
  parsing, managed and fallback Viewer selection, rigged glTF parsing and
  independent cloning, animation looping/completion/interruption, semantic
  Battle choreography, and immersive-route matching.
- Final direct `npx vitest run` passed **207 tests in 19 files**, preserving all
  193 Phase 5 baseline tests. `npx tsc --noEmit`, `npx eslint .`,
  `npx prisma validate`, and `npx next build` passed. `git diff --check` passed
  with only Git's expected LF-to-CRLF working-copy notices.
- Manual QA used an isolated disposable database and browser profile. It checked
  a rigged Lion/Tiger duel, `QUADRUPED` mappings and real clip inspection;
  `ROBOT`, `VEHICLE_GROUND`, `ABSTRACT`, and `CUSTOM` profiles; Nigeria/Ghana
  procedural fallback; and the existing Sentinel path. Each isolated scenario
  created exactly its intended completed Run, while Watch reloads created none.
- The immersive Watch route was verified without Platform chrome, with Exit
  Viewer and pointer-triggered fullscreen. Layout checks at 390, 768, 1024, and
  1440 px plus mobile landscape showed no horizontal overflow. The 390 px stage
  was corrected to fill its flexible viewport. The final browser run reported
  no page exceptions.
- A separate four-participant free-for-all rendered two independently cloned
  rigged models with Robot and Car procedural fallbacks. Headless Chrome showed
  all four participants on a 1406 × 632 canvas, no overflow or exceptions, and
  sampled 90 animation frames over 1.536 seconds. This confirms the bounded demo
  scene remains responsive; headless software rendering is not a desktop GPU
  benchmark.
- Disposable QA scripts, database, screenshots, browser profile, traces, and
  logs are removed before review. Ignored test/build outputs are also removed
  after the final command run.

## Known limits

- Phase 6 accepts URL assignment; it does not implement uploads, an Asset
  Library database, CDN, immutable binary hosting, marketplace, optimizer,
  Draco/Meshopt/KTX2 processing, LOD generation, or final production models.
- Remote model inspection depends on CORS, and file-size reporting depends on
  HEAD support. Supported runtime containers are GLTF/GLB. The validation
  summary is deliberately practical rather than a full DCC-grade rig auditor.
- Visual snapshots preserve metadata and URL identity, not the bytes behind a
  mutable URL. Production assets should use content-addressed or versioned URLs
  until Asset Library IDs exist.
- Battle remains the only Viewer adapter. Playback still consumes completed
  saved Runs rather than streaming live simulation.
- No high-fidelity runtime, Runtime Protocol implementation, Unreal project,
  production character pipeline, World runtime, cloud-streaming deployment or
  live event transport exists yet. Animation Studio, Video Studio, new modules,
  and new Battle rules also remain future work.

## Committed Phase 6 checkpoint

- Commit `b08df45` contains the approved **20 modified + 11 created = 31** Phase
  6 files: Entity Visual Profile persistence/UI, semantic animation runtime,
  immutable Run visual snapshots, Viewer integration, immersive Watch Mode,
  tests, original demo asset/generator, and status documentation.
- No disposable QA artifacts were committed. The Prisma changes are limited to
  Entity Visual Profile architecture. Existing Phase 3–5 Runs remain backward
  compatible, and Battle mechanics did not change.
- No package dependency or lockfile changed. Phase 6 uses the Prisma and
  Three.js packages already committed in earlier phases.

## Phase 6.5 working-tree documentation

- **Created:** `docs/architecture/HIGH_FIDELITY_RUNTIME.md` and
  `docs/architecture/RUNTIME_PROTOCOL.md`.
- **Modified:** `docs/CURRENT_STATUS.md` and `docs/vision/VISION.md`.
- **Code impact:** none. No application source, schema, test, dependency,
  runtime project, asset or build file is changed.

```text
LAST COMMITTED:
  b08df45 feat: add SIMVERSE entity visuals and animation system

CURRENTLY WORKING ON:
  Phase 6.5 High-Fidelity Game Runtime Architecture;
  documentation and feasibility only, uncommitted for review.

NOT YET STARTED:
  Runtime Protocol implementation, Unreal project/bootstrap, production
  character pipeline, Savannah proof, World runtime, cloud streaming and Phase 7.

NEXT ACTION:
  Review the Phase 6.5 architecture documents. After an approved docs-only
  checkpoint, begin Phase 7A Runtime Protocol v1 + Unreal Bootstrap only on
  explicit instruction.
```
