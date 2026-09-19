# SIMVERSE Runtime Protocol

> **Status:** Phase 6.5 conceptual protocol. No endpoint, schema package or
> runtime implementation exists yet. Phase 7A must turn this design into a
> reviewed versioned schema and conformance fixtures before an engine depends on
> it.

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

## 4. Conceptual `SimulationRuntimePackage`

```json
{
  "protocol": {
    "name": "simverse.runtime",
    "major": 1,
    "minor": 0
  },
  "packageId": "pkg_...",
  "generatedAt": "2026-09-19T12:00:00Z",
  "run": {
    "id": "run_...",
    "simulationId": "sim_...",
    "status": "COMPLETED",
    "module": { "id": "battle", "version": "battle-v1" },
    "snapshotVersion": 1,
    "seedMetadata": {
      "resolvedSeed": "SV-ABCD2345",
      "rngAlgorithmId": "core/battle-v1"
    },
    "tickRate": { "numerator": 1, "denominator": 1 },
    "startedAt": "...",
    "completedAt": "..."
  },
  "participants": [
    {
      "runParticipantId": "rp_...",
      "sourceEntityId": "entity_...",
      "position": 0,
      "identity": {
        "name": "Lion",
        "shortName": "Lion",
        "portrait": { "uri": "https://...", "hash": "sha256:..." },
        "primaryColor": "#D8A33F",
        "secondaryColor": "#4A2F1B"
      },
      "visual": {
        "profileVersion": 1,
        "profileRevision": 4,
        "archetype": "QUADRUPED",
        "asset": {
          "assetId": "asset_...",
          "version": "12",
          "manifestUri": "https://...",
          "contentHash": "sha256:..."
        },
        "transform": {
          "scale": 1,
          "rotationDegrees": [0, 90, 0],
          "offsetMeters": [0, 0, 0]
        },
        "animationProfile": {
          "profileId": "anim_...",
          "version": "3",
          "bindings": {
            "IDLE": "Idle",
            "RUN": "Run",
            "ATTACK_PRIMARY": "Bite",
            "HIT_LIGHT": "Hit",
            "DEFEATED": "Defeat",
            "VICTORY": "Roar"
          }
        }
      },
      "simulation": {
        "role": "primary",
        "attributes": [],
        "tags": [],
        "overrides": {}
      }
    }
  ],
  "world": {
    "worldId": "world_savannah",
    "version": "5",
    "manifestUri": "https://...",
    "contentHash": "sha256:...",
    "spawnSet": "battle_duel_v1",
    "environmentPreset": "late_afternoon_clear"
  },
  "events": [
    {
      "sequence": 1,
      "eventId": "event_...",
      "tick": 1,
      "type": "battle.attack",
      "schemaVersion": 1,
      "actorRunParticipantId": "rp_lion",
      "targetRunParticipantId": "rp_tiger",
      "payload": {
        "attackKind": "primary",
        "critical": false
      }
    }
  ],
  "result": {
    "schemaVersion": 1,
    "status": "COMPLETED",
    "winnerRunParticipantId": "rp_lion",
    "rankings": [],
    "modulePayload": {}
  },
  "presentation": {
    "profileVersion": 1,
    "title": "Lion vs Tiger",
    "qualityHint": "HIGH",
    "cameraProfile": "battle_duel_cinematic_v1",
    "audioProfile": "savannah_battle_v1",
    "locale": "en"
  },
  "integrity": {
    "algorithm": "sha256",
    "packageHash": "sha256:..."
  }
}
```

This example is directional. Phase 7A owns exact field names, required/optional
rules, numeric limits and schemas after comparing them with actual persisted Run
versions. Runtime URLs should normally be supplied through a session manifest or
signed indirection rather than permanently embedding expiring URLs in immutable
Run data.

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

The package carries snapshotted visual intent and immutable artifact identity:

- source profile version/revision;
- archetype;
- portrait identity;
- runtime asset manifest ID/version/hash;
- transform normalization;
- semantic animation profile ID/version/bindings;
- optional material, VFX and audio profile versions;
- declared fallback asset/profile.

The artifact manifest, not the Run package, may contain engine-specific variants:

```text
variants
├── web-gltf
├── unreal-5.x-win64-cooked
├── unreal-5.x-linux-cooked
└── future-offline-render
```

The runtime selects a compatible declared variant. It cannot substitute a live
latest version and thereby change historical identity.

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

Phase 7A should create a small, reviewed fixture suite:

- Phase 3-style Run without visual fields;
- Phase 5 legacy metadata visual profile;
- Phase 6 managed Visual Profile snapshot;
- duel with attack, dodge, critical, damage, elimination and victory;
- free-for-all with same-tick ordered events and rankings;
- missing optional assets/world;
- invalid event sequence and mismatched result negative fixtures;
- unsupported major/minor/module-version cases.

Run the fixtures through the web adapter, package producer and Unreal protocol
client. Assert participant identity, total ordering, terminal health/state,
eliminations and winner parity. Store expected normalized summaries as text so
they remain code-reviewable.

## 17. Phase 7A decisions still required

- exact JSON Schema or equivalent IDL and canonical hash serialization;
- whether derived presentation cues ship in protocol v1;
- protocol-neutral coordinate basis and quaternion conventions;
- package size/event-count limits and compression;
- Runtime Package persistence versus on-demand deterministic projection;
- asset/world manifest schemas and supported artifact negotiation;
- session endpoint names, token issuer/audience and deep-link registration;
- adapter support and retention policy for old module/snapshot versions.

These decisions require implementation evidence and security review. Phase 6.5
defines the boundary without pretending those details have already shipped.
