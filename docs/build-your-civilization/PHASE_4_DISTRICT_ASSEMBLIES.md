# SIMVERSE — Phase 4: District Assemblies and Community Proposals

**Status:** coded on draft feature branch; not merged/deployed/activated.
**Branch:** `feature/build-your-civilization-phase4-assemblies`.
**Base:** `feature/build-your-civilization-phase3-completion`, stacked on draft PRs #56, #55, #54, #53 and #47.
**Phase 2:** paused. No published fictional district was created in this feature.

## Implemented

- District-scoped proposals with title, category, substantive explanation and PENDING_MODERATION status.
- District discussions as comment records. Comments are invisible until independent district moderation publishes them.
- Open proposals and one SUPPORT/OPPOSE vote per unique user/proposal, only after 14 days of continuous approved residence in that district (not while simply visiting).
- Moderator approval or rejection of an initial proposal and advisory SHORTLISTED_FOR_FEASIBILITY status after at least three supporters and a majority.
- District notices and upcoming meeting notices with validated future meeting time, separately granted district moderators.
- Abuse reports for proposals/comments, report review, hide content and record the moderation outcome.
- Daily/hourly submission limits; strict input schemas; authorization for current primary country citizenship and residence; approved active district and published country checks; audit actions.
- Public view restricted to eligible residents in the district; pending proposals visible only to author/moderators; reported/hidden proposals or comments unavailable in ordinary district view.
- Read-only inactive-state page at `/profile/civilization/assembly` accessible from `/profile/civilization`.
- Staff moderation page at `/profile/civilization/assembly/moderation` protected by active district-specific moderator grant (no workspace-owner or planet-steward inheritance).
- Authenticated APIs: `GET/POST /api/civilization/assembly` (proposal, comment, vote, report), and `GET/POST /api/civilization/assembly/moderate` (review, notices, report resolution).

## Explicit limits and governance truth

- A district **must** already be independently published, active, have an approved versioned geographic record, and the citizen must have valid primary nationality + registered residence. Phase 4 creates no countries, districts, authority grants or members.
- Assembly votes are **advisory**, not binding construction/project approvals or land allocations.
- A shortlisting decision means **forward for staff feasibility**, not that the SIMVERSE team has committed to design/build, allocated a budget, reserved a site, or accepted Vascoin.
- No financial ledger, Vascoin, new property title, virtual construction object, official project completion, meeting attendance or voter reward is created.
- Content is user generated; a stronger production trust-and-safety program (appeals, escalation, repeat-offender enforcement, malicious media, global abuse monitoring, moderator appeal, operational SLAs, privacy disclosure) is still a launch gate.
- Current simple cooldown and residence policies are pilot policy choices, not a constitutional voting system. District ballot casting for elected officials is not this advisory proposal-vote feature.
- No official construction/feasibility review engine is claimed complete; that is Phase 8 after Phase 7 zoning, with staff-only approval.
- Moderator grants are not issued by any web endpoint here. Full operator provisioning and revocation workflow need separate review.
- Avoid displaying private applicant documents in assembly records.

## Unit and integration acceptance

1. Users without active approved districts or home residence cannot read or write district assembly data.
2. Proposals start pending and are not publicly visible; moderator cannot approve own proposal.
3. Comments start pending and cannot be read until independently moderated.
4. Only 14-day eligible residents may cast a single advisory vote per proposal.
5. At least three supporting votes and a strict majority are required to shortlist.
6. Author, visitor, other-district resident and unauthorized moderator cannot bypass permissions.
7. Announcements and future meetings require an independent active district moderator grant.
8. Residents can report content; authorized moderators may hide and resolve it, with an audit trail.
9. Limits prevent ordinary rapid repeated proposals and excessive comments/reports.
10. Older Phase 3 citizenship, travel, profile/social, economy and historical real-Earth record tests still pass.
11. TypeScript, ESLint, disposable Prisma SQLite schema, integration tests and Next production build pass.
12. Browser acceptance at mobile/tablet/desktop, two different test accounts and one independent moderator (using disposable test fixtures, not live country activation) pending.

## Rollout / migration

This PR adds district-assembly Prisma tables and relations. **Do not db:push or reset a valuable existing database.** Use a separate checkout with a disposable SQLite file. Before any deployment, review migration/backups/rollback, security/rate limiting, content protection, moderator operations and Phase 2 geographic authority. Keep unmerged draft PRs isolated.

## What follows

- Phase 5: one playable and replayable game/challenge with server-authoritative scoring.
- Phase 6: future separate nonredeemable Vascoin ledger (never mix with SVC/GFC).
- Phase 7: approved zoning/sites and protected corridors.
- Phase 8: district proposal → staff feasibility → approved project → site/funding gates → actual staff implementation.

**Not a live feature release until signed off.**
