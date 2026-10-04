# SIMVERSE — Current Status

> Canonical Claude ↔ Codex handoff. The repository is authoritative. Long-form
> vision: [vision/VISION.md](vision/VISION.md). Local rules: [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0.
- **Last completed:** Phase 7A-A — Platform Runtime Protocol v1, committed in
  `5687430` (`feat: add SIMVERSE runtime protocol v1`).
- **Current work:** Parallel Platform Track — **Web Phase 1: Asset Library v1**.
  Implementation is complete and uncommitted, awaiting owner review.
- **Paused track:** Phase 7A-B — Unreal Runtime Bootstrap. Unreal work is paused
  because the external D: drive became unstable and Windows reported Disk Event
  51 I/O errors. Do not access D: or run/build the Unreal runtime until storage
  is stable.
- **Committed checkpoint:** `dbfc971`, after Phase 7A-A `5687430`, Phase 6.5
  `a432b7b`, Phase 6
  `b08df45`, Phase 5 `22a7560`, and Phase 4 `d9be027`.
- **Last updated:** 2026-10-04.
- **Boundary:** Battle remains the only production mechanics module. Core and
  Modules remain authoritative. Three.js is the Web Preview Viewer. Platform
  Runtime Protocol v1 transports completed Battle truth; no Unreal project,
  World code or Phase 7B work exists in this Platform repository. Runtime
  Protocol v1 and Battle mechanics are unchanged by the parallel Platform track.

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
3. **Phase 6.5:** High-Fidelity Runtime architecture and feasibility — committed
   in `a432b7b`.
4. **Phase 7A-A:** Platform Runtime Protocol v1 — committed in `5687430`.
5. **Phase 7A-B:** separate Unreal Runtime Bootstrap — paused because its
   external D: storage is unstable.
6. **Phase 7B:** High-Fidelity Character Pipeline.
7. **Phase 7C:** Lion vs Tiger Savannah proof.
8. **Phase 8:** reusable World Runtime.
9. **Phase 9:** reusable cinematic presentation systems.
10. **Later:** additional archetypes, native/cloud delivery at scale, live
   streams, Animation Studio, Video Studio and media export.

The previous plan to make general Worlds the immediate Phase 7 task is
superseded. Phase 7A is split so the engine-neutral Platform contract can be
completed before the local Unreal toolchain becomes available.

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

## Phase 7A-A Platform Runtime Protocol v1

- `src/lib/runtime-protocol/v1.ts` is the sole canonical protocol validator and
  `buildSimulationRuntimePackageV1(...)` builder. It reuses existing Core and
  Battle Zod schemas rather than duplicating mechanics.
- `src/server/services/runtime-package-service.ts` reads a workspace-authorized
  Run, immutable participant rows, every persisted event, and its authoritative
  result through existing service boundaries. It does not read current Entity
  state or mutate/persist anything.
- Protocol version `1.0.0` supports completed Battle `battle-v1` Runs using
  `core-v0.1`, `mulberry32-v1`, input snapshot v1, and result envelope v1.
  Incomplete Runs, missing results, unsupported modules/versions, corrupt
  references/order/payloads, and credential-bearing asset references fail with
  explicit errors.
- Output is stable human-readable JSON with explicit nullable visual/World
  fields. It includes minimized historical participant identity and visual
  snapshots, ordered typed events, exact `BattleResultV1`, version/seed
  provenance, timing, and presentation metadata. Workspace, auth, billing,
  audit, unrelated metadata, and secrets are omitted.
- Zod remains authoritative for relational checks. The JSON Schema under
  `protocol/runtime/v1/` is generated from it and drift-tested; there is no
  second hand-maintained contract.
- Three deterministic checked packages cover Duel — Knockout, Duel — Time
  Limit, and Four-player Free-for-All. Their generated manifest records seed,
  outcome, ranking, event count, SHA-256, and origin checkpoint `a432b7b`.

### Phase 7A-B readiness and toolchain gate

The 2026-09-19 readiness audit confirmed these prerequisites are ready:

- Visual Studio Community 2022 17.14.41;
- Game Development with C++;
- MSVC v143 14.44.35229;
- Windows SDK 10.0.26100 and Windows SDK 10.0.22621;
- Git 2.55 and Git LFS 3.7.1.

Storage at audit time:

- drive C had approximately 44 GiB free;
- drive D had approximately 358 GiB free;
- Unreal Engine, the runtime repository, Derived Data Cache, and runtime builds
  should be placed on D where practical.

This readiness record predates the paused implementation attempt. Unreal Engine
was subsequently installed and bootstrap work began outside this Platform
repository, but the external D: volume became unstable and emitted Windows Disk
Event 51 I/O errors. Phase 7A-B is paused until that storage is stable. The
durable bootstrap plan remains in
[architecture/PHASE_7A_B_BOOTSTRAP.md](architecture/PHASE_7A_B_BOOTSTRAP.md).

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

## Parallel Platform Track — Web Phase 1: Asset Library v1

- Assets are workspace-scoped stable identities with searchable type, production
  status, name, tags, Entity association and updated-date projections. Supported
  types cover concept art, 3D models, textures, materials, rigs, animations,
  audio, VFX, environments, props, characters, creatures, vehicles and other
  future content.
- Large binaries are never stored in Prisma. Each Asset stores validated metadata
  and safe same-origin or HTTPS storage/preview references. References containing
  path traversal, embedded credentials or credential-like query parameters are
  rejected.
- Every create, edit, status transition, archive and restore appends an immutable
  `AssetVersion`. Historical versions preserve identity, tags, provenance,
  license/author data, references, technical specifications, checklist state,
  Entity associations and parent Asset IDs.
- Structured specifications cover model format and topology, LODs, dimensions,
  scale, skeleton/material/texture references; rig archetype, skeleton version,
  bone count and compatibility; and animation semantic state, clip, duration,
  looping and skeleton compatibility.
- Production workflow states are `DRAFT`, `CONCEPT_APPROVED`, `IN_PRODUCTION`,
  `REVIEW`, `VALIDATED`, `RUNTIME_READY` and `ARCHIVED`. Legal forward/review
  transitions are enforced server-side. Archive/restore are explicit reversible
  actions; permanent deletion requires the Asset to be archived first.
- `AssetEntity` associations are workspace-validated and pin the current Asset
  version. `AssetRelationship` records directed parent/derived lineage. The
  pattern is ready for an equivalent World association after the canonical World
  model exists; Asset Library v1 does not invent dangling World IDs.
- The existing `asset.view` and `asset.manage` permissions remain authoritative.
  Services re-check workspace membership and permissions, use safe workspace-
  scoped lookups, validate every foreign Entity/Asset ID, and audit mutations.
- `/assets` now provides gallery/list modes, search, pagination, type/status/tag/
  Entity filters and updated/name sorting. Create/edit, detail, immutable history,
  technical specifications, production checklist, relationships, and archive/
  restore flows are implemented.
- SimulationRun capture and playback were not changed. Asset edits do not mutate
  Entity Visual Profiles or any stored Run input/participant snapshot. Runtime
  Protocol v1 and Battle mechanics remain byte-for-byte outside this change set.

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
- Phase 7A-A direct `npx vitest run` passed **232 tests in 22 files**, preserving
  all 207 Phase 6 tests and adding 25 Runtime Protocol validator, builder,
  fixture/schema drift, data-minimization, and persisted-history service tests.
  `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`, and `npx next build`
  passed. The build required network access for the existing Google Fonts and
  made no application changes.
- Web Phase 1 direct `npx vitest run` passed **242 tests in 23 files**, preserving
  all 232 Phase 7A-A tests and adding 10 Asset Library service tests for CRUD,
  permissions, workspace isolation, immutable versions, archive/restore, status
  transitions, Entity and lineage references, provenance/license/reference
  validation, discovery controls and historical Run non-mutation.
  `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`, `npx next build`,
  and `git diff --check` passed.

## Known limits

- Asset Library v1 manages metadata, immutable versions and safe references. It
  does not upload or host binaries, provide a CDN/marketplace, optimize content,
  generate Draco/Meshopt/KTX2/LODs, or provide final production models.
- Remote model inspection depends on CORS, and file-size reporting depends on
  HEAD support. Supported runtime containers are GLTF/GLB. The validation
  summary is deliberately practical rather than a full DCC-grade rig auditor.
- Visual snapshots preserve metadata and URL identity, not the bytes behind a
  mutable URL. Asset Library IDs and versions now exist, but wiring them into a
  future snapshot/protocol version is intentionally deferred so Runtime Protocol
  v1 and existing Runs remain unchanged. Use content-addressed or versioned URLs.
- Battle remains the only Viewer adapter. Playback still consumes completed
  saved Runs rather than streaming live simulation.
- No high-fidelity runtime, Unreal project/parser, public runtime session
  endpoint, production character pipeline, World runtime, cloud-streaming
  deployment or live event transport exists yet. Animation Studio, Video
  Studio, new modules, and new Battle rules also remain future work.

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

## Committed Phase 6.5 checkpoint

- Commit `a432b7b` contains exactly the approved four architecture documents:
  modified `docs/CURRENT_STATUS.md` and `docs/vision/VISION.md`, plus new
  `docs/architecture/HIGH_FIDELITY_RUNTIME.md` and
  `docs/architecture/RUNTIME_PROTOCOL.md`.
- No implementation code, schema, tests, dependencies, assets, or Unreal
  project were included in that checkpoint.

## Committed Phase 7A-A checkpoint

- Commit `5687430` contains the canonical TypeScript/Zod protocol, authorized
  package service, generated JSON Schema, protocol artifact documentation,
  three fixture packages and manifest, fixture generator/test support,
  protocol/service tests, and status/protocol documentation.
- Prisma schema and Battle mechanics are unchanged. No dependency, UI, Viewer,
  model, World, Unreal, networking, streaming, or runtime-repository changes.

```text
LAST COMPLETED:
  Phase 7A-A — Platform Runtime Protocol v1
  5687430 feat: add SIMVERSE runtime protocol v1

COMMITTED HANDOFF CHECKPOINT:
  dbfc971 docs: prepare Phase 7A-B Unreal bootstrap

CURRENT:
  Parallel Platform Track — Web Phase 1: Asset Library v1
  STATUS: IMPLEMENTED, UNCOMMITTED, AWAITING OWNER REVIEW

PAUSED PARALLEL TRACK:
  Phase 7A-B — Unreal Runtime Bootstrap
  STATUS: PAUSED DUE TO EXTERNAL D: STORAGE INSTABILITY / DISK EVENT 51

NEXT ACTION:
  Review and approve the Asset Library v1 Platform change set. Do not access D:
  or resume Unreal work until the external storage is stable.
```
