# SIMVERSE — Current Status

> Canonical Claude ↔ Codex handoff. The repository is authoritative. Long-form
> vision: [vision/VISION.md](vision/VISION.md). Local rules: [../AGENTS.md](../AGENTS.md).

- **Version:** 0.1.0.
- **Latest completed checkpoint:** **Public / Unlisted Sharing v1**, committed at
  current `HEAD` (`feat: add SIMVERSE public sharing v1`). It adds the **Share**
  layer and completes the first full creator loop (Create → Simulate → Experience
  → Create Content → Export → Share). It builds on **Image / Post Export v1**
  `b7a1693`, which builds on **Creator / Media Foundation v1** `5012b33`, after
  Beginner Experience v1.1 `0ca7fdc` and Anything Wars v0 `52eea9c`.
- **Checkpoint scope (Public / Unlisted Sharing v1):** a creator can expose one
  immutable `MediaArtifactVersion` through a **version-pinned** public link that
  is PRIVATE (default), UNLISTED or PUBLIC. Adds the `MediaShare` model (one per
  artifact, stable high-entropy `publicId`), the `media.share` permission
  (OWNER/ADMIN/CREATOR), an authorized share API, a Studio "Sharing" panel, an
  unauthenticated public page `/s/[publicId]` (no platform shell, SEO-aware) with
  a public image endpoint `/s/[publicId]/image` reusing the export render, and a
  strict public-safe `PublicMediaShareV1` projection that leaks no internal ids.
  Archiving suspends a share; restoring does not auto-republish. Full detail:
  [architecture/PUBLIC_SHARING_V1.md](architecture/PUBLIC_SHARING_V1.md).
- **Prior committed checkpoint:** **Image / Post Export v1** `b7a1693` — render a
  saved `MediaArtifactVersion` into a shareable PNG/SVG (`RESULT_CARD` or
  `STORY_POSTER`) via a generic `ResultGraphicV1` render model, a pure
  deterministic SVG renderer, and a server-only `@resvg/resvg-js` rasterizer.
  See [architecture/MEDIA_EXPORT_V1.md](architecture/MEDIA_EXPORT_V1.md). Earlier:
  **Creator / Media Foundation v1** `5012b33` (generic `MediaArtifact` +
  immutable `MediaArtifactVersion` storyboards from completed Battle/Race/Survival
  Runs).
- **Canonical UX + capability docs:** product-experience standards now live in
  [UX_PRINCIPLES.md](UX_PRINCIPLES.md) and the honest maturity inventory in
  [MASTER_CAPABILITY_MAP.md](MASTER_CAPABILITY_MAP.md).
- **Paused track:** Phase 7A-B — Unreal Runtime Bootstrap. Unreal work is paused
  because the external D: drive became unstable and Windows reported Disk Event
  51 I/O errors. Do not access D: or run/build the Unreal runtime until storage
  is stable.
- **Committed checkpoint before this work:** `0ca7fdc` (Beginner Experience v1.1
  responsive + capability-map closure), after `7a4eb47` (browser QA + auth fix),
  Beginner Creation Experience v1 `8699345`,
  Anything Wars v0 `52eea9c`, Survival Module v1 `36fb950`, Race Module v1
  `c97887d`, Tournament System v1 `49eff48`, Experience Profiles v1 `775a01b`, World Blueprint Creator
  v1 `f4c253c`, Asset Library v1 `99e0b6f`, Phase 7A-A `5687430`, Phase 6.5
  `a432b7b`, Phase 6 `b08df45`, Phase 5 `22a7560`, and Phase 4 `d9be027`.
- **Last updated:** 2026-10-15.
- **Boundary:** Battle v1, Race v1 and Survival v1 are production mechanics
  modules. Core and Modules remain authoritative. Three.js is the Web Preview
  Viewer; Race and Survival use truthful lightweight status/results views. Platform
  Runtime Protocol v1 transports completed Battle truth only; no Unreal project,
  rendered World runtime or Phase 7B work exists in this Platform repository.
  Engine-neutral World Blueprint metadata, Experience Profile presentation
  direction, and generic Tournament orchestration now exist. Anything Wars is a
  Product UI/service boundary and does not replace or duplicate those systems.
  Runtime Protocol v1 and Battle, Race and Survival mechanics are unchanged.
  Creator / Media Foundation v1 consumes completed Battle, Race and Survival
  Runs downstream as versioned storyboards. It performs no result calculation.

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

## Parallel Platform Track — Web Phase 2: World Blueprint Creator v1

- `World` is the stable, workspace-scoped searchable identity. `WorldVersion`
  stores every complete immutable environment definition, its status, tags,
  Asset and Entity association snapshots, creator, version note and SHA-256
  content identity. Current normalized `WorldTag`, `WorldAsset` and `WorldEntity`
  rows support discovery and safe relationships without replacing version truth.
- Statuses are `DRAFT`, `IN_DESIGN`, `REVIEW`, `VALIDATED`, `RUNTIME_READY` and
  `ARCHIVED`. Server-side transitions, archive and restore append versions.
  `RUNTIME_READY` means that the blueprint is ready to bind to a consumer; it
  does not claim that an Unreal environment exists.
- World Blueprint v1 validates explicit engine-neutral terrain dimensions and
  coordinates, elevation/slope/roughness/traversability/surfaces/boundaries,
  climate units and seasons, weighted weather definitions, static or dynamic
  time, ecology slots, water, typed zones, named spawn sets, camera definitions,
  Asset-backed audio channels, compatible Entity categories and presentation
  policies. It generates no terrain mesh, physics, audio or cinematic output.
- Biomes cover Savannah, Forest, Rainforest, Desert, Tundra, Mountain,
  Grassland, Wetland, Ocean, Coastal, Urban, Industrial, Farm, Fantasy, Space
  and named custom definitions. Original structured presets cover SIMVERSE
  Savannah, Temperate Forest, Open Desert, Urban Arena and Working Farm.
- World-to-Asset placement rows pin existing immutable Asset versions, roles,
  engine-neutral transforms and bounded configuration. Associated Assets and
  optional native/default Entity links must belong to the workspace and cannot
  be archived. Large binary content is never stored in World records.
- The first-class original SIMVERSE Savannah preset includes open grassland,
  acacia/dry-grass/rock content slots, a watering-hole interaction zone,
  predator and prey spawn sets, clear/dust/rain weather, dynamic time, camera
  definitions and wildlife audio metadata. It includes no production models,
  terrain mesh, Unreal content or cinematic scene.
- `/worlds` provides gallery/list discovery, search, biome/status/tag/category
  filters and sorting. Create/edit, detail, immutable history and archive/restore
  routes use the existing authenticated Platform shell and `world.view` /
  `world.manage` permissions. The 12-section designer exposes common structured
  fields and validated JSON for variable engine-neutral definitions; it is not a
  3D editor.
- Simulations may optionally pin a workspace World and exact World version.
  Existing definitions with no World remain valid. Every new World-bound Run
  copies the complete selected version into its immutable input snapshot, so
  later World edits do not change historical Run truth. Runtime Protocol v1
  already has a nullable World binding shape and is unchanged; producing a
  runtime manifest from a saved blueprint remains future integration work.
- Prisma continues to use the repository's established `db push` workflow. No
  migration directory, binary storage, Unreal dependency or new runtime contract
  was introduced.

## Parallel Platform Track — Web Phase 3: Presentation / Experience Profiles v1

- `ExperienceProfile` is the stable workspace-scoped identity. Every create,
  meaningful edit, workflow transition, archive and restore appends a complete
  immutable `ExperienceProfileVersion` with a monotonic version number and
  deterministic SHA-256 content identity. Current tag, event, Asset, Entity and
  World links are validated searchable projections; old version records never
  change.
- The authority boundary is explicit: **Core determines what happens**, an
  **Experience Profile describes how saved truth should be presented**, and a
  **runtime resolves and renders those presentation instructions**. Profiles
  cannot choose actions, targets, damage, elimination, ranking or winners, and
  cannot change ticks, simulated time, event sequence or outcome order.
- Experience Definition v1 uses the existing semantic animation vocabulary and
  engine-neutral camera, VFX, audio and HUD cue sets. Normalized intensity,
  bounded timing, optional Entity/archetype/category overrides and constrained
  declarative conditions can reference only fields already present in the
  authoritative event payload.
- Battle v1 mappings accept exactly `battle.started`, `battle.attack`,
  `battle.defend`, `battle.dodged`, `battle.critical_hit`, `battle.damage`,
  `battle.eliminated`, `battle.timeout` and `battle.completed`. The original
  **SIMVERSE Cinematic Battle v1** reference maps all nine event types, and
  Competitive, Broadcast, Minimal, Dramatic, Documentary and Cinematic presets
  provide reusable starting points. No Unreal asset name or Battle rule is
  embedded in a Profile.
- Asset associations pin authorized immutable workspace Asset versions for
  audio, VFX, UI and graphic cues; audio and VFX roles also validate compatible
  Asset types. Entity overrides validate active workspace Entities and known
  visual archetypes without duplicating `EntityVisualProfile`. Optional World
  interactions pin World versions and validate camera/result zones while
  keeping the World Blueprint immutable.
- Simulations may optionally pin a Profile and exact version. Existing
  Simulations without one remain valid. Every new bound Run copies the complete
  selected version, content hash and definition into its immutable input
  snapshot. Later Profile edits or archival cannot rewrite historical Runs.
- `/experiences` provides searchable/filterable discovery, detail, structured
  create/edit, immutable history and archive/restore flows. The editor covers
  event mappings, semantic animation, cameras, VFX, audio, HUD, intensity,
  timing, conditions, overrides, Assets and Worlds without requiring ordinary
  users to edit raw JSON. Server services and routes enforce `experience.view`
  and `experience.manage` through the existing workspace authorization model.
- Runtime Protocol v1 remains unchanged. Its event/result truth is sufficient
  for future consumers to resolve independently versioned Experience Profile
  direction, while this phase stores the complete Profile only in the Platform
  Run input snapshot. Prisma continues to use `db push`; no migration history,
  binary storage, rendering engine dependency or cinematic timeline was added.

## Parallel Platform Track — Web Phase 4: Tournament System v1

- A Tournament is a workspace-scoped competition coordinator above ordinary
  Simulations and SimulationRuns. The authority path is **Tournament → Round →
  Match → derived Simulation → authoritative SimulationRun → module result
  adapter → advancement / standings → final outcome**. Tournament code never
  calculates Battle damage, targets, ranking, ties or winners.
- v1 fully implements `SINGLE_ELIMINATION` and `ROUND_ROBIN` for generic Entity
  participants. Participant rows freeze display identity, deterministic seed,
  position and optional metadata. Single elimination accepts arbitrary counts,
  uses standard seeded bracket positions, advances real BYEs without creating
  dummy Runs, and links every winner slot explicitly. Round robin uses the
  deterministic circle schedule, supports odd fields, and creates every pairing
  exactly once.
- Manual seeding follows creator order. Random seeding uses the existing
  versioned seeded RNG and a stored `SV-XXXXXXXX` seed, so it is reproducible.
  `RANKED` remains reserved until SIMVERSE has an authoritative ranking source.
- A READY Battle duel, Race v1 or Survival v1 Simulation is selected as the
  Match template. Tournament Match v1 remains head-to-head. Structure
  generation freezes one validated Tournament-level snapshot of its mode,
  configuration, presentation, project, seed provenance and pinned World /
  Experience Profile versions. Each runnable Match derives one normal READY
  Simulation with its two Entity participants, then creates, starts and executes
  a normal SimulationRun through the existing Core service. Later template edits
  cannot change Match construction from the frozen snapshot.
- `TournamentModuleResultAdapter` is the generic module boundary. The Battle,
  Race and Survival adapters validate completed `battle-v1`, `race-v1` or
  `survival-v1` Runs, map immutable
  Run participants back to Tournament participants, and project winner, ties,
  ranking and completion reason. They interpret saved module results and never
  recalculate either module's mechanics.
- Elimination ties never invent a winner. `REPLAY_MATCH` appends a new linked
  Match while retaining the original Run/result; `NO_TIES_ALLOWED` accepts the
  historical result, pauses the Tournament and surfaces a resolution error.
  Result acceptance and advancement are state-checked and idempotent.
- Round-robin standings are derived from immutable completed Match result
  snapshots. Configurable win/tie/loss points and ordered `POINTS`, `WINS`, and
  `HEAD_TO_HEAD` tiebreakers produce played/win/loss/tie/points/rank views. A
  still-unresolved top group is recorded as tied champions instead of fabricating
  a single champion. Final standings are frozen on completion.
- Lifecycle states are `DRAFT`, `CONFIGURING`, `READY`, `IN_PROGRESS`, `PAUSED`,
  `COMPLETED`, `CANCELLED`, and `ARCHIVED`. Structural edits are limited to Draft
  and Configuring and clear generated structure. Pause, resume, cancel, archive
  and restore preserve completed Matches and Runs. Hard deletion is allowed only
  while no authoritative Run/result history exists.
- Server services enforce `tournament.view`, `tournament.manage`, and
  `tournament.run` with workspace-scoped safe lookups. Significant lifecycle,
  structure, Run, result, archive and deletion actions use the existing audit
  system. Unique constraints plus conditional state updates protect generation,
  Match launch, Run linkage and advancement from duplicate processing.
- `/tournaments`, `/tournaments/new`, `/tournaments/[tournamentId]`, and
  `/tournaments/[tournamentId]/edit` provide discovery, the ten-step structured
  creator flow, readable elimination brackets or round-robin schedules,
  participants, Matches, standings, Run/result links, lifecycle history, and
  archive/restore actions. Run Match is available only to authorized runners
  while the Tournament is in progress.
- Optional start, Round start, and Match scheduling fields are metadata only.
  v1 intentionally omits background scheduling and bulk Run Round execution.
  World and Experience Profile bindings are pinned defaults; presentation never
  affects competition outcomes. Runtime Protocol v1 and Battle mechanics are
  unchanged, and no Tournament-wide runtime protocol was added.
- Prisma continues the repository's established `db push` convention. The
  Tournament schema stores orchestration metadata and JSON snapshots only; it
  stores no binaries and introduces no migration history.

## Parallel Platform Track — Web Phase 5: Race Module v1

- `race` / `race-v1` is a deterministic, server-authoritative production module
  registered through the existing Core engine registry. It advances only on the
  100 ms fixed tick, uses the existing serialized `mulberry32-v1` seeded RNG,
  and resolves all participant stats once from the immutable Run snapshot. It
  never reads current Entity state during execution.
- `RaceConfigV1` supports `SPRINT` and `CIRCUIT`, `METER`, `KILOMETER`, and
  `ABSTRACT_UNIT`, course distance, lap count, maximum ticks, bounded variability,
  ordered percentage checkpoints, and configurable Entity attribute keys for
  speed, acceleration, handling, stamina, and luck. Missing stats default to 50;
  present numeric values round and clamp to 0–100. Distinct lowercase mapping
  keys are required.
- Progress uses integer milli-distance units. Per 100 ms tick, base pace is
  `4,000 + speed * 80`. Acceleration is
  `min(10,000, 3,500 + tick * (150 + acceleration * 5))` basis points. Fatigue
  begins after 60% of total distance and reaches at most
  `(100 - stamina) * 25` basis points. Seeded variance is scaled by the configured
  0–100 intensity and bounded to ±10%; handling reduces only its negative side
  (halved at handling 100), while luck shifts it by at most ±1%. Each stage floors
  to an integer and an active participant advances at least one milli-unit.
  Variability zero consumes no RNG value, so equal profiles can tie exactly.
- State v1 stores tick/time, normalized config, resolved profiles, progress,
  last pace delta, lap/checkpoint state, finished state, precise finish time,
  shared-rank standings, leaders and completion reason. Crossing time is
  interpolated from previous progress, the current integer delta and remaining
  distance, then rounded up to one microsecond within the crossing tick.
- The typed event vocabulary is `race.started`, `race.progress`,
  `race.lead_changed`, `race.checkpoint`, `race.finished`, `race.timeout`, and
  `race.completed`. One aggregate progress snapshot is emitted on tick 1, every
  five ticks, and on meaningful lead/checkpoint/finish/completion ticks. This is
  sufficient for later interpolation without one database event per participant
  on every tick. Completion emits exactly once.
- `RaceResultV1` identifies `race` / `race-v1` and records the mode, course,
  completion reason, singular or tied winners, shared-rank final ordering,
  finished/DNF state, nullable finish times, achieved distance, completed laps,
  frozen profiles, tick count and simulated duration. `ALL_FINISHED` and
  `TIME_LIMIT` are the only completion reasons.
- Finished participants rank by exact finish microseconds. DNF participants rank
  after finishers by achieved progress. Equal authoritative values keep the same
  rank and tie flag; stable snapshot position affects JSON ordering only and
  never breaks a tie. At the tick limit, finishers keep their positions and DNF
  entries receive no fabricated finish time.
- The Simulation Builder now provides structured Race fields and no ordinary
  Race workflow requires raw JSON. READY validation enforces executable config
  and 2–64 unique participants. Bounds are distance 0.001–1,000,000 with at most
  three decimals, 1–100 laps (Sprint exactly 1; Circuit at least 2), 1–5,000
  ticks, 0–100 variability, and at most 12 unique checkpoints from 1–99%.
- Optional pinned World/version remains immutable presentation context and does
  not alter Race mechanics. Race-compatible Experience Profiles may map the real
  Race event vocabulary; the original **SIMVERSE Cinematic Race v1** preset adds
  semantic camera, animation, VFX, audio and HUD direction without affecting
  outcomes. Run snapshots preserve both bindings and later edits cannot change
  historical Race truth.
- Race Run pages expose authoritative status, leaders, progress, distance, laps,
  finish times, ranking and completion reason with a lightweight progress view.
  Start/advance/pause/resume use existing bounded Run endpoints. Serialized state
  includes RNG position, so replay and pause/resume reproduce identical actions,
  events, standings and results.
- `RaceTournamentResultAdapter` consumes only a completed validated
  `RaceResultV1`; it projects winner, tied winners, ranking and completion reason
  into `CompetitionMatchResult` without recalculation. Existing Tournament v1
  keeps two participants per Match, and head-to-head Race works with current
  elimination/tie policy and round-robin scoring.
- No Race-specific Prisma table, migration or binary asset requirement was
  introduced. Runtime Protocol v1 remains Battle-focused and unchanged; Race
  package export requires a future Protocol v2 or reviewed compatible extension.
  Battle formulas, events, results and seeded behavior are unchanged.

## Parallel Platform Track — Web Phase 6: Survival Module v1

- `survival` / `survival-v1` is a deterministic, server-authoritative production
  module registered beside Battle and Race. It supports 2–64 immutable Run
  participants and the canonical `LAST_STANDING` and `ENDURANCE` modes. It uses
  the existing 100 ms fixed Core tick, serialized `mulberry32-v1` RNG state,
  generic Run/Event/Result persistence and pause/resume lifecycle. No
  Survival-specific table or Prisma change is required.
- `SurvivalConfigV1` stores a maximum of 10,000 ticks, base condition drain,
  elimination threshold, bounded hazard frequency/intensity and seeded
  variability, explicit Energy/Supplies initialization and drain, depletion
  penalty, paid interval recovery, and six configurable Entity attribute keys.
  Legacy `scenarioType` settings read as the corresponding canonical mode.
  World Blueprint data remains presentation context and is never read as a
  hidden mechanics input.
- Frozen `NUMBER` attributes resolve once at initialization: **Endurance** lowers
  baseline condition loss, **Resilience** lowers hazard condition loss,
  **Resource Efficiency** lowers ongoing and hazard resource use,
  **Adaptability** lowers environment/extreme/custom hazard effects and improves
  recovery, **Awareness** lowers hazard exposure, and **Luck** adds only small
  bounded seeded shifts. Missing stats default to 50; present values round and
  clamp to 0–100. Mutable Entity state is never queried after Run creation.
- Condition and both resources use bounded integer units from 0–100,000.
  Resource efficiency is `10,000 - RESOURCE_EFFICIENCY × 50` basis points.
  With variability enabled, one seeded resource roll supplies a scaled
  `[-1,000, +1,000]` basis-point shift plus a favorable Luck shift capped within that same
  ±10% bound. Each configured positive base drain is floored through both
  factors and remains at least one. Variability zero consumes no resource RNG.
- Baseline condition loss is
  `floor(baseConditionDrain × (10,000 - ENDURANCE × 50) / 10,000)`. Each
  exhausted resource adds the explicit configured depletion penalty. Resource
  exhaustion therefore increases condition pressure without itself declaring
  an elimination.
- Each tick resolves in this fixed order: resource drain; baseline/depletion
  condition loss; one global seeded hazard decision and category; per-participant
  hazard effects; eligible paid recovery; one-time elimination; shared-rank
  standings/leader update; completion. It uses simulation time only and never
  reads wall-clock time.
- Hazard categories are `ENVIRONMENT`, `RESOURCE_SHORTAGE`, `FATIGUE`,
  `ACCIDENT`, `EXTREME_CONDITION`, and `CUSTOM`. Frequency is a bounded
  0–100% per-tick seeded decision; category is seeded uniformly when a hazard
  occurs. Condition base impact is `intensity × 80`. Awareness removes at most
  40%, Resilience at most 50%, and applicable Adaptability at most 25%, using
  sequential integer floors. Resource-shortage, fatigue and extreme-condition
  categories can also consume bounded resources. Hazard variance is bounded to
  ±5%, including Luck's maximum favorable ±0.5% contribution.
- Recovery runs only on its configured tick interval while condition is above
  the terminal threshold and below 100,000 and the participant can pay both
  configured resource costs. Its factor is `7,500 + ADAPTABILITY × 25` basis
  points, or 75–100% of the configured amount. It cannot revive a participant,
  exceed maximum condition or create resources.
- Participants are eliminated exactly once when condition is at or below the
  configured threshold after the tick's effects. State and result preserve the
  tick, simulated time, final condition/resources and one of `CONDITION`,
  `RESOURCE_DEPLETION`, or `HAZARD`. `LAST_STANDING` completes with one survivor,
  all eliminated, or at the time limit. `ENDURANCE` runs to the time limit unless
  all participants are eliminated first.
- Active participants always rank ahead of eliminated participants. Active
  ranking compares condition, Energy and Supplies in that order. Eliminated
  ranking compares survival duration. Snapshot position stabilizes JSON order
  only; exactly equal authoritative values receive a shared rank and tie flag.
  Completion reasons are `LAST_STANDING`, `TIME_LIMIT`, and `ALL_ELIMINATED`.
  A simultaneous terminal resolution can produce tied leaders and no fabricated
  singular winner.
- The typed event vocabulary is `survival.started`, `survival.status`,
  `survival.resource_changed`, `survival.hazard`, `survival.recovered`,
  `survival.eliminated`, `survival.leader_changed`, `survival.timeout`, and
  `survival.completed`. Status snapshots occur on tick 1, every five ticks and
  meaningful hazard/recovery/elimination/leader/completion ticks. Resource events
  aggregate first-depletion transitions; recovery events already record their
  explicit costs. Completion emits exactly once.
- `SurvivalResultV1` identifies the module/version and freezes mode, completion
  reason, singular or tied leaders, shared-rank standings, every participant's
  survived/eliminated state, nullable elimination tick/time/cause, final
  condition/resources, survival duration, resolved profile, total ticks,
  simulated duration and hazard count. It contains no renderer metadata.
- The Simulation Builder provides structured fields for every v1 setting and
  stat mapping. Simulation and Run pages expose bounded execution controls,
  pause/resume, authoritative leaders, rankings, condition/resource meters,
  survival duration, hazards, eliminations and final outcome without fabricating
  a 3D runtime.
- Experience Profiles recognize every actual Survival event. The original
  **SIMVERSE Cinematic Survival v1** preset supplies semantic camera, animation,
  VFX, audio and HUD direction only. Optional pinned World/Profile versions are
  frozen through the existing Run snapshot path and never alter outcomes.
- `SurvivalTournamentResultAdapter` validates a completed `SurvivalResultV1` and
  maps only its winner, tied leaders, ranking and completion reason into the
  existing `CompetitionMatchResult`. Tournament v1 remains head-to-head, so
  Survival Tournament Matches use two participants and existing tie policies and
  round-robin scoring without recalculation.
- Runtime Protocol v1 remains deliberately Battle-focused. No Survival export,
  protocol schema, fixture or runtime package was added. Battle and Race
  mechanics, results and event vocabularies are unchanged.

## Products Track — Anything Wars v0 Browser Product Shell

- `/anything-wars` is the first real browser product home. It uses real
  workspace data for active and recently completed events, exposes Battle,
  Race, Survival and Tournament entry points, and keeps Economy, Civilization,
  Sports, Strategy and Random visibly disabled as future modes.
- The guided Create War flow reuses the existing eight-step Simulation Builder
  with product language: Entities are competitors, Simulations are events,
  World Blueprints are Worlds/Arenas, and Experience Profiles are presentation
  styles. Search, images, categories, selected attributes, ordering and existing
  module forms remain backed by canonical Entity and Simulation records.
- Battle, Race and Survival events are normal workspace-scoped Simulations
  tagged minimally in existing metadata as `product: "anything-wars"` and
  `productVersion: 0`. No Product table or Prisma change is required. The
  product service delegates CRUD, READY transitions and Run creation to the
  existing authorized services and additionally rejects unsupported modes,
  non-product IDs and module-ineligible launch configurations.
- Optional immutable World and Experience Profile versions use the existing
  Simulation bindings. Every Run freezes the complete selected versions through
  the existing input snapshot path. Anything Wars never reads later mutable
  Entity, World or Profile state to rewrite historical Runs.
- Event and Run pages wrap real lifecycle status, bounded start/advance,
  pause/resume/cancel, mode-specific results, rankings/statistics and event
  history. Battle v1 alone offers the existing real-time 3D Watch/Replay route;
  Race and Survival truthfully use their existing progress and result views.
- **Run Again** creates a new Run from the same saved Simulation. **Rematch**
  creates a separate editable event initialized from the source. Neither action
  updates a historical Run. Generic Simulation and Run detail links remain
  available as secondary power-user paths.
- Tournament routes compose the existing Tournament service, creation form,
  lifecycle controls, bracket/schedule, standings, Match Run orchestration and
  immutable participant identities. Tournament remains its own generic system;
  Anything Wars adds product navigation and terminology only.
- Navigation, dashboard product discovery and the Create hub now present
  Anything Wars as an available first-class Product while preserving generic
  Projects, Entities, Worlds, Experiences, Simulations and Tournaments.
- Server permissions remain authoritative. `simulation.view`,
  `simulation.create`, `simulation.edit`, `simulation.run`, `tournament.view`,
  `tournament.manage` and `tournament.run` are enforced by the existing service
  boundaries. Read-only users cannot mutate or launch events, and foreign
  workspace IDs use safe NotFound behavior.
- Known v0 limits: Runs advance in bounded request-driven batches rather than a
  worker; Worlds are immutable Blueprints rather than rendered environments;
  Experience Profiles direct presentation but do not control every current Web
  Viewer feature; Battle is the only mode with 3D replay; Tournament v1 remains
  head-to-head per Match; creating an Entity from the wizard opens the existing
  Entity flow in a separate tab so the saved wizard state is preserved.

## Products Track — Anything Wars Beginner Experience + Visual Creation Guidance v1

> Status: **committed in `8699345`.** The follow-up accessibility fix and
> headless-browser QA are committed in `7a4eb47`; the final Dashboard responsive
> correction found by that QA is recorded below. It composes the
> same canonical services as the v0 shell and adds no mechanics, Prisma schema,
> Core, or Runtime Protocol change.

- **Preview-first Create gateway.** `/create` is rebuilt as a beginner gateway
  where every option shows a small visual representation of what it produces
  before entry. A truthful catalog
  ([src/lib/create/catalog.ts](../src/lib/create/catalog.ts)) is the single
  source of destination identity, copy, required permissions, and a
  `LIVE | COMING_LATER` status; it is deliberately separate from presentation so
  links and future states are contract-tested without rendering
  ([catalog.test.ts](../src/lib/create/catalog.test.ts)). Cards are
  permission-aware via `canOpenCreateDestination`, so a destination only links
  when the user truly holds its server-side permissions. Visual mini-previews
  ([creation-previews.tsx](../src/components/create/creation-previews.tsx)) use
  original iconography (lion/robot/car/country for Entity; terrain/zones for
  World; a VS → rules → outcome diagram for Simulation; a Battle/Race/Survival
  competition for Anything Wars; a folder for Project; a clearly non-interactive
  scene/camera/timeline for Animation Studio). Progressive disclosure orders the
  page: a featured "recommended first step" (Anything Wars), then building
  blocks (Entity/World/Simulation), then organize-and-future (Project/Animation).
- **Truthful World and Animation copy.** World is described honestly as a
  structured World Blueprint creator ("design its environment, rules, and
  structure now; rich 3D world experiences continue to expand over time"); it is
  not labeled unavailable because `/worlds/new` is functional. Animation Studio
  is shown only as a `COMING_LATER` preview with no live link, and is explicitly
  distinguished from the existing Standard Animation System (runtime states).
- **Anything Wars Quick War.** A new beginner flow —
  `/anything-wars/quick` ([page](../src/app/(platform)/anything-wars/quick/page.tsx),
  [form](../src/components/anything-wars/quick-war-form.tsx)) — asks only *what
  happens* (Battle/Race/Survival, the modes that actually execute today) and
  *who competes* (at least two active workspace competitors, chosen with the
  Entity picker in new `scope="workspace"` mode). SIMVERSE supplies every
  ordinary default itself: balanced working rules, match configuration (duel for
  two, free-for-all for more), presentation defaults, a fresh seed, and
  organization — so beginners never face Seed, Runtime Protocol, Experience
  Profile, immutable snapshots, module versions, or authoritative-execution
  concepts.
- **Server composition, not a shortcut.** `createQuickAnythingWarsRun`
  ([anything-wars-service.ts](../src/server/services/anything-wars-service.ts))
  re-checks `simulation.create` **and** `simulation.run`, validates input with
  `quickWarInputSchema` ([quick.ts](../src/lib/anything-wars/quick.ts)), loads
  competitors with a workspace-scoped `ACTIVE` lookup and rejects any id that is
  not in the workspace, then calls the exact same canonical path as Custom War:
  `createAnythingWarsEvent` → `markAnythingWarsEventReady` → `createAnythingWarsRun`
  → `startSimulationRun`. No validation, permission, or snapshot behavior is
  bypassed to achieve the simpler surface.
- **Projects architecture decision — "Quick Creations".** Beginners are not
  forced to understand Projects first. `resolveQuickCreationsProject` finds the
  workspace's existing `ACTIVE` organizer project by stable metadata
  (`purpose: "anything-wars-quick"`, `version: 1`), ordered by `createdAt` for
  stable ordinary reuse, and only creates one through the existing
  `createProject` service when none exists. Selected competitors are linked via
  the existing `addProjectEntities` service. Workspace isolation and service
  boundaries are preserved and no cross-workspace references are introduced.
  Ordinary sequential calls are verified by a test asserting a
  single organizer project across three Quick Wars and zero projects created
  when validation fails. Simultaneous first creation across multiple processes
  still lacks a database uniqueness guarantee; this is documented as a
  pre-public-scale hardening item in
  [MASTER_CAPABILITY_MAP.md](MASTER_CAPABILITY_MAP.md), rather than hidden behind
  a process-local lock.
- **Custom War preserved.** The detailed builder remains at
  `/anything-wars/create`, renamed **Custom War** and framed as "customize
  everything" (competitors, detailed rules, World/Arena, presentation style,
  seed). The Anything Wars home presents **Quick War** as the primary call to
  action and **Custom War** as the secondary one; the per-mode cards route to
  Quick War with the mode preselected. Quick and Custom create and use the same
  canonical systems — no mechanics are duplicated.
- **Result-first completed experience.** A completed run now leads with the
  outcome. `anythingWarsOutcome`
  ([outcome.ts](../src/lib/anything-wars/outcome.ts)) derives product copy
  (`"<Winner> Wins!"`, ties, shared wins) **only** from validated authoritative
  Battle/Race/Survival result schemas, with a safe generic fallback. The run
  page shows a trophy result banner, then clear next actions — **Watch Replay**
  (Battle only, because Battle is the only mode with real 3D replay), Run Again,
  Rematch, **Change Competitors**, and New War — and demotes technical metadata
  (tick, simulated time, seed, events, World, presentation) into a collapsed
  **Match details** disclosure. Race and Survival never show a fake 3D Watch
  action.
- **Beginner terminology.** Product surfaces speak plainly (competitors, events,
  matches, worlds/arenas, presentation styles) while code, services, and the
  database keep canonical names. The full mapping and the governing standards are
  recorded in [UX_PRINCIPLES.md](UX_PRINCIPLES.md).
- **Accessibility fix.** The Create gateway's "recommended first step" heading
  was corrected from a second `<h1>` to an `<h2>`, so the page keeps a single
  `<h1>` (from `PageHeader`) and a correct heading order; its section keeps the
  `aria-labelledby` association.
- **Files in this change set.** Modified:
  `src/app/(platform)/create/page.tsx`,
  `src/app/(platform)/anything-wars/page.tsx`,
  `src/app/(platform)/anything-wars/create/page.tsx`,
  `src/app/(platform)/anything-wars/events/[simulationId]/page.tsx`,
  `src/app/(platform)/anything-wars/events/[simulationId]/runs/[runId]/page.tsx`,
  `src/components/simulations/entity-picker.tsx`,
  `src/lib/anything-wars/routes.ts`,
  `src/server/services/anything-wars-service.ts`, and the two touched test
  files. Created: `src/lib/create/catalog.ts` (+ test),
  `src/components/create/creation-card.tsx`,
  `src/components/create/creation-previews.tsx`,
  `src/lib/anything-wars/quick.ts`, `src/lib/anything-wars/outcome.ts`,
  `src/components/anything-wars/quick-war-form.tsx`,
  `src/app/(platform)/anything-wars/quick/page.tsx`,
  `src/app/api/anything-wars/quick/route.ts`, plus docs `UX_PRINCIPLES.md` and
  `MASTER_CAPABILITY_MAP.md`.
- **Preserved unchanged.** Deterministic Core, Battle/Race/Survival mechanics,
  Tournament, Run snapshots, seed behavior, Runtime Protocol v1, permissions,
  workspace isolation, historical results, generic creators, and service
  boundaries. Anything Wars remains a Product composed from generic SIMVERSE
  systems; SIMVERSE is not re-architected around it.

## Creator / Media Platform — Foundation v1

- `MediaArtifact` is a stable workspace-owned creative identity tied to one
  completed source Run. v1 supports the real `STORYBOARD` type and
  `DRAFT | READY | ARCHIVED` lifecycle. Multiple artifacts may derive from one
  Run. The source relation is restrictive so artifact provenance cannot dangle.
- `MediaArtifactVersion` rows are immutable and uniquely numbered per artifact.
  Each stores creator attribution, title, subtitle, description, production
  status, one of three aspect ratios (16:9, 9:16, 1:1), and a bounded validated
  storyboard. Edits, archive and restore append versions; old versions remain
  inspectable.
- `StoryboardV1` freezes source Run/Simulation/module identity, historical
  participant presentation fields, the authoritative winner/tie/ranking and
  completion reason, plus ordered `INTRO`, `COMPETITOR`, `HIGHLIGHT`,
  `TURNING_POINT`, `RESULT` and `OUTRO` scenes. Scene and participant references
  are validated, scene IDs/orders are unique, and a result scene is required.
- The generic adapter registry has exact v1 adapters for Battle, Race and
  Survival. They parse the already saved module result, validate selected event
  payloads against existing module schemas, and choose at most six deterministic
  meaningful moments. No adapter calls module execution or recalculates an
  outcome.
- `createMediaArtifactFromRun` checks `media.create`, performs safe
  workspace-scoped lookup, requires `COMPLETED`, validates every saved source
  structure and creates the artifact plus version 1 atomically. Presentation
  editing accepts only title/subtitle/description, aspect ratio, status and scene
  copy/order/enabled state. Source IDs, result facts, participant identity,
  scene kind and event sequence never enter the writable API contract.
- Central permissions are `media.view`, `media.create` and `media.edit`.
  Every role can view workspace content; Creator can create/edit; Editor can
  edit; Admin/Owner inherit all. Viewers cannot mutate. Foreign workspace Runs
  and artifacts use the established safe NotFound strategy.
- `/studio` is now a real bounded library and completed Run creation surface.
  `/studio/[artifactId]` provides a responsive creator workspace with scene
  cards, copy/ordering controls, aspect ratio selection, status, archive/restore,
  immutable source facts, version history and a CSS/React result card preview.
  Generic and Anything Wars completed Battle/Race/Survival pages expose
  `Create Content` when permission and adapter support are present.
- Audit actions cover artifact creation, version creation, archive and restore
  with small metadata. No storyboard payload is copied into the audit trail.
- The complete architecture and extension boundary are documented in
  [architecture/CREATOR_MEDIA_FOUNDATION.md](architecture/CREATOR_MEDIA_FOUNDATION.md).
  This checkpoint adds structured metadata only: no media binaries, video
  editor, export/render pipeline, AI Director, publishing, sharing or social
  system.

## Creator / Media Platform — Image / Post Export v1

- The first **real portable content output**: a saved immutable
  `MediaArtifactVersion` renders into a shareable **PNG** or **SVG** graphic.
  The journey is now Create → Simulate → Experience → Create Content →
  Storyboard → **Export**. Public sharing remains a later, separately approved
  checkpoint.
- The authority boundary gains a third clause: **Core decides what happened,
  Creator/Media decides how it is presented, Export renders that presentation.**
  Export never recalculates a winner, alters rankings, edits events, rewrites Run
  snapshots, or reads a live Entity/Simulation. It consumes immutable artifact
  truth only; version N always renders as version N.
- The renderer is a generic, product-neutral pipeline (Anything Wars is merely
  the first producer): `MediaArtifactVersion → buildResultGraphic()` →
  validated bounded `ResultGraphicV1` → pure deterministic `renderResultGraphicSvg()`
  → SVG, then a server-only `@resvg/resvg-js` rasterizer → PNG. The render model
  and SVG renderer are isomorphic, so the Studio live preview is byte-identical
  in design to the download.
- Two export types: **RESULT_CARD** (winner/tie headline, winner initials,
  detail line, top-3 ranking, branding) and **STORY_POSTER** (creator title, 2–4
  enabled storyboard moments, authoritative result strip). Formats: **PNG** and
  **SVG** (no JPEG/PDF/video). Three social ratios map to exact pixels —
  `LANDSCAPE_16_9` 1920×1080, `PORTRAIT_9_16` 1080×1920, `SQUARE_1_1` 1080×1080 —
  and an optional request override produces any ratio from one artifact. No
  client-supplied dimensions are ever accepted.
- **SVG safety:** every creator/Run-derived string passes through `escapeXml`
  before entering markup; participant colors are validated to strict hex with a
  brand fallback; `<script>…` and `"><image href="file:///…">` render as inert
  text. Previews load the SVG through an `<img>` (no script execution) and the
  endpoint sends `X-Content-Type-Options: nosniff`.
- **Participant imagery** is deterministic initials + brand color in v1;
  **no remote participant image is ever fetched** (no SSRF surface). Safe
  embedding of immutable images is a documented future enhancement.
- **Permissions/isolation:** reuses `media.view` (no new permission). The service
  loads the artifact via the workspace-scoped `getMediaArtifact`, so foreign
  artifacts return a safe NotFound; the route authenticates via
  `requireApiContext`. `GET /api/media/artifacts/[artifactId]/export?version&type&format&ratio`
  streams the file with correct `Content-Type`, attachment `Content-Disposition`
  and a safe slug filename (e.g. `lion-vs-robot-result-card-v3-vertical.png`).
- **Boundaries:** rendering is synchronous and bounded (capped SVG size, preset
  dimensions only); there is deliberately **no** `MediaExportJob` queue, no binary
  storage, and **no audit event** for this read-only, repeat-clickable action
  (documented decision, consistent with the "significant mutations" audit model).
  `next.config.ts` lists `@resvg/resvg-js` in `serverExternalPackages`; it is
  dynamically imported and never enters the client bundle. No Prisma schema,
  Runtime Protocol v1, Core, module or storyboard-foundation change.

## Creator / Media Platform — Public / Unlisted Sharing v1

- Adds the **Share** layer, completing the first full creator loop: **Create →
  Simulate → Experience → Create Content → Export → Share**. Sharing is always an
  explicit creator action; the default for everything stays PRIVATE.
- `MediaShare` is one row per artifact (`artifactId @unique`) that pins **one
  immutable `MediaArtifactVersion`** and carries a `visibility`
  (PRIVATE | UNLISTED | PUBLIC), a stable high-entropy `publicId`
  (`randomBytes(16).toString("base64url")`), and an optional `titleOverride`.
  Visibility is the single source of truth for public access. A share never makes
  the pinned version mutable; editing the artifact (a new version) never changes
  an active share — the creator repoints it deliberately.
- Privacy semantics: **PRIVATE** = workspace-only, no public link; **UNLISTED** =
  anyone with the link may view (page served `noindex, nofollow`; it is *not*
  authentication); **PUBLIC** = anyone may view and the page may be indexed
  (future Explore eligible — Explore itself is not built).
- New central permission **`media.share`** → OWNER/ADMIN/CREATOR (mirrors
  `media.create`). Reading share state uses `media.view`; mutations use
  `media.share`, enforced server-side with workspace-scoped safe NotFound.
- Authorized API `GET|POST|DELETE /api/media/artifacts/[artifactId]/share` and a
  Studio **Sharing** panel (visibility radio, version selector, optional public
  title, copy-link/open/revoke). Changing the artifact's current version never
  silently moves an existing share.
- Public, unauthenticated viewer at **`/s/[publicId]`** — outside the proxy
  matcher, rendered without the platform shell. It resolves only active
  UNLISTED/PUBLIC shares of non-archived artifacts via a separate
  `getPublicMediaShare` service; PRIVATE, revoked, archived and unknown ids all
  return a safe 404 that hides prior existence. A public image endpoint
  **`/s/[publicId]/image`** reuses the Image/Post Export render (same design,
  `no-store` so revocation is immediate) and backs `og:image`.
- Strict **`PublicMediaShareV1`** projection, resolved entirely to safe display
  values: title/subtitle/description, mode + module label, authoritative result
  (headline/detail/completion/winner & tie **names**/ranking), participant display
  identity (name, category, hex color, initials), and enabled scenes. It never
  contains `runParticipantId`, `sourceEntityId`, workspace/member ids, the source
  Run id, the seed, raw events, audit or permission data.
- Lifecycle: `media.share.created/updated/revoked` audits (small metadata only).
  Revoke sets PRIVATE (immediate 404). **Archiving an artifact suspends its
  share; restoring does not auto-republish** (plus a defense-in-depth status
  check at resolve time). All creator text is rendered as React/escaped text
  (no `dangerouslySetInnerHTML`); participant colors are validated hex.
- Deliberate non-goals: no Explore/discovery, Creator Profiles, following,
  likes/comments, external social-platform publishing, view counts, monetization,
  rate limiter (none exists) or moderation console, and no Video Studio. A
  moderation foundation is documented as a prerequisite before broad public
  launch. No Core, module, Runtime Protocol, Export-render or Foundation change.

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
- Web Phase 2 direct `npx vitest run` passed **254 tests in 24 files**, preserving
  all 242 Asset Library tests and adding 12 World service tests for CRUD,
  discovery, authorization, workspace isolation, immutable versions,
  archive/restore, status transitions, Asset/Entity associations, invalid
  references, zones/spawns, Simulation bindings, legacy definitions and frozen
  Run snapshots. `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`,
  `npx next build`, and `git diff --check` passed. Prisma Client v7.10.0 was
  regenerated successfully.
- Web Phase 3 direct `npx vitest run` passed **268 tests in 25 files**, preserving
  all 254 World Blueprint tests and adding 14 Experience Profile/service and
  permission checks for CRUD, discovery, authorization, workspace isolation,
  immutable versions, deterministic hashing, archive/restore, status
  transitions, event/cue/condition bounds, Asset/Entity/World references,
  presets, Simulation bindings, legacy definitions and immutable Run snapshots.
  `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`, `npx prisma
  generate`, `npx next build`, and `git diff --check` passed. Prisma Client
  v7.10.0 was regenerated successfully; the build used network access only for
  the repository's existing Google Fonts.
- Web Phase 4 direct `npx vitest run` passes **281 tests in 26 files**, preserving
  all 268 Experience Profile tests and adding 13 Tournament service/adapter
  integration tests for CRUD, authorization, tenant isolation, participant
  validation, manual/random seeding, arbitrary elimination fields, BYEs,
  duplicate-generation protection, odd round robin scheduling, lifecycle
  locking, pause/resume/cancel, normal Battle Run integration, World/Experience
  inheritance, frozen template/result history, replay/blocked tie policies,
  standings/scoring and invalid result mappings. `npx tsc --noEmit`, `npx eslint
  .`, `npx prisma validate`, `npx prisma generate`, `npx next build`, and `git
  diff --check` pass. Prisma Client v7.10.0 regenerates successfully.
- Web Phase 5 direct `npx vitest run` passes **299 tests in 28 files**, preserving
  all 281 Tournament baseline tests and adding 18 Race module and persisted Run
  integration tests for config/stat validation, deterministic fixed-tick
  execution, two-person and multi-participant Sprint, Circuit laps, attribute
  effects, bounded RNG, checkpoints, lead changes, exact ties, precise finish
  ordering, timeout/DNF ranking, event/result schemas, replay, pause/resume,
  immutable snapshots, workspace boundaries, World/Profile bindings and
  head-to-head Tournament round robin. `npx tsc --noEmit`, `npx eslint .`,
  `npx prisma validate`, `npx prisma generate`, `npx next build`, and `git diff
  --check` pass. Prisma Client v7.10.0 regenerates successfully.
- Web Phase 6 direct `npx vitest run` passes **318 tests in 30 files**, preserving
  all 299 Race baseline tests and adding 19 Survival module and persisted Run
  integration tests for configuration/stat validation, two-person and
  multi-participant execution, Last Standing, Endurance, resources, every stat
  role, bounded hazards/Luck/recovery, elimination and all-eliminated ties,
  ranking, event/result contracts, deterministic replay, disabled-randomness RNG
  behavior, pause/resume parity, immutable Entity/World/Profile snapshots,
  Experience compatibility, workspace isolation and head-to-head Tournament
  round robin. `npx tsc --noEmit`, `npx eslint .`, `npx prisma validate`, `npx
  prisma generate`, `npx next build`, and `git diff --check` pass. Prisma Client
  v7.10.0 regenerates successfully. No schema or Runtime Protocol v1 file changed.
- Anything Wars v0 direct `npm test` passes **325 tests in 32 files**, preserving
  all 318 Survival baseline tests and adding seven product contract/service
  integration tests for supported and future modes, module participant limits,
  product result/replay/rematch routing, generic Simulation creation and config,
  World/Profile pinning, immutable Run creation, workspace isolation, read-only
  permissions, safe non-product lookup, foreign binding rejection, Run Again and
  Rematch historical non-mutation. `npx tsc --noEmit`, `npx eslint .`, `npx
  prisma validate`, `npm run build`, and `git diff --check` pass. No Prisma schema,
  Runtime Protocol v1 or mechanics file changed.
- An isolated local HTTP walkthrough created canonical project/competitor data,
  completed real Battle, Race and Survival Runs through the same APIs used by
  the product, rendered each product event/result route, and opened the completed
  Battle 3D replay route. A two-competitor single-elimination Tournament generated
  its structure, became ready, ran its authoritative Match, completed and recorded
  a champion on the product detail page. Race and Survival exposed no fake Watch
  action. The disposable QA database was removed afterward.
- Beginner Experience v1 automated gates (direct): `npx vitest run` passes
  **334 tests in 33 files**, preserving all 325 Anything Wars v0 baseline tests
  and adding 9 — three Quick War service integration tests (canonical
  started-run composition and participants; executable defaults for all three
  modes with a single reused organizer project; foreign-competitor and read-only
  rejection before any product record is created, plus immutable-snapshot
  non-mutation) and six `src/lib` unit tests (Create catalog contract: live
  routes, future-card non-interactivity, permission gating; Quick War mode/
  distinctness validation, canonical defaults, and naming; the `quick` href).
  `npx tsc --noEmit`, `npx eslint .`, and `npx prisma validate` are clean.
  `npx next build` succeeds and emits artifacts for the new `/create`,
  `/anything-wars/quick`, and `/api/anything-wars/quick` routes. `git diff
  --check` passes with only Git's expected LF-to-CRLF working-copy notices. No
  Prisma schema, Runtime Protocol v1, or mechanics file changed.
- Headless-browser QA of the Beginner Experience was performed in a later
  session against an **isolated throwaway SQLite database** and a disposable
  Chrome profile on an isolated server on port 3021 — never the development
  database, which was verified byte-for-byte unchanged (same SHA-256 before and
  after). At 390 / 768 / 1024 / 1440 px the `/create` gateway and Quick War
  showed a single `<h1>`, correct heading order, no document horizontal overflow,
  and all preview copy, permission, and focus checks. A full Quick War was
  completed for all three executing modes: Battle surfaced **Watch Replay** while
  Race and Survival correctly did not; the result banner, tie copy
  ("… Share the Win!"), and the Run Again / Rematch / Change Competitors / New
  War actions all resolved, and Run Again created a new Run without mutating the
  prior one. No JavaScript exceptions, console errors, or server 500s occurred
  during the flow (the only logged network events were expected `ERR_ABORTED`
  request cancellations during browser teardown). The only clipped-looking
  content was the Simulation card's decorative mini-preview inside its own card,
  which causes no page scroll. All disposable QA artifacts (script, database,
  server log, screenshots, Chrome profile) were removed afterward.
- Accessibility follow-up fix (current change set): the `(auth)` layout rendered
  `<Logo>` — which is itself a `<Link href="/">` — inside another
  `<Link href="/">`, an invalid nested anchor. It now uses `<Logo asStatic />` so
  the auth header mark is a non-navigating glyph inside the existing link.
  `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` (**334 tests in 33
  files**), `npx next build`, `npx prisma validate`, and `git diff --check` all
  pass with this change applied.
- Responsive closure (current change set): the `/dashboard` audit exposed
  implicit auto-sized grid columns below the `sm`/`lg` breakpoints. The Recent
  Anything Wars and lower activity/product grids now explicitly use a
  `grid-cols-1` mobile track; lower grid items are `min-w-0`. This constrains the
  page to the available viewport without changing content or navigation. A real
  Chrome rerun at 390 / 768 / 1024 / 1440 px, in desktop and mobile emulation,
  reported zero document overflow and zero overflow offenders for Dashboard;
  `/create` retained zero document overflow and the browser reported no console
  errors. The only out-of-bounds Create geometry remains decorative artwork
  clipped inside its own preview card.
- Image / Post Export v1 automated gates (direct): `npx vitest run` passes
  **373 tests in 38 files**, preserving the 350 Creator/Media Foundation baseline
  and adding 23 — pure render-model tests (schema-valid models for
  battle/race/survival, verbatim winner/tie/ranking, historical participant
  names, bounded ordered poster highlights, color/initials safety, aspect→pixel
  maps), pure SVG tests (valid root, exact dimensions, determinism, `escapeXml`,
  script- and attribute-breakout injection rendered inert, bounded size) and
  DB-backed export-service tests (real PNG signature + exact dimensions via the
  native rasterizer, SVG content type + safe filename, ratio/type overrides,
  rejected formats/types, unknown version, workspace-viewer allowed vs foreign
  NotFound, and version-1 output stable across a version-2 edit). `npx tsc
  --noEmit`, `npx eslint .`, `npx prisma validate` and `npx next build` all pass;
  one new dependency (`@resvg/resvg-js`) was added to `package.json` +
  `package-lock.json` and `serverExternalPackages`.
- Headless-browser + HTTP QA was performed against an **isolated `next start`
  server on port 3025 over a disposable seeded database** (a session row seeded
  directly; no dev data touched). Real HTTP export checks confirmed: PNG/SVG
  downloads for Result Card + Story Poster across Landscape/Vertical/Square and
  a historical version, each with the correct `Content-Type`,
  `Content-Disposition` filename, `Content-Length`, `nosniff`, valid PNG
  signatures and exact pixel dimensions; and the negative cases — no-cookie
  **401**, foreign/unknown-artifact **404**, unknown version **404**, bad
  format/type **400**. Headless Chrome (CDP) loaded `/studio/[artifactId]` at
  **390 / 768 / 1024 / 1440 px** with a seeded session: zero horizontal overflow
  at every width, the "Preview & export" panel and Download control present, and
  the shared SVG preview `<img>` actually loaded (preview === export). The
  rendered PNGs were visually reviewed for all type × ratio combinations. All
  disposable QA artifacts (server, seeded DB, scripts, Chrome profile,
  screenshots, downloads) were removed before review.
- Public / Unlisted Sharing v1 automated gates (direct): `npx vitest run` passes
  **384 tests in 39 files** (373 Export baseline + 10 new share-service tests + 1
  new permission test). The share tests cover creation and the stable public id,
  public resolution (UNLISTED/PUBLIC resolve anonymously; PRIVATE, revoked,
  unknown and archived do not), version pinning + repoint, archive-suspends /
  restore-does-not-republish, Creator-may-share vs Editor/Viewer denied, foreign
  workspace isolation, invalid version + archived rejection, the public image
  signature, the public projection excluding every internal identifier, and
  creator markup remaining inert plain text (escaped in the render). `npx tsc
  --noEmit`, `npx eslint .`, `npx prisma validate`, `npx prisma generate` and
  `npx next build` all pass; the build emits the new `/s/[publicId]`,
  `/s/[publicId]/image` and `/api/media/artifacts/[artifactId]/share` routes. No
  new dependency was added.
- Isolated-server + HTTP + headless-Chrome QA (disposable seeded DB on port 3025;
  a session row seeded directly; dev data untouched). HTTP checks confirmed, over
  real requests: an anonymous PUBLIC page resolves (200, `index, follow`, no
  platform shell) and leaks **no** workspace / Run / Entity / runParticipant ids;
  its image endpoint returns a valid `no-store` PNG; an UNLISTED page is
  `noindex`; revoked, unknown-id and archived pages (and their image endpoints)
  return **404**; repointing to version 2 (authed) updates the anonymous page;
  revoking (authed) makes it **404 immediately**; and an anonymous `/studio`
  request is redirected (307). Headless Chrome then loaded the **anonymous**
  public page at **390 / 768 / 1024 / 1440 px**: zero horizontal overflow, the
  hero render image loaded, the result / storyboard / ranking / competitors and
  "Create your own" CTA rendered, and no platform sidebar appeared. Screenshots
  were visually reviewed. All disposable QA artifacts were removed before review.

## Known limits

- Public / Unlisted Sharing v1 is SIMVERSE-hosted link sharing only. It does
  **not** provide Explore / discovery / search, Creator Profiles or public creator
  identity (the page shows only "Created in SIMVERSE"), following / likes /
  comments / notifications, external social-platform publishing, view counts /
  analytics, monetization, a rate limiter (no such infrastructure exists yet) or a
  moderation console. One share per artifact; the `publicId` is stable (re-sharing
  reuses it) — link rotation and safe participant-image embedding are future
  follow-ups. A moderation foundation is a prerequisite before broad public launch.
- Image / Post Export v1 renders real **PNG/SVG** result cards and story posters
  from saved storyboards, but it does **not** render video/MP4, mix audio,
  generate AI direction, embed remote participant imagery, or store binary media.
  Only completed `battle-v1`, `race-v1` and `survival-v1` Runs have storyboard
  adapters, so only those export. Deterministic initials/color stand in for
  participant portraits in v1.
- Creator / Media Foundation v1 creates validated storyboard metadata. Historical
  versions are listed in the v1 editor and can be exported individually; a
  dedicated previous-version on-screen viewer can be added when needed.
- Tournament System v1 supports Entity participants, single elimination and one
  round-robin cycle with Battle duel, head-to-head Race or head-to-head Survival
  Matches. It does not yet implement multi-participant Race/Survival Matches, Teams,
  ranked seeding, double elimination, Swiss, group stages, seasons, per-Match
  World/Profile overrides, automated scheduling, bulk Run Round, or a
  Tournament-wide runtime/presentation protocol. Future module integrations
  require a reviewed result adapter; they do not belong in Tournament Core.

- Experience Profiles v1 store validated presentation direction and immutable
  references. They do not render effects, mix audio, schedule a cinematic
  timeline, resolve engine clips, or change the current Web Viewer. Battle, Race
  and Survival event vocabularies are supported; later modules must add their own
  reviewed authoritative event vocabulary and presentation mappings.
- Asset Library v1 manages metadata, immutable versions and safe references. It
  does not upload or host binaries, provide a CDN/marketplace, optimize content,
  generate Draco/Meshopt/KTX2/LODs, or provide final production models.
- World Blueprint Creator v1 manages validated definitions and immutable
  relationships. It does not render, generate terrain, stream a live World,
  automatically spawn associated Entities, or provide an Unreal/Three.js World
  adapter. Asset and Entity selection lists are currently bounded to 100 active
  records per designer load; library discovery remains paginated.
- Remote model inspection depends on CORS, and file-size reporting depends on
  HEAD support. Supported runtime containers are GLTF/GLB. The validation
  summary is deliberately practical rather than a full DCC-grade rig auditor.
- Visual snapshots preserve metadata and URL identity, not the bytes behind a
  mutable URL. Asset Library IDs and versions now exist, but wiring them into a
  future snapshot/protocol version is intentionally deferred so Runtime Protocol
  v1 and existing Runs remain unchanged. Use content-addressed or versioned URLs.
- Battle remains the only 3D Viewer adapter. Race and Survival have authoritative
  progress/status/result UI; they do not fabricate 3D playback. Viewer playback still
  consumes completed saved Runs rather than streaming live simulation.
- No high-fidelity runtime, Unreal project/parser, public runtime session
  endpoint, production character pipeline, World runtime, cloud-streaming
  deployment or live event transport exists yet. Animation Studio, Video
  Studio, additional modules, and new Battle or Race rules remain future work.

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
LAST COMPLETED (COMMITTED):
  Public / Unlisted Sharing v1
  current HEAD — feat: add SIMVERSE public sharing v1
  (builds on Image / Post Export v1 b7a1693 and Creator / Media Foundation v1 5012b33)

COMMITTED HANDOFF CHECKPOINT:
  current HEAD — feat: add SIMVERSE public sharing v1

CHECKPOINT STATUS:
  STATUS: PUBLIC / UNLISTED SHARING v1 COMPLETE AND CHECKPOINTED
  GATES: vitest 384/39, tsc, eslint, prisma validate/generate, next build, diff --check — all pass
  QA: isolated-server HTTP (anon resolve, 404 cases, no-leak, pinning, repoint,
      revoke→404) + headless-Chrome ANONYMOUS public page at 390/768/1024/1440;
      screenshots visually reviewed
  SCOPE: version-pinned PRIVATE/UNLISTED/PUBLIC sharing of immutable artifact
         versions; safe public projection + public viewer; no new dependency
  FIRST PUBLIC SURFACE: /s/[publicId] is SIMVERSE's first unauthenticated content
         surface; rate-limiting + moderation are documented pre-launch prerequisites

PAUSED PARALLEL TRACK:
  Phase 7A-B — Unreal Runtime Bootstrap
  STATUS: PAUSED DUE TO EXTERNAL D: STORAGE INSTABILITY / DISK EVENT 51

NEXT ACTION:
  Owner review. The first full creator loop (Create → Simulate → Experience →
  Create Content → Export → Share) now exists end-to-end. SIMVERSE is still NOT
  ready for broad public release (needs asset pipeline, templates, account
  lifecycle hardening, production infra, moderation foundations, richer worlds/3D).
  Likely next social-layer checkpoints — each separately approved, do NOT start
  automatically — are Creator Profiles and Explore, which must build on this
  version-pinned public-safe projection. Small follow-ups: share-link rotation,
  safe participant-image embedding, a previous-version viewer. Two untracked
  docs/*.png vision images remain owner-controlled. Do not access D: or resume
  Unreal work until the external storage is stable.
```
