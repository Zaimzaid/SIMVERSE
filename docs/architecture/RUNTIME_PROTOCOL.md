# SIMVERSE Runtime Protocol

> **Status:** Phase 7A-A Platform implementation. Runtime Protocol v1 now has a
> canonical Zod validator/builder, generated JSON Schema, and three checked-in
> conformance fixtures. No public runtime endpoint or Unreal implementation
> exists yet.

## 1. Purpose

The Runtime Protocol lets multiple presentation runtimes consume one persisted,
authoritative SIMVERSE Run:

- Three.js Web Preview Viewer;
- Unreal High-Fidelity Experience Runtime;
- future video, replay and cinematic renderers.

It describes simulation truth and presentation bindings without embedding
Unreal class names, Three.js structures, database rows or mutable Entity reads.

## 2. Principles

1. **Core is authoritative.** A runtime cannot create or revise simulation facts.
2. **Completed replay first.** Protocol v1 packages a completed immutable Run.
3. **Engine-neutral semantics.** IDs, events, assets, worlds and animation states
   use SIMVERSE vocabulary.
4. **Version everything independently.** Protocol, module, snapshots, assets,
   worlds and presentation profiles evolve at different rates.
5. **Old Runs remain usable.** Package generation adapts stored historical
   snapshots into the oldest supported protocol shape or returns an explicit
   unsupported-version error.
6. **No binary payloads in Run records.** Packages reference immutable artifacts
   through manifests, hashes and scoped delivery URLs.
7. **Deterministic facts, flexible presentation.** A renderer may make bounded
   aesthetic choices without changing the event timeline or result.
8. **Fail closed on truth, degrade on presentation.** Invalid event/result
   consistency blocks playback; missing premium assets select declared fallbacks.

## 3. Package lifecycle

```text
authoritative completed SimulationRun
    → workspace-authorized package request
    → server validates stored snapshot/events/result
    → protocol adapter projects them into a canonical package
    → package and referenced manifests receive immutable versions/hashes
    → short-lived runtime session grants scoped read access
    → runtime validates before loading presentation content
    → runtime plays without mutating the Run
```

The canonical package may be serialized as JSON in v1 because completed Battle
Runs are bounded and existing Core data is JSON-shaped. A later binary encoding
may be added behind the same semantic schema if size/profile evidence justifies
it. Compression is a transport concern, not a protocol fork.

## 4. Implemented `SimulationRuntimePackageV1`

The authoritative implementation is
[`src/lib/runtime-protocol/v1.ts`](../../src/lib/runtime-protocol/v1.ts). Generated
engine-neutral artifacts live under
[`protocol/runtime/v1/`](../../protocol/runtime/v1/). The transport shape is:

```json
{
  "packageType": "SimulationRuntimePackageV1",
  "protocolVersion": "1.0.0",
  "run": {
    "runId": "run_...",
    "simulationId": "sim_...",
    "simulationName": "Lion vs Tiger",
    "status": "COMPLETED",
    "mode": "battle",
    "createdAt": "...",
    "startedAt": "...",
    "completedAt": "...",
    "fixedStepMs": 100,
    "totalTicks": 10,
    "simulatedDurationMs": 1000
  },
  "module": { "id": "battle", "version": "battle-v1" },
  "versions": {
    "coreEngine": "core-v0.1",
    "rngAlgorithm": "mulberry32-v1",
    "inputSnapshot": 1,
    "resultEnvelope": 1
  },
  "seedProvenance": {
    "resolvedSeed": "SV-ABCD2345",
    "source": "RUN_INPUT_SNAPSHOT"
  },
  "participants": [
    {
      "runParticipantId": "rp_...",
      "sourceEntityId": "entity_...",
      "position": 0,
      "role": "primary",
      "identity": {
        "displayName": "Lion",
        "shortName": "Lion",
        "category": "animal",
        "imageReference": "https://...",
        "primaryColor": "#D8A33F",
        "secondaryColor": "#4A2F1B"
      },
      "visual": {
        "snapshotVersion": 1,
        "profileRevision": 4,
        "sourceType": "MODEL_3D",
        "archetype": "QUADRUPED",
        "portraitReference": "https://...",
        "modelReference": "/models/lion.glb",
        "transform": {
          "scale": 1,
          "rotationDegrees": { "x": 0, "y": 90, "z": 0 },
          "offsetMeters": { "x": 0, "y": 0, "z": 0 }
        },
        "animationMapping": {
          "IDLE": "Idle",
          "RUN": "Run",
          "ATTACK_PRIMARY": "Bite"
        }
      }
    }
  ],
  "world": null,
  "events": [
    {
      "eventId": "event_...",
      "sequence": 1,
      "tick": 1,
      "simulatedTimeMs": 100,
      "type": "battle.attack",
      "actorRunParticipantId": "rp_lion",
      "targetRunParticipantId": "rp_tiger",
      "payloadVersion": 1,
      "payload": {
        "baseDamage": 20,
        "critical": false,
        "dodged": false,
        "guarded": false,
        "finalDamage": 20,
        "targetHealthBefore": 100,
        "targetHealthAfter": 80
      }
    }
  ],
  "result": {
    "envelopeVersion": 1,
    "type": "battle.result",
    "summary": "Lion wins by elimination.",
    "metrics": {},
    "payloadVersion": 1,
    "payload": { "version": 1, "format": "duel" }
  },
  "presentation": {
    "profileVersion": 1,
    "displayTitle": "Lion vs Tiger",
    "themeColor": null,
    "showLabels": true,
    "showLeaderboard": true
  }
}
```

The shortened result payload above is illustrative; the validator requires the
complete existing `BattleResultV1`. All output fields are required, using
explicit `null` where a visual or World binding is unavailable. Runtime URLs
should eventually be supplied through a session manifest or signed indirection
rather than permanently embedding expiring URLs in immutable Run data.

## 5. Versioning

### Protocol

- `major` changes mean incompatible semantics or required structure.
- `minor` changes add optional capabilities that old consumers may ignore.
- Every runtime declares a supported major and minor range before launch.
- The package producer never silently down-converts facts it cannot represent.

### Domain schemas

Module ID/version, participant snapshot version, each event schema version and
result schema version travel in the package. Runtime adapters dispatch on these
versions and do not infer a payload merely from a display label.

### Assets and worlds

Asset, animation profile, presentation profile and World versions are immutable
bindings. Their manifests have content hashes and supported runtime-platform/
engine-artifact variants. Expiring delivery URLs resolve those stable identities.

### Compatibility window

The Platform should retain at least one package adapter for every Run version it
still promises to replay. Removing an adapter is a product/data-retention
decision requiring migration or archival policy, not a runtime deployment side
effect.

## 6. Identity, ordering and time

- Runtime actors use `runParticipantId`, never mutable Entity names, as identity.
- `sourceEntityId` is informational lineage and must not be used to reload live
  Entity data during replay.
- `sequence` is the total event order. It is unique and strictly increasing per
  Run. Tick alone is insufficient because several events may share a tick.
- `tick` is authoritative simulation time. Presentation time is derived through
  the module/presentation adapter and may include bounded transitions that do
  not reorder facts.
- Event IDs provide idempotency for future streamed delivery.
- Seed metadata records Core replay provenance. A runtime must not rerun Core RNG
  to infer facts; any aesthetic variation uses a separately derived,
  presentation-only seed and stays inside the saved event envelope.
- The final result must reconcile with terminal state reconstructed from events
  before playback starts.

## 7. Coordinates and units

When spatial truth exists, the protocol uses:

- meters for distance;
- seconds or rational tick time for duration;
- degrees for user-authored orientation unless an exact quaternion is required;
- an explicitly declared right-handed, Y-up neutral coordinate basis for
  protocol-authored presentation coordinates;
- named zones for semantic placement where absolute coordinates are unnecessary.

Each runtime adapter performs one tested conversion into engine coordinates.
Unreal centimeters, actor transforms and object paths stay in artifact manifests
or engine code, never in Core domain events.

Battle v1 has no authoritative spatial simulation. Its runtime adapter uses
World spawn zones and saved event order to stage a visual encounter.

## 8. Event-to-presentation contract

Events remain facts. Runtime presentation is a separate interpretation layer:

```text
battle.attack(actor=Lion, target=Tiger, critical=false)
    → schedule compatible attack semantic
    → choose authored variant within profile
    → choose a valid shot
    → attach sound/VFX at an animation marker

battle.damage(target=Tiger, amount=12, healthAfter=68)
    → choose HIT_LIGHT
    → update HUD to exactly 68
    → play non-critical impact treatment
```

The runtime may decide exact clip variant, blend, camera angle, safe visual path,
VFX seed, sound sample and secondary motion. It may not decide that the attack
missed, became critical, damaged a different amount, hit another participant or
eliminated anyone.

### Presentation cues

Protocol v1 may include optional normalized cues generated by a trusted
server-side module presentation adapter, such as:

```json
{
  "cueId": "cue_...",
  "eventSequences": [10, 11],
  "semantic": "ATTACK_IMPACT",
  "actorRunParticipantId": "rp_lion",
  "targetRunParticipantId": "rp_tiger",
  "animationState": "ATTACK_PRIMARY",
  "reactionState": "HIT_LIGHT",
  "intensity": "NORMAL"
}
```

Cues reduce duplicated interpretation across runtimes but remain derived data.
Every cue references its source event sequences. If cue and event disagree, the
runtime rejects the package or regenerates cues through the compatible adapter;
it never changes the event.

## 9. Entity visual binding

Protocol v1 carries the Phase 6 immutable visual snapshot available today:

- source profile version/revision and source type;
- archetype;
- snapshotted portrait/model references;
- normalized scale, rotation and offset;
- semantic animation mappings;
- explicit `null` for legacy or absent visual data.

The Platform does not have an Asset Library or cooked artifact registry yet, so
v1 does not invent asset IDs, versions or hashes. Those fields should extend a
future protocol minor version after immutable artifacts exist.

Future artifact manifests, rather than Core events, may contain engine-specific
variants:

```text
variants
├── web-gltf
├── unreal-5.x-win64-cooked
├── unreal-5.x-linux-cooked
└── future-offline-render
```

The runtime will select a compatible declared variant. It must not substitute a
live latest version and thereby change historical identity.

## 10. World binding

A World binding contains a stable World ID/version/manifest/hash plus semantic
selections such as spawn set, time-of-day/weather preset and optional camera or
audio profile. The World manifest may describe named zones and engine-specific
artifacts. It does not place Unreal actor paths in Core.

If a Run predates Worlds or lacks a binding, each runtime chooses its documented
generic fallback environment. That fallback is reported in diagnostics.

## 11. Result contract

The package includes the complete persisted result and enough version metadata
to validate it. A runtime must:

1. validate the result schema for the module version;
2. verify all referenced participants exist;
3. reconstruct the terminal presentation state from ordered events where the
   module adapter supports it;
4. compare winner/rankings/terminal values;
5. refuse misleading playback when truth is inconsistent.

The runtime may send `presentation.started`, `presentation.completed`, playback
position, fallback and performance telemetry. These acknowledgements never
update the Run result or event stream.

## 12. Completed-package transport

Recommended Phase 7A/desktop flow:

1. Browser requests a runtime session for an authorized completed Run.
2. Platform checks user, active workspace, membership and `simulation.view`.
3. Platform creates an opaque, single-use, short-lived launch code.
4. Native launcher exchanges it over HTTPS for a runtime-session token.
5. Token grants read access only to one package and its permitted artifacts.
6. Runtime downloads the package, verifies version/hash and resolves assets.
7. Runtime posts bounded telemetry/acknowledgement using the session token.
8. Session expires or is revoked; the Run remains unchanged.

For local development, use checked-in sanitized fixtures. Never use production
cookies, workspace IDs or long-lived credentials in command-line parameters.

## 13. Future live stream

Live visualization is a later protocol mode, not v1 scope. A future session may
use:

- REST for session/snapshot/bootstrap and artifact manifests;
- WebSocket for ordered event envelopes and control/status messages;
- sequence cursor, idempotent event IDs and resume-from-sequence;
- heartbeat, backpressure, bounded buffering and explicit terminal result;
- a final immutable package retained for replay.

The runtime is still a consumer. If a future experience accepts player actions,
those actions go to an authorized Core/Module command endpoint. The presentation
client cannot emit authoritative result events directly.

## 14. Security and privacy

- Authenticate package creation and every session against workspace access.
- Use TLS, opaque one-time launch codes, short token TTLs and strict audience/
  run/session scopes.
- Use signed artifact URLs or an authenticated asset gateway.
- Verify package and artifact hashes; sign manifests when threat analysis
  justifies it.
- Keep internal database columns, storage credentials and user secrets out of
  packages.
- Include only presentation-required participant data; do not export private
  workspace metadata wholesale.
- Sanitize imported asset formats and enforce size/type/decompression limits.
- Log session/fallback diagnostics without leaking tokens or signed URLs.
- Treat runtime telemetry as untrusted input and bound its size/rate.

## 15. Failure and fallback policy

| Failure | Required behavior |
| --- | --- |
| Unsupported protocol major | Stop with upgrade/fallback guidance |
| Unknown optional minor field | Ignore safely |
| Unknown required module/event version | Stop; never guess simulation truth |
| Event/result mismatch | Stop and report package invalid |
| Premium asset unavailable | Use declared compatible fallback and report it |
| World unavailable | Use declared generic environment if policy permits |
| Animation semantic missing | Use archetype fallback without changing timing/fact |
| Cloud session unavailable | Offer native runtime or Web Preview |
| Token expired | Return to Platform for a new authorized session |

## 16. Conformance strategy

Phase 7A-A checks in three deterministic packages generated through the actual
Core engine and canonical package builder:

- duel ending by knockout, including managed Phase 6 visual snapshots;
- duel ending at the time limit, including legacy/no-visual snapshots;
- four-participant free-for-all with mixed archetypes and rankings.

Their manifest records seeds, outcomes, rankings, event counts, SHA-256 hashes,
and originating Platform checkpoint. TypeScript negative tests cover invalid
actor/target references, order, payload, result, protocol/module versions,
credentials, and incomplete Runs without maintaining intentionally corrupt JSON
files. Phase 7A-B must run the same checked packages through the Unreal parser
and compare participant identity, ordering, terminal result and winner parity.

## 17. Phase 7A-A decisions and remaining Phase 7A-B work

Phase 7A-A resolves these Platform decisions:

- Zod is the canonical validator; JSON Schema is generated and drift-tested.
- Protocol version is `1.0.0`; transport is deterministic, readable JSON.
- v1 packages completed Battle v1 Runs only and projects them on demand.
- v1 has no derived presentation-cue stream and no authoritative coordinates.
- participant/event/result relationships are validated without recomputing
  mechanics; credential-bearing asset references are rejected.
- checked fixtures carry SHA-256 hashes in a generated provenance manifest.

Phase 7A-B still requires the Unreal toolchain, a separate runtime repository,
C++ parsing/validation, coordinate conventions when spatial presentation is
introduced, artifact negotiation, and cross-runtime conformance tests. Public
runtime session endpoints, token/deep-link registration, live transport, and
asset delivery remain separately scoped future work.
