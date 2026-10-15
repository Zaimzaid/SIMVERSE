# SIMVERSE Image / Post Export v1

## Goal

Image / Post Export v1 gives a creator the first **real, portable thing they can
take out of SIMVERSE**: a shareable graphic (PNG or SVG) rendered from a saved
storyboard. It extends the Creator / Media journey:

```text
Create → Simulate → Experience → Create Content → Storyboard → EXPORT
```

It renders **social / result graphics** only. No video, no publishing, no social
account connections — those are later checkpoints.

## Authority boundary

Export sits one step downstream of the storyboard and never touches Core:

> **Core decides what happened. Creator/Media decides how it is presented.
> Export renders that presentation.**

Export consumes an immutable `MediaArtifactVersion`. It never recalculates a
winner, alters rankings, edits events, rewrites Run snapshots, or reads a live
Entity/Simulation. Version N always renders as version N.

## Renderer architecture

A generic, product-neutral pipeline (Anything Wars is merely the first producer):

```text
MediaArtifactVersion (immutable)
        │
        ▼
buildResultGraphic()  →  ResultGraphicV1   (validated, bounded view model)
        │
        ▼
renderResultGraphicSvg()  →  SVG string     (pure, deterministic, isomorphic)
        │
        ├────────────────────────────►  SVG download / live preview (<img>)
        ▼
rasterizeSvgToPng()  →  PNG bytes           (server-only, @resvg/resvg-js)
```

| File | Responsibility |
| --- | --- |
| `src/lib/media/export/constants.ts` | Export types, formats, the one aspect→pixels map, filename/MIME tables, bounds. |
| `src/lib/media/export/model.ts` | `ResultGraphicV1` Zod schema + `buildResultGraphic()`; color/initials helpers. Pure, isomorphic. |
| `src/lib/media/export/svg.ts` | `renderResultGraphicSvg()` + `escapeXml()`. Pure, isomorphic, deterministic. |
| `src/server/media/rasterize.ts` | Server-only SVG→PNG via `@resvg/resvg-js` (dynamic import, kept out of the client bundle). |
| `src/server/services/media-export-service.ts` | Auth, version resolution, model build, render, filename. |
| `src/app/api/media/artifacts/[artifactId]/export/route.ts` | GET endpoint that streams the file. |
| `src/components/media/export-panel.tsx` | Studio preview + export controls. |

### The render model (`ResultGraphicV1`)

The renderer never sees a Prisma row or a storyboard directly — only this
validated, bounded model. It carries creator presentation copy (title,
subtitle) **and** authoritative truth (headline, ranking, winner/tie refs,
completion reason, participants), plus poster highlights. Authoritative fields
are copied verbatim from the storyboard; the renderer may stylize them but never
recomputes them.

## Supported exports

- **RESULT_CARD** — winner/tie headline, winner avatars (initials), a detail
  line (creator subtitle when it meaningfully differs from the headline, else
  the authoritative detail), top-3 ranking footer, and SIMVERSE branding.
- **STORY_POSTER** — creator title, 2–4 enabled storyboard moments (excludes the
  result/outro scenes), and a result strip with the authoritative outcome.

Formats: **PNG** and **SVG**. (JPEG is intentionally omitted; the rasterizer is
SVG→PNG only. PDF and video are out of scope.)

## Dimensions

The artifact aspect ratio maps to exactly one output size; a request may
override the ratio to produce all three social formats from one artifact. No
width/height ever comes from the client.

| Aspect | Pixels |
| --- | --- |
| `LANDSCAPE_16_9` | 1920 × 1080 |
| `PORTRAIT_9_16` | 1080 × 1920 |
| `SQUARE_1_1` | 1080 × 1080 |

The renderer separates **logical design** (a `viewBox` scaled by `min(w,h)/1080`)
from **output dimensions**, so new resolutions can be added without rewriting
layouts.

## SVG safety

The renderer builds SVG as a string, so creator- and Run-derived text is a
first-class injection concern:

- Every dynamic string passes through `escapeXml` (escapes `& < > " '`) before
  entering markup. No creator string is placed in an attribute, URL, `<style>`,
  or raw-markup position.
- Participant colors are validated to a strict hex pattern in the model; anything
  else falls back to a deterministic brand color.
- Payloads such as `<script>alert(1)</script>` and `"><image href="file:///…">`
  render as inert visible text. This is covered by tests.
- Browser previews load the SVG through an `<img>` element (which cannot execute
  script), and the endpoint sends `X-Content-Type-Options: nosniff`.

## Participant imagery

v1 renders **deterministic initials + brand color** identity for every
participant and **never fetches remote participant imagery** (no SSRF surface,
no reliability dependency on third-party hosts). Safe embedding of immutable
participant images is a documented future enhancement.

## PNG rasterization

`@resvg/resvg-js` (native, prebuilt, no system libraries) rasterizes the SVG at
the exact approved dimensions. It is declared in `serverExternalPackages`
(next.config.ts) alongside `better-sqlite3` and dynamically imported so it never
enters the client bundle. It is handed an already-rendered, bounded SVG and runs
no creator-supplied code.

## Permissions and isolation

Export reuses the existing `media.view` permission — every workspace role that
can view media can export it; no new permission was introduced. The service
loads the artifact via the workspace-scoped `getMediaArtifact`, so a foreign
artifact id returns a safe NotFound. The route authenticates through the standard
`requireApiContext`.

## Version behavior

An export request may target the current version (default) or any historical
version. Each version renders from its own immutable snapshot, so editing an
artifact (appending a new version) never changes an older version's export.
Unsaved editor changes are not exported until saved — the Studio panel says so.

## Server resource boundaries

- Only approved presets are accepted; the client cannot request arbitrary
  dimensions.
- The rendered SVG is capped (`MAX_EXPORT_SVG_BYTES`); creator copy, scenes and
  participants are already bounded by the storyboard/version schemas.
- Rendering is synchronous and bounded. There is deliberately **no**
  `MediaExportJob` queue — that complexity belongs to future video rendering, not
  image export.

## Filenames

Downloads use a safe, bounded, lowercase slug derived from the simulation name,
never from a raw path:
`"<slug>-<result-card|story-poster>-v<version>-<landscape|vertical|square>.<png|svg>"`,
e.g. `lion-vs-robot-result-card-v3-vertical.png`.

## Audit

Export is a read-only, repeat-clickable action (a creator may download several
formats and ratios in one sitting). To keep the audit trail meaningful — it
records significant mutations — export deliberately emits **no** audit event in
v1. A dedicated `media.artifact.exported` event can be added later if export
governance becomes a requirement.

## Storage non-goal

This checkpoint renders on demand and streams the result; it stores **no** binary
media. A media storage/CDN layer is a separate future checkpoint and is not
required for image export.

## Future direction

- **Sharing** (next likely checkpoint): Public / Unlisted Sharing v1 — links to
  this same rendered content. Not built here; requires its own owner review.
- **Video**: MP4 / timeline rendering, audio, captions, voiceover — a later
  Creator / Media checkpoint with its own (likely asynchronous) pipeline.
- **AI direction**: AI captions / thumbnails / Director remain out of scope;
  v1 is deterministic and creator-controlled.
- **Animation Studio** remains its own standalone future creator system.
