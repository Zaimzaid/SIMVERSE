# SIMVERSE — Phase 7A-B Unreal Runtime Bootstrap

> **Status:** Waiting for Unreal Engine installation. This is an implementation
> plan only. No Unreal repository, project, source, or generated file exists yet.
>
> **Platform checkpoint:** `5687430 feat: add SIMVERSE runtime protocol v1`

## A. Purpose

Phase 7A-B proves that a separate Unreal runtime can consume
`SimulationRuntimePackageV1`, validate the frozen Runtime Protocol v1 contract,
replay its persisted events in order, and reproduce the authoritative terminal
result. The bootstrap uses the three committed protocol fixtures and placeholder
presentation in a minimal local Windows C++ runtime.

The proof is complete when Unreal parses and validates all three fixtures,
spawns placeholder participants, presents every event in sequence, and reports
the same participant identities, event count, final sequence, completion reason,
winner or ties, ranking, and elimination order as the package.

## B. Authority boundary

SIMVERSE Core and Simulation Modules decide simulation truth. They own actions,
state, seeded RNG, targets, damage, dodges, critical hits, eliminations, timing,
rankings, and results. Runtime Protocol v1 transports immutable completed truth.

Unreal is a downstream presentation runtime. It may schedule playback, spawn
visual actors, select saved semantic animation mappings, and present camera,
HUD, audio, and effects. It must never rerun Battle mechanics, choose a target,
calculate damage, change event order, select a winner, or mutate a Run.

## C. Runtime Protocol v1 to Unreal C++ type map

All top-level fields are required. A field declared nullable by the protocol is
still a required JSON key whose value may be `null`. Blueprint-visible nullable
values should use an explicit presence flag plus the value because reflected
`TOptional` support is limited.

| Protocol section | Proposed Unreal representation | Required shape and handling |
| --- | --- | --- |
| Package | `USTRUCT(BlueprintType) FSimverseRuntimePackageV1` | `PackageType`, `ProtocolVersion`, `Run`, `Module`, `Versions`, `SeedProvenance`, `Participants`, nullable `World`, `Events`, `Result`, and `Presentation`. Require `SimulationRuntimePackageV1` and protocol `1.0.0`. |
| Run | `FSimverseRuntimeRunV1` | Run ID, simulation ID/name, status `COMPLETED`, mode `battle`, three ISO timestamps, fixed step, total ticks, and simulated duration. Preserve timestamp text and validate chronology. |
| Module | `FSimverseRuntimeModuleV1` | Require ID `battle` and version `battle-v1`. |
| Version provenance | `FSimverseRuntimeVersionsV1` | Require Core `core-v0.1`, RNG `mulberry32-v1`, input snapshot `1`, and result envelope `1`. |
| Seed provenance | `FSimverseSeedProvenanceV1` | Preserve the resolved seed as an opaque `FString`; require source `RUN_INPUT_SNAPSHOT`. Unreal does not use it to rerun RNG. |
| Participant | `FSimverseRuntimeParticipantV1` | Run participant ID, contiguous zero-based position, source Entity ID, nullable role, identity, and nullable visual snapshot. The participant array contains 2–500 unique participants. |
| Identity | `FSimverseParticipantIdentityV1` | Display name and category; nullable short name, image reference, primary color, and secondary color. |
| Visual snapshot | `FSimverseVisualSnapshotV1` | Snapshot version `1`, positive profile revision, source type, archetype, nullable portrait/model references, transform, and partial animation mapping. |
| Visual transform | `FSimverseVisualTransformV1` | Finite scale, XYZ rotation in degrees, and XYZ offset in meters. Convert meters to Unreal centimeters in one adapter while retaining source values for diagnostics. |
| Animation mapping | `TMap<ESimverseAnimationState, FString>` | A partial map from the canonical semantic states to non-empty clip names. Convert JSON strings explicitly rather than serializing enum ordinals. |
| World binding | `FSimverseWorldBindingV1` plus `bHasWorld` | Entire binding is nullable. When present, require World ID/version, manifest reference, `sha256:` content hash, and nullable spawn set/environment preset. Phase 7A-B validates and reports it only. |
| Event envelope | `FSimverseRuntimeEventV1` | Event ID, positive sequence/tick, nonnegative simulated time, nullable actor and target IDs, type, payload version `1`, and one typed Battle payload. Preserve array order. |
| Battle payload union | Nine `FSimverseBattle…PayloadV1` structs with a discriminant | Keep payloads typed. A C++ tagged union or a Blueprint-friendly discriminant with dedicated payload members avoids repeated raw JSON parsing. |
| Result envelope | `FSimverseRuntimeResultV1` | Envelope version `1`, type `battle.result`, summary, metric map, payload version `1`, and the exact Battle result. |
| Generic result metric | `FSimverseMetricValueV1` | Tagged string, finite number, or boolean value, stored in `TMap<FString, FSimverseMetricValueV1>`. |
| Battle result | `FSimverseBattleResultV1` | Version, format, completion reason, nullable winner, tie IDs, ranking, elimination order, total ticks, simulated duration, and participant metrics. |
| Participant metrics | `FSimverseBattleParticipantStateV1` | Participant ID/position, Battle profile, health, alive/defending flags, nullable elimination tick, damage totals, attacks, critical hits, dodges, and defends. |
| Presentation | `FSimversePresentationMetadataV1` | Profile version `1`, display title, nullable theme color, show-labels flag, and show-leaderboard flag. |

Proposed enum types:

- `ESimverseVisualSourceType`: `IMAGE`, `MODEL_3D`, `PROCEDURAL`, `SPRITE`,
  `ANIMATED_SPRITE`, `GENERATED_3D`.
- `ESimverseVisualArchetype`: `HUMANOID`, `QUADRUPED`, `CREATURE`, `ROBOT`,
  `VEHICLE_GROUND`, `VEHICLE_AIR`, `VEHICLE_WATER`, `OBJECT`, `ABSTRACT`,
  `CUSTOM`.
- `ESimverseAnimationState`: `IDLE`, `WALK`, `RUN`, `TURN`,
  `ATTACK_PRIMARY`, `ATTACK_SECONDARY`, `DEFEND`, `DODGE`, `HIT_LIGHT`,
  `HIT_HEAVY`, `DEFEATED`, `VICTORY`, `INTRO`, `SPECIAL`, `STUNNED`, `JUMP`,
  `LAND`, `FLY`, `SWIM`, `EMOTE`.
- Separate enums for supported event type, Battle format, completion reason,
  visual source, archetype, and metric value kind.

JSON loading and validation requirements:

1. Parse UTF-8 with Unreal's `Json` module and explicit field readers.
2. Reject missing required keys and unknown keys like the canonical strict Zod
   objects.
3. Distinguish missing values from required keys containing JSON `null`.
4. Validate finite integral JSON numbers before conversion to `int32` or
   `int64`.
5. Keep protocol IDs as case-preserving `FString`, not normalized `FName`.
6. Reject unsupported package, protocol, module, payload, Core, RNG, input, and
   result versions before dispatch.
7. Enforce unique participant/event IDs, contiguous positions and sequences,
   monotonic event time, known actor/target references, Run timing bounds, one
   terminal completion event, complete result lists, and result/event parity.
8. Reject credential-bearing asset and World references in the same cases as
   the Platform validator.
9. Preserve fixture JSON with LF endings so manifest SHA-256 values remain
   stable.

## D. Exact Battle event handler map

Every supported event has `payloadVersion: 1`. The event envelope always
contains actor and target keys, but the protocol represents both as nullable.
The actor/target expectations below reflect the actual Battle v1 producer.

| Event type | Exact payload | Actor/target expectation | Unreal presentation responsibility | Parity responsibility |
| --- | --- | --- | --- | --- |
| `battle.started` | `format`: `"duel"` or `"free_for_all"`; `maxTicks`: positive integer; `participantIds`: string array | Actor null; target null | Initialize participant registry, placeholders, HUD, labels, and timeline. | Must be first. Participant IDs must uniquely match the package participants. |
| `battle.attack` | `baseDamage`, `finalDamage`, `targetHealthBefore`, `targetHealthAfter`: nonnegative integers; `critical`, `dodged`, `guarded`: booleans | Actor present; target present | Play the actor's `ATTACK_PRIMARY` semantic cue and stage presentation from saved flags. | Consume saved values. Never calculate hit chance, guard, critical chance, or damage; do not apply damage twice when `battle.damage` follows. |
| `battle.defend` | `health: nonnegative integer`; `duration: "until_next_action_or_hit"` | Actor present; target null | Play `DEFEND` and retain its visual cue until the recorded next action or hit. | Preserve saved health and duration; do not calculate protection. |
| `battle.dodged` | `targetHealth: nonnegative integer` | Actor present; target present | Play `DODGE` on the target and present a miss/evasion cue. | Preserve the recorded target health; do not infer damage. |
| `battle.critical_hit` | `finalDamage: nonnegative integer` | Actor present; target present | Play deterministic critical-hit VFX/audio emphasis. | Treat critical status and final damage as recorded facts. |
| `battle.damage` | `amount`, `healthBefore`, `healthAfter`: nonnegative integers; `guarded: boolean` | Actor present; target present | Play a configured hit reaction and set the HUD to exact `healthAfter`. | Validate and report the saved health transition without a damage formula. |
| `battle.eliminated` | `eliminationTick`, `eliminationRank`: positive integers | Actor present; target present | Play `DEFEATED`, make the target presentation-terminal, and update standings. | Preserve exact target, tick, rank, and elimination order. |
| `battle.timeout` | `maxTicks: positive integer`; `survivors: nonnegative integer` | Actor null; target null | Show the time-limit cue and stop normal action presentation. | Preserve timeout facts; never select the winner locally. |
| `battle.completed` | `completionReason`: `"KNOCKOUT"` or `"TIME_LIMIT"`; `winnerRunParticipantId`: string or null; `tiedParticipantIds`: string array; `ranking`: string array | Actor null; target null | Present the terminal ranking/result screen and `VICTORY` for a recorded winner. | Must be the only final completion event and exactly match the authoritative result. |

## E. Canonical fixture parity expectations

The Unreal repository should carry pinned copies of the committed fixtures and
manifest from `protocol/runtime/v1/fixtures/`. They remain ordinary Git text
files and retain LF line endings.

| Fixture | Participants | Events | Completion | Winner/ties | Ranking | Eliminated participants | Final sequence | SHA-256 |
| --- | ---: | ---: | --- | --- | --- | --- | ---: | --- |
| `duel-knockout.json` | 2 | 18 | `KNOCKOUT` | `participant-lion`; no ties | lion, tiger | tiger | 18 | `4a10f1ab95ffe0b7ff412f8d129adb96c953f752ccd78b982a9a633241c43923` |
| `duel-time-limit.json` | 2 | 6 | `TIME_LIMIT` | `participant-falcon`; no ties | falcon, hawk | none | 6 | `319302c51290766e50859671c26a46e3b9f53dbea4f3da7073f0c874d50464b0` |
| `four-player-free-for-all.json` | 4 | 81 | `KNOCKOUT` | `participant-orb`; no ties | orb, car, mage, robot | robot, mage, car | 81 | `537fbb17f3e174843256c011cb601cf416974bbb55fbb51fda1a9b18948b3f0b` |

Expected parity for every fixture is a successful strict parse followed by an
exact match of participant IDs, event count and order, final sequence,
completion reason, winner/ties, ranking, and elimination order. The bootstrap
may vary presentation timing and visuals, but it may not vary these facts.

## F. Proposed runtime repository

The separate private repository should be created at:

```text
D:\SIMVERSE\SIMVERSE-RUNTIME
```

Recommended initial structure:

```text
SIMVERSE-RUNTIME/
├── .gitattributes
├── .gitignore
├── README.md
├── THIRD_PARTY_NOTICES.md
├── SIMVERSERuntime.uproject
├── Config/
│   ├── DefaultEditor.ini
│   ├── DefaultEngine.ini
│   └── DefaultGame.ini
├── Content/
│   └── Bootstrap/
│       ├── Maps/
│       ├── Materials/
│       └── UI/
├── Fixtures/
│   └── RuntimeProtocol/
│       └── v1/
│           ├── manifest.json
│           ├── simulation-runtime-package.schema.json
│           ├── duel-knockout.json
│           ├── duel-time-limit.json
│           └── four-player-free-for-all.json
├── Scripts/
│   ├── Build.ps1
│   ├── RunAutomation.ps1
│   └── RunFixture.ps1
├── Source/
│   ├── SIMVERSERuntime.Target.cs
│   ├── SIMVERSERuntimeEditor.Target.cs
│   └── SIMVERSERuntime/
│       ├── SIMVERSERuntime.Build.cs
│       ├── Public/
│       │   ├── RuntimeProtocol/
│       │   ├── Playback/
│       │   └── Presentation/
│       └── Private/
│           ├── RuntimeProtocol/
│           ├── Playback/
│           ├── Presentation/
│           └── Tests/
└── docs/
    ├── ARCHITECTURE.md
    └── PROTOCOL_CONFORMANCE.md
```

Responsibilities:

- `RuntimeProtocol`: types, JSON loader, version dispatch, and validation.
- `Playback`: saved-time scheduler, event cursor, participant registry, pause,
  reset, and completion state.
- `Presentation`: placeholder actors, semantic cues, HUD, camera, and developer
  diagnostics.
- `Tests`: Unreal Automation Tests for parsing, rejection, ordering, and parity.
- `Fixtures`: pinned Runtime Protocol v1 conformance inputs and provenance.
- `Content/Bootstrap`: only the minimal level, materials, and UI required for
  placeholder playback.
- `Scripts`: reproducible project-generation, build, test, and launch commands.
- `docs`: runtime-local architecture and protocol conformance notes.

## G. First C++ types and classes

| Type or class | Purpose | Dependencies | Authority boundary |
| --- | --- | --- | --- |
| `FSimverseRuntimePackageV1` and nested structs | Exact in-memory Runtime Protocol v1 representation. | `Core`, `CoreUObject` | Data only; no file I/O, mechanics, spawning, or asset resolution. |
| `FSimverseRuntimePackageJsonLoaderV1` | Read UTF-8 JSON and populate typed protocol values with useful path-specific errors. | `Core`, `Json` | No fallback guesses, downloads, event generation, or package repair. |
| `FSimverseRuntimePackageValidatorV1` | Enforce strict shapes, bounds, versions, identities, ordering, references, timing, and result parity. | Protocol structs, `Core` | Reject invalid input; never correct or recompute it. |
| `USimverseRuntimePlaybackSubsystem` | Own the accepted package, playback clock, event cursor, participant registry, pause/reset, and typed dispatch. | `Engine` | Replays the saved order; no RNG, targeting, damage, ranking, or Run mutation. |
| `ASimversePlaceholderParticipantActor` | Display an original placeholder for one participant and expose semantic presentation hooks. | `Engine` | No AI, health authority, collision outcome, or mechanics state. |
| `USimverseBattleEventPresenter` | Map typed Battle events to placeholder animation, HUD, camera, VFX, and audio requests. | Playback and presentation types | Presentation only; no Battle decisions. |
| `FSimverseRuntimeParityCheckerV1` | Collect observed playback facts and compare them with fixture expectations. | Protocol structs, `Core` | Reports differences; never rewrites fixtures or accepted results. |
| `ASimverseBootstrapGameMode` | Start the local fixture flow and coordinate placeholder spawning. | `Engine` | No auth, network session, asset service, general World system, or cloud runtime. |
| `ASimverseDeveloperHUD` | Show protocol version, fixture, tick, sequence, participant status, validation errors, and terminal result. | `Engine` HUD drawing | Diagnostics only; no authoritative state. |

The first module should depend only on `Core`, `CoreUObject`, `Engine`, and
`Json` unless the installed Unreal version proves another minimal dependency is
necessary. Phase 7A-B does not require Chaos, Niagara, MetaSounds, networking,
HTTP, Pixel Streaming, or production asset systems.

## H. Planned commands

> **PLANNED ONLY — MUST BE VERIFIED AGAINST THE ACTUAL INSTALLED UE VERSION.**
>
> `UE_5.x` is a placeholder. Do not treat it as an authoritative engine minor
> version or execute these commands until the installation paths and supported
> command options are confirmed.

Shared PowerShell variables:

```powershell
$RuntimeEngineRoot = 'D:\Epic Games\UE_5.x'
$RuntimeRepoRoot = 'D:\SIMVERSE\SIMVERSE-RUNTIME'
$RuntimeProject = Join-Path $RuntimeRepoRoot 'SIMVERSERuntime.uproject'
```

Generate project files:

```powershell
& "$RuntimeEngineRoot\Engine\Build\BatchFiles\GenerateProjectFiles.bat" `
  "-Project=$RuntimeProject" `
  -Game `
  -Engine `
  -Progress
```

Build the Development Editor target:

```powershell
& "$RuntimeEngineRoot\Engine\Build\BatchFiles\Build.bat" `
  SIMVERSERuntimeEditor `
  Win64 `
  Development `
  "-Project=$RuntimeProject" `
  -WaitMutex
```

Run Runtime Protocol Automation Tests headlessly:

```powershell
$RuntimeTestReport = Join-Path $RuntimeRepoRoot 'Saved\TestReports'

& "$RuntimeEngineRoot\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" `
  $RuntimeProject `
  -Unattended `
  -NoP4 `
  -NoSplash `
  -NullRHI `
  -NoSound `
  '-ExecCmds=Automation RunTest SIMVERSE.RuntimeProtocol;Quit' `
  "-ReportExportPath=$RuntimeTestReport" `
  -Log
```

Launch the bootstrap with a package path:

```powershell
$RuntimePackage = Join-Path $RuntimeRepoRoot 'Fixtures\RuntimeProtocol\v1\duel-knockout.json'

& "$RuntimeEngineRoot\Engine\Binaries\Win64\UnrealEditor.exe" `
  $RuntimeProject `
  '/Game/Bootstrap/Maps/ProtocolBootstrap' `
  -Game `
  "-SimversePackage=$RuntimePackage" `
  -Log
```

`-SimversePackage` is a planned custom argument for the bootstrap GameMode or
playback subsystem. It does not exist yet.

## I. HDD strategy

- Install the selected Unreal Engine version on D:.
- Create `D:\SIMVERSE\SIMVERSE-RUNTIME` on D: only after the gate passes.
- Place the local Derived Data Cache on D: outside the repository, using the
  selected engine version's supported DDC configuration.
- Place packaged/cooked builds on D: outside Git, for example under
  `D:\SIMVERSE\Builds`.
- Install one pinned engine version for Phase 7A-B.
- Skip sample projects, Starter Content, Templates and Feature Packs, and large
  demonstration downloads initially.
- Skip large optional mobile, console, Linux, and other platform packs until a
  defined target needs them.
- Skip editor debug symbols initially. Add them only for a demonstrated
  engine-level debugging need.
- Ignore `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`, local IDE
  state, generated solutions, staged builds, and cooked output.
- Keep small protocol fixtures, schema, scripts, source, configuration, and
  reviewed project content in Git.
- Use Git LFS and file locking for future `.uasset`, `.umap`, large texture,
  audio, and DCC binary files.
- Keep C: available for Windows, Visual Studio, installer staging, temporary
  files, and the page file.

## J. Gate before implementation

Phase 7A-B implementation must not start until a fresh audit confirms all of
these exist and work together:

- `UnrealEditor.exe`;
- `UnrealEditor-Cmd.exe`;
- `GenerateProjectFiles.bat`;
- `Build.bat`;
- a compatible bundled .NET runtime for Unreal Build Tool;
- confirmed compatibility between the selected Unreal Engine version and MSVC
  v143 `14.44.35229`.

The gate must also record the exact installed Unreal version and root path,
confirm Windows SDK availability, confirm sufficient C: and D: free space, and
confirm `D:\SIMVERSE\SIMVERSE-RUNTIME` is still absent before repository
creation is explicitly approved.

## K. Explicit exclusions

Phase 7A-B does not include:

- a Savannah environment;
- lion or tiger production assets;
- the Phase 7B high-fidelity character system;
- general Worlds or a World runtime;
- Pixel Streaming;
- multiplayer;
- a cloud runtime;
- live simulation transport;
- public runtime-session endpoints;
- marketplace or production asset-delivery systems;
- new Battle mechanics or Runtime Protocol v1 changes.
