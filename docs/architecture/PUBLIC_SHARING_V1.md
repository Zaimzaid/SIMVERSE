# SIMVERSE Public / Unlisted Sharing v1

## Purpose

Sharing v1 adds the **Share** layer and completes the first full SIMVERSE creator
loop:

```text
Create → Simulate → Experience → Create Content → Export → Share
```

A creator can deliberately expose one immutable storyboard version through a
safe, version-pinned public link. This is SIMVERSE-hosted sharing only — no
Explore, no social graph, no external social-platform publishing.

## Privacy model

Every artifact has at most one share, whose `visibility` is the single source of
truth for public access:

- **PRIVATE** — the default. Only workspace members reach the artifact through
  authenticated Studio routes. There is no public link.
- **UNLISTED** — anyone with the exact link may view the shared presentation. Not
  intended for discovery; the public page is served `noindex, nofollow`.
  *Unlisted is not authentication* — it grants viewing to anyone holding the link
  and promises no secrecy; the UI says so.
- **PUBLIC** — anyone may view it through the public page, which may be indexed
  (`index, follow`) and becomes eligible for a future Explore system.

Nothing is ever published automatically. Creating a Run, artifact, version or
export leaves everything PRIVATE; sharing is always an explicit creator action
requiring the `media.share` permission.

## What is shared (version pinning)

A share pins **one immutable `MediaArtifactVersion`**, never "whatever is
current." Editing an artifact (appending a new version) does not change an active
share. The creator must deliberately repoint the share to a newer version. This
protects historical integrity and creator intent.

## Data model

`MediaShare` (one row per artifact, `artifactId @unique`):

- `workspaceId`, `artifactId`, `artifactVersion` (the pinned version)
- `visibility` (PRIVATE | UNLISTED | PUBLIC)
- `publicId` — the stable, unique, high-entropy public key
- `titleOverride?` — optional public title
- `createdById`, `createdAt`, `updatedAt`

It belongs to one Workspace (`onDelete: Cascade`) and one MediaArtifact
(`onDelete: Cascade`), so a share can never dangle; the pinned version stays
immutable and is never made mutable by being shared. The share row is created
lazily on first share and persists (stable `publicId`) as visibility toggles. No
public JSON blob is stored — the projection is derived from the pinned version.

## Public identifier strategy

`publicId = randomBytes(16).toString("base64url")` — 128 bits, URL-safe, bounded
(22 chars), generated server-side, unique. Sequential database IDs are never
exposed, and the creator-controlled `titleOverride` is never used as a security
identifier.

## Public-safe projection

The anonymous page receives a deliberately narrow `PublicMediaShareV1` (strict
Zod), resolved entirely to safe display values server-side. It contains the
presentation title/subtitle/description, mode and module label, the authoritative
result (headline, detail, completion reason, winner/tie **names**, ranking as
`{rank, name}`), participant display identity (name, short name, category, safe
hex color, initials), and enabled scenes (kind, title, caption, participant
names). It **never** contains `runParticipantId`, `sourceEntityId`, workspace or
member identifiers, the source Run id, the seed, raw events, audit data, or
permission information. A separate unauthenticated `getPublicMediaShare(publicId)`
service produces it; the privileged workspace `MediaArtifactView` is never
returned to the public.

## Permission model

New central permission `media.share`, granted to **OWNER, ADMIN, CREATOR**
(mirrors `media.create`; EDITOR holds `media.edit` but not `media.create`, and
publishing is an ownership-level action). Enforced server-side in the service
layer. Read of the share state uses `media.view`; mutations use `media.share`.
Workspace-scoped lookups return a safe NotFound for foreign artifacts.

## Lifecycle, revocation and archive

- **Create / update:** `setArtifactShare` validates visibility + pinned version,
  refuses to make an archived artifact public, upserts the row, and audits
  `media.share.created` / `media.share.updated`.
- **Revoke:** `revokeArtifactShare` sets PRIVATE and audits `media.share.revoked`.
  Public access stops immediately (the public image is `Cache-Control: no-store`,
  and the page resolves live).
- **Archive invariant:** archiving an artifact **suspends** its share (sets
  PRIVATE). **Restoring does not auto-republish** — the creator must deliberately
  re-share. A defense-in-depth status check also blocks resolution of any share
  whose artifact is archived.
- **Deletion:** there is no MediaArtifact hard-delete; archive/restore is the
  lifecycle. The Cascade relation means a future delete would remove the share
  rather than leave it dangling.

## Public viewer

- Route `/s/[publicId]` (outside the authenticated route groups → not in the
  proxy matcher → unauthenticated). Uses the root layout, not the platform shell.
- Resolves only active UNLISTED/PUBLIC shares of non-archived artifacts; anything
  else (PRIVATE, revoked, archived, unknown id) is a safe `notFound()` 404 that
  does not reveal prior existence.
- The hero reuses the render pipeline through `/s/[publicId]/image`, so the public
  image is the same design as any export (one presentation system, no competing
  result normalization). It also serves `og:image`.
- Responsive, fullscreen-friendly, premium dark presentation with SIMVERSE
  branding, result hierarchy, storyboard highlights, ranking and competitors, and
  a "Create your own" CTA. No developer metadata, no admin-dashboard feel.

## SEO behavior

`generateMetadata` sets `robots: noindex, nofollow` for UNLISTED and
`index, follow` for PUBLIC, plus Open Graph / Twitter `summary_large_image`
pointing at the public image endpoint (absolute URL from `APP_URL`). No sitemap
or discovery page is generated. Metadata exposes only safe projected content —
never workspace name, email, user ids or internal resource ids.

## Security boundaries

- **XSS:** all creator text (title, subtitle, description, captions, title
  override) is rendered as React text (auto-escaped) and escaped again in the SVG
  render. No `dangerouslySetInnerHTML`, no creator HTML/markdown. Participant
  colors are validated hex only.
- **Tenant isolation:** mutations are workspace-scoped; foreign artifacts 404.
- **Abuse surface:** this is the first unauthenticated public content surface.
  Queries are bounded, scene/participant data is bounded, no remote URL is
  fetched, no simulation is executed, public ids are high-entropy, and the image
  render is bounded. There is **no rate limiter yet** (no such infrastructure
  exists) and no moderation console — both are prerequisites before a large
  public launch (see non-goals).

## Non-goals (explicitly out of scope for v1)

Explore / discovery / trending / search of public content; Creator Profiles and
public creator identity (the page shows only "Created in SIMVERSE"); following,
likes, comments, reposts, notifications; external social-platform publishing
(TikTok/Instagram/YouTube/X/…); view counts / analytics; monetization; a
moderation console; and Video Studio. The public id is stable in v1 (re-sharing
reuses it); a "rotate link" action and safe participant-image embedding are
small future follow-ups.

## Future direction

Explore and Creator Profiles are the next social-layer checkpoints and must build
on this version-pinned, public-safe projection. A moderation foundation is a
prerequisite before broad public launch. The render/projection boundary here is
the contract those systems should consume.
