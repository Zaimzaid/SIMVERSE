# SIMVERSE Creator / Media Foundation v1

## Purpose

Creator / Media Foundation v1 turns an authorized, completed
`SimulationRun` into a reusable workspace-owned `STORYBOARD` artifact. The
artifact begins with a deterministic sequence of scenes and can evolve through
creator-written presentation versions.

The permanent authority boundary is:

> **Core decides what happened. Creator/Media decides how the story is presented.**

The media system reads the Run's saved participant snapshots, event stream and
validated module result. It never executes mechanics or writes to the Run.

## Persistence

`MediaArtifact` is the stable creative identity:

- belongs to one Workspace;
- references one completed source Run with `onDelete: Restrict`;
- currently supports the `STORYBOARD` type;
- tracks `DRAFT`, `READY` or `ARCHIVED` status;
- identifies its current immutable version;
- records creator attribution and timestamps;
- allows multiple artifacts to derive from the same Run.

`MediaArtifactVersion` is append-only application data:

- has a unique `(artifactId, version)` number;
- stores title, subtitle, description, aspect ratio and status;
- stores a bounded validated `StoryboardV1` JSON snapshot;
- records creator attribution and creation time;
- preserves every earlier presentation version.

The database stores structured metadata only. It contains no rendered image,
audio or video binaries. This repository continues to use its established
`prisma db push` deployment convention; this checkpoint adds no migration
history.

## StoryboardV1 contract

Every stored storyboard passes a strict Zod contract before persistence and
again when read. It contains:

- `version: 1`;
- source Run, Simulation, mode, module and module version identity;
- historical participant identity and lightweight visual metadata copied from
  the Run snapshots;
- an authoritative summary containing result type, headline, completion
  reason, winner references, tied references and final ranking;
- three to twelve ordered scenes.

Scene kinds are `INTRO`, `COMPETITOR`, `HIGHLIGHT`, `TURNING_POINT`, `RESULT`
and `OUTRO`. A scene has a stable ID, unique order, copy, participant references,
optional source event sequence, optional duration hint and enabled state.
Participant and result references must resolve inside the saved storyboard.

## Deterministic source adapters

The generic `StoryboardAdapter` boundary accepts saved Run data and returns a
validated `StoryboardV1`. The current registry contains:

- `BattleStoryboardAdapter` for `battle` / `battle-v1`;
- `RaceStoryboardAdapter` for `race` / `race-v1`;
- `SurvivalStoryboardAdapter` for `survival` / `survival-v1`.

Each adapter validates the existing authoritative module result schema. Event
payloads selected as highlights are validated with the module's existing event
schemas. Selection is deterministic, de-duplicated and capped at six highlights.
The final storyboard therefore contains at most ten scenes: intro, competitor
lineup, six highlights, result and outro.

Battle selection recognizes eliminations, critical or heavy hits, dodges and
timeouts. Race selection recognizes lead changes, checkpoints, finishes and
timeouts. Survival selection recognizes hazards, recovery, leader changes,
eliminations and timeouts. Adapters use saved result winner, tie and ranking
fields directly.

## Creation and editing lifecycle

`createMediaArtifactFromRun` performs this flow inside one transaction:

1. enforce `media.create` membership permission;
2. find the Run by both ID and active Workspace;
3. require `COMPLETED` status and a supported exact module version;
4. validate the input snapshot, participant snapshots, events and result;
5. build and validate the storyboard through the registered adapter;
6. create the artifact and immutable version 1 together.

Failure leaves no partial artifact. Repeated intentional creation can produce
multiple artifacts for one Run. Client submission locking prevents ordinary
double clicks from overlapping.

`createMediaArtifactVersion` accepts presentation fields only. A creator may
edit title, subtitle, description, aspect ratio, production status, scene copy,
scene order and scene enabled state. The service requires the exact existing
scene IDs, preserves kind, source event sequence, participant references and
duration metadata, validates a continuous order, and appends the next version.
A compare-and-swap update plus the database uniqueness constraint guards
version numbers during concurrent requests.

Archive and restore also append versions. The source Run relationship and every
prior version remain intact.

## Permissions and tenant isolation

The central role matrix defines:

- `media.view` for every current workspace role;
- `media.create` for Creator, Admin and Owner;
- `media.edit` for Creator, Editor, Admin and Owner.

Every route delegates to the service layer. Services re-check membership and
permission on the server. Workspace-scoped `findFirst` queries return safe
NotFound failures for foreign Runs and artifacts.

## API and product surfaces

The v1 API is:

- `POST /api/media/artifacts/from-run`;
- `GET /api/media/artifacts`;
- `GET /api/media/artifacts/[artifactId]`;
- `POST /api/media/artifacts/[artifactId]/versions`;
- `POST /api/media/artifacts/[artifactId]/archive`;
- `POST /api/media/artifacts/[artifactId]/restore`.

`/studio` is the workspace artifact library. It lists real drafts and ready
storyboards, offers a bounded recent completed Run picker and supports landscape
16:9, vertical 9:16 and square 1:1 formats.

`/studio/[artifactId]` is the storyboard workspace. It provides editable scene
cards, immutable source references, an authoritative result card preview,
version history and archive/restore controls. Read-only members receive the same
truthful view without mutation controls.

Supported completed generic Run and Anything Wars result pages expose a
`Create Content` action. Battle, Race and Survival are supported. Battle keeps
its separate 3D replay action.

## Audit events

The existing audit trail records small metadata for:

- `media.artifact.created`;
- `media.artifact.version_created`;
- `media.artifact.archived`;
- `media.artifact.restored`.

Full storyboard payloads are excluded from audit metadata.

## Historical integrity

Storyboards derive participant names, categories, colors and image references
from `SimulationRunParticipant.snapshot`. Later Entity edits cannot change an
artifact version or its source Run. The result card reads the storyboard's
immutable authoritative summary, while creator captions remain presentation
copy. Runtime Protocol v1 and the Battle, Race and Survival mechanics packages
are unchanged by this foundation.

## Current limits

v1 produces structured storyboards and browser result card previews. Rendered
image export, video editing, audio tracks, narration, captions, AI direction,
public links, publishing, social features and binary media storage remain future
Creator / Media checkpoints. Animation Studio remains its own future standalone
creator system.
