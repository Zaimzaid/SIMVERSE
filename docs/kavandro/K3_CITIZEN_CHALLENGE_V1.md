# KAVANDRO K3 — Daily Citizen Challenge V1 (Civilization Phase 5)

**Scope:** first playable, non-3D citizen challenge. This feature does not touch the globe, map, country borders, district boundaries, Three.js, Unreal or 3D assets.

## Delivered in the draft branch

- Authenticated citizen challenge at **/profile/civilization/challenge** and GET/POST **/api/civilization/challenge**.
- Rotating UTC-day, server-defined fictional planning puzzles. Each offers seven improvement cards with visible cost/impact, a token budget of 12 and a maximum of three selections.
- Server-side exhaustive scoring against the best budget-legal combination; category diversity adds a small bonus. The client cannot submit its own score, user ID, currency amount or day.
- Persisted challenge attempts with a database uniqueness constraint (user + UTC day), one result per day, and an atomic audit record.
- Anonymous daily top-ten score board, participant count and personal rank. No display names, email addresses or foreign user's attempts are exposed.
- Private seven-day history showing the citizen’s own daily scores, recent streak and best score (window-limited); no currency issued for streaks.
- Accessible responsive 2D interface with a live budget calculation and explicit preview/real-world separation.
- Pure scoring tests, database tests for duplicate submissions, invalid/forged input, next-day rollover, anonymity, cross-user isolation and no currency changes.
- A dedicated PR CI workflow for generated Prisma client, TypeScript, lint, tests and production build on a disposable database.

## Important boundaries

- **No Vascoin issuance:** no reward integration, changes to Vascoin policy, wallet, treasury or ledger; game tokens and impact points are fictional and nonredeemable.
- **No live district approval:** the challenge is independent of geographic publication, citizenship, voting/residence and project funds.
- **No public player leaderboard identity:** rankings list scores without linking users or revealing account data.
- **No real-time multiplayer, push, entry fees, monetary prizes, land transactions or official projects.**
- One entry per server UTC day. It is a first playable strategy puzzle, not a competitive anti-collusion grade esports system.
- Public catalog is intentionally inspectable. Later game designs may need independently evaluated anti-cheat and incentives.

## Testing and deployment gates

1. CI must pass generated Prisma client, typecheck, ESLint, full tests and Next production build on a disposable SQLite database.
2. Browser QA must verify new /challenge page on mobile and desktop, keyboard/checkbox interaction, submission, completion state and midnight UTC rollover.
3. Review API authorization, duplicate-submission concurrency, rate limiting and privacy.
4. Test database migration with a separately restored copy of actual user data. Do not run db push, resetDb or any integration tests against an existing valuable SQLite file.
5. Explicit owner acceptance before merging/releasing; a branch commit or CI pass is not a deployed feature.

**Next non-3D work:** citizen retention/weekly gameplay, stronger abuse controls, safe social invitations, and only after independent approval, separately gated rewards. No 3D or geography work is part of K3.
