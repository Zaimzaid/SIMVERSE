# KAVANDRO District Club — K4.4–K4.13 expansion checkpoint

Status: **stacked draft PR #67**, based on **draft PR #66**. Do not
merge, deploy, market as available or activate without release gates.

## Scope boundary

This work is browser/platform UI, services and database. It does NOT touch
the virtual planet, 3D, Unreal, Blender, land parcels, globe, map/geography,
country boundaries, virtual construction, civic budget, Vascoin or Assembly
vote authority. The District Club is strictly separate from the Assembly.

## Phase matrix (do not conflate code with a launched service)

| Phase | Code in this draft | Not yet delivered / external dependency |
|---|---|---|
| K4.4 Safety | Time-limited MUTE and BAN, staff controls, independent sanction/appeal review, audit, eligibility gates | Full trust & safety operations, moderator training, escalation SLAs, incident retention policies |
| K4.5 Communication | Private room unread counts, foreground polling fallback and 22-second SSE change/invalidation stream reusing the existing social SSE approach | Distributed realtime broker, horizontal WebSocket service, typing indicator/presence guarantees, 24/7 push |
| K4.6 Alerts | Private per-resident chat/event notification choices and optional UTC quiet hours; in-app attention flags respect them | Mobile/web push provider, VAPID key custody, service worker, emails, scheduling reminders |
| K4.7 Media | HTTPS image/video *links*, strict allowed file extensions, no inline media execution; social reports remain available | Secure first-party upload storage, scanning, thumbnail pipeline, voice-note recording, content takedown workflow |
| K4.8 Groups | District-bound interest groups: create, join/leave, text threads, reports, independent hiding and closure | Rich roles for community organizers, invitation-only groups, archived exports, calls |
| K4.9 Activities | Weekly event proposal series of up to 3 occurrences, independent review for each, capped RSVP | Automatic indefinitely recurring schedules, structured tournament brackets, leaderboards |
| K4.10 Calls | Existing accepted-friend 1:1 Social calls remain usable; Club links to social Hub | District-wide multiparty voice/video rooms, TURN credential management, SFU hosting, recording consent |
| K4.11 Operations | Moderator aggregate-only metrics, independent staff assignment by platform publishing steward | Moderator scheduling, enterprise reports, operational staffing and user support |
| K4.12 Security/performance | Strict Zod service validation, role gates, rate bounds, automated integration tests and read-only localhost-only load smoke | External security review, browser-based stress benchmark, real user concurrency evidence, data-retention review |
| K4.13 Release | Dedicated CI and this rehearsal playbook | Safe production migration rehearsal, real-device QA, rollback exercise, approvals, merge, staged deployment |

## Safety guarantees and threat model

- All Club APIs use the caller's session and derive the current home district,
  active primary fictional citizenship, published founding country and reviewed
  active district on the SERVER. A country preference or travel visit does not grant access.
- BAN denies Club membership access; MUTE denies posting and joining interest
  groups, sending Club media, proposing activities and joining RSVPs. Appeal
  submission and reading a member's own sanctions remain possible during bans.
- Restrictions are time-limited to 30 days maximum per decision. Issuers cannot
  independently decide their own sanction appeals or revoke their own decisions.
- The platform publishing steward may separately grant/revoke Club moderator
  access for verified residents. Workspace/Assembly roles are not inherited.
- Report queues, creator IDs, review decisions and operating metrics are never
  public. No participant roster is disclosed for RSVPs.
- Group messages hide posts by accounts mutually blocked in the existing Social
  graph; interest groups are only discoverable in their own approved district.
- SSE carries only 'sync' invalidation frames, never message text or private user
  data. Content is re-fetched through authenticated, membership-gated endpoints.
- External media links are TEXT LINKS only, no proxy fetch, HTML embedding or
  server-side remote ingestion. They may lead off-platform and are NOT scanned.
- DB cursor, directory, RSVP and notification preference records are erased
  on approved district transfer, preventing stale district-specific access.
- No financial, real-estate, land allocation or civic authority is conferred.

## Release requirements: block merge/deploy until checked

- [ ] Both PR #66 and stacked PR #67 reviewed; PR #66 landed first.
- [ ] Full repository typecheck, lint, unit/integration suites and build pass at
      the final commit (not an older commit).
- [ ] Review safety/appeals privacy, escalation ownership, staff provisioning and
      policy for harmful speech, harassment, impersonation, spam and minors.
- [ ] Rehearse adding Prisma models/columns against a *restored duplicate* of
      production DB, with verification of rows, indexes and rollback. Never use
      \`prisma db push\`, \`resetDb\`, \`prisma migrate reset\` or disposable CI
      teardown against the real database.
- [ ] Exercise two browsers and two mobile devices: member, nonmember, two
      different districts, two moderators, banned member, muted member,
      revoked citizenship and transferring resident.
- [ ] Verify SSE on the eventual deployment platform; preserve polling fallback.
      Check idle resource usage and proxy timeouts.
- [ ] Run local-only load smoke using a disposable session and environment;
      record p50/p95/error rate, then run a separate safe authenticated load
      benchmark in staging with operational permission.
- [ ] Configure and validate external push/media/TURN/SFU if those optional
      capabilities are later turned on. They are OFF in this draft.
- [ ] Confirm accessibility, screen reader labels, localization/timezones,
      mobile keyboard interactions, high-latency connections, offline recovery.
- [ ] Approve actual founding-country/district publishing and residence rules
      separately (no fake pilot geography automatically activated).
- [ ] Review secrets, backups, monitoring and incident response. Obtain product
      owner approval before converting draft PR to ready or deploying.

## Local-only read smoke

\`\`\`bash
# Run only against your own disposable local test server and test account.
CLUB_TEST_BASE_URL=http://localhost:3000 \\
CLUB_TEST_COOKIE='test-session-cookie-here' \\
node scripts/kavandro-club-local-load-smoke.mjs
\`\`\`

This script is intentionally read-only and rejects external hosts. It is not
production traffic testing, not capacity proof and not a substitute for
human review.

## Deferred deployment integrations

External pushes (service worker/VAPID and durable queue), first-party uploads
with malware/content scanning and storage, scalable WebSocket adapter/broker,
multi-party calls via TURN/SFU, transcription/recording consent controls,
organizer-led tournaments and indefinite recurring calendar jobs require
architecture and operational decisions before they can be called complete.
