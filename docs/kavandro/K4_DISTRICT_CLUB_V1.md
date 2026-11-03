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
  client-side polling every eight seconds and bounded posting frequency.
- Message reports do not automatically remove content. Moderators receive
  reports through a private queue and may dismiss or hide messages.
- Independent district club moderator grants, not inherited from the Assembly
  or workspace roles; no public moderator-grant endpoint.
- Session-bound authenticated API routes; strict server-side validation.
- Tests for different district isolation, visitors, unpublished geography,
  inactive citizenship, invalid rooms and forged fields, rate limits,
  reporting, self-review and unauthorized moderation.
- Existing Social group chat and Assembly proposal/vote records are unchanged.

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

Private uploads, resident opt-in directory, event calendar, group voice calls,
online presence, push notifications, WebSocket delivery, mute/ban policies
and appeals workflows.
