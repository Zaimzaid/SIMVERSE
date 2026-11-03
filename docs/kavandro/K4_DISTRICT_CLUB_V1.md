# KAVANDRO K4 — Residents-only District Club V1

Scope: non-3D social chat, separate from the official District Assembly.
Status: draft implementation, not deployed or activated.

## Delivered in this branch

- Citizen page /profile/civilization/club, linked from dashboard and My Civilization.
- Four district-scoped text rooms: General, Introductions, Activities & Games,
  and Shared Interests.
- Only active current home-district residents with matching approved fictional
  primary citizenship can read or post in that district.
- Requires a published fictional country version and approved, active district
  geography. Visits and saved country preferences never grant chat access.
- Per-district private message history (latest 60), user display names,
  foreground-only polling every five seconds and bounded posting frequency.
- Message reports do not automatically remove content. Moderators receive
  reports through a private queue and may dismiss or hide messages.
- Independent district club moderator grants, not inherited from the Assembly
  or workspace roles; no public moderator-grant endpoint.
- Session-bound authenticated API routes; strict server-side validation.
- Tests for different district isolation, visitors, unpublished geography,
  inactive citizenship, invalid rooms and forged fields, rate limits,
  reporting, self-review and unauthorized moderation.
- Existing Social group chat and Assembly proposal/vote records are unchanged.

## K4.1 — Optional resident directory (same draft branch)

- A "Meet your neighbors" panel appears on the District Club page.
- Directory visibility is **OFF by default**: neither residence assignment nor
  participating in club chats publishes a player in this directory.
- A resident may explicitly enable discovery and add a short optional 180-character
  introduction. This is only visible to current approved residents of the same
  fictional district, with a bound of 50 entries in the initial view.
- The record retains the district where consent was given. A transfer does not
  carry a visible listing to the destination district: new explicit opt-in is
  required. The existing residence-transfer service additionally clears the
  old listing and introduction atomically, so returning to a prior home
  district will not revive old consent. If residency or citizenship is lost,
  the account is no longer discoverable; opt-out remains possible.
- Users blocking each other are excluded from the other's directory.
- Only display name and volunteered short introduction are shown. Account IDs
  and public usernames are disclosed only when a player has additionally set
  their existing player profile to PUBLIC and has a username.
- An optional **friend request** reuses the existing protected Social friends API;
  messaging still requires the receiver to accept. Email, home address, private
  documents and private username are never returned.
- New GET/PATCH /api/civilization/club/directory with strict input validation,
  audit entries and isolated directory privacy tests.

## K4.2 — Reviewed online community events and RSVP

- Residents can suggest **online-only** friendly activities and community
  gatherings in the Club. This phase does not require physical venues or 3D.
- Proposal title, description, event type, start/end are validated on the
  server; 30 minutes to 90 days advance notice, maximum six-hour duration,
  and maximum three proposals per resident in seven days.
- Event proposals begin **PENDING_REVIEW**. Only the author and authorized
  moderators may see pending content. Independently authorized District Club
  moderators can publish or reject proposals; they cannot review their own.
- Approved events are listed only to the **current eligible residents** of
  the same activated district, with organizer display name, local-time-friendly
  timestamps and participant COUNT (never a list of attendee identities).
- Each resident may RSVP once and withdraw. Concurrent duplicate joins
  are rejected by the composite database primary key. RSVP is blocked
  once the gathering starts and when the event is cancelled.
- Moderators can cancel previously published gatherings, clearing RSVPs.
  When a citizen officially transfers districts, their old Club RSVPs are
  erased by the existing approved residence-transfer workflow.
- No external venue URLs, uploading, compulsory attendance, revenue, real
  currency, Vascoin, Assembly votes, geography objects or construction.
- New event APIs, moderator review interface, and isolated integration
  tests covering residents, privacy, review, cancellation and transfers.

## K4.3 — In-app activity badges and faster room refresh

- A private, server-authoritative unread summary tracks four room counts and
  new moderator-approved events for each **currently eligible resident**.
- Club rooms display unread badges and the Club header displays the total.
  Event alerts offer an explicit "mark as viewed" action in the activities
  section. Messages in the currently open room are acknowledged only after
  their visible server response is received.
- Read cursors belong to the resident and approved district; they are never
  exposed to other citizens. Each acknowledgment checks the requested room
  and message/event against the **current approved home district**. A client
  cannot forge timestamps, access another district or move a cursor backward.
- Unread counts exclude a citizen's own messages/proposals, hidden messages,
  unpublished/cancelled events and content before the citizen's home-district
  residence began. The unread summary is capped per channel.
- Approved district transfers clear a citizen's previous room/event cursor
  state. Revoked citizenship and inactive districts fail closed.
- While the page is visible, the open chat checks for updates every five
  seconds; the activity summary checks every seven seconds and refreshes on
  the next check after the page becomes visible. This is **polling** and is
  NOT an instant WebSocket connection, mobile push, background notification
  or a 100% delivery guarantee.
- The read state introduces one additive Prisma model. Production rollout
  still requires migration review, backup/rollback rehearsal, mobile QA and
  operational moderation policies.

## Hard boundaries

No club access without real approved virtual-country and district activation.
No provisional fictional country preference is treated as residency.
No real money, Vascoin, official votes, virtual construction, land assignments
or reward issuance. No 3D, world map, globe or geography files changed.

## Release gates

1. Test Prisma generate, typecheck, lint, Vitest, production build using
   disposable CI test databases.
2. Verify browser interactions with different accounts and Android/mobile
   screens, including membership revocation while the page is open.
3. Rehearse additive migration on backed-up user data in a safe checkout.
   Never run db push or resetDb on a valuable live SQLite database.
4. Establish official club moderator provisioning and revocation, appeals,
   repeat offender controls, content retention and operational safety handling.
5. Approve actual fictional country and district geography separately, and
   owner-review the club, before activating or deploying.
6. Merge only when reviewed; draft branch is not an active product release.

## Deferred

Private uploads, recurring event calendar, group voice calls,
online presence, push notifications, WebSocket delivery, mute/ban policies
and appeals workflows.
