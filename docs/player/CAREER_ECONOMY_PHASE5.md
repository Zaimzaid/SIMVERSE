# SIMVERSE Phase 5 — Career, Profession & Virtual Economy Identity (Pilot)

## Scope
This adds the *first working slice* of SIMVERSE's fictional player career and
economy system, layered on Phase 4 PR #10. It does not build a payment
network, real employment marketplace, real commercial bank, legal business
registry or complete gameplay economy. The paused 3D work remains untouched.

## Shipped
- Authenticated player dashboard `/profile/career` with My Profile and
  sidebar navigation; authenticated API:
  - `GET /api/player-economy` (only own career, wallet and company drafts)
  - `POST /api/player-economy/profession` (choose one pilot career)
  - `POST /api/player-economy/businesses` (save fictional company draft)
- Eight fixed and explainable starter careers: agriculture, engineering,
  health, education, commerce, creative arts, transport, civic services.
  Each has a different **small fixed SVC starter-credit amount** and a
  suggested training orientation; the amount comes from server code only.
- SIMVERSE Credits **SVC** are nonredeemable, nontransferable, nonfinancial
  game points. They cannot be bought, sold, deposited or withdrawn in Phase 5.
- Choosing a first career creates `PlayerCareerProfile`,
  `PlayerVirtualWallet` snapshot, and one immutable `PlayerWalletEntry` with
  unique event key `STARTER:<identityId>` in one Prisma transaction.
- Selection is intentionally permanent in the pilot. No career switching,
  career re-selection or repeated starter credits. No client input controls
  credit amounts, account balances, ledger entries or privileged roles.
- Virtual business *DRAFTS* with global case/whitespace-normalized unique
  names and one of eight industries. They are user-scoped private records;
  drafts never grant trade, employment, taxation, property, medical,
  professional-license, or virtual government privileges.
- All player state is attached to `PlayerIdentity`, and registration
  continues to work without creating a real-world financial account.
- Audit events: profession starter selection and business draft creation.
  Database cleanup updated so existing integration tests remain independent.
- Tests for strict input validation, one-time controlled amount,
  ledger integrity, account isolation, business name conflict and
  no unapproved status spoofing.

## Security rules
- Require an authenticated session for every new endpoint.
- Require unique SIMVERSE username for profession/business initiation.
- Server-side strict schemas reject arbitrary fields such as
  `startingCredits`, `walletBalance`, `status: LICENSED` or `isAdmin`.
- Database unique constraints prevent two wallets/careers or duplicate
  `STARTER` transaction keys for one player. Atomic transaction prevents
  partially creating a career without its reward.
- No endpoints to issue credits other than a first profession selection.
- No transfers, spending, external payouts, monetary conversion or
  investor/pyramid-like schemes.
- No user-entered job qualifications authorize professions or jobs.
  Healthcare and civic career choices do NOT grant professional licenses
  or any government privileges.
- Read path reveals only the caller's private economy, not another
  player's ledger or drafted company plan.

## Deliberately not yet implemented
- Verified qualifications/training certificates, in-world licenses,
  professional authorization and skills assessment.
- Employment offers, contracts, validated work events, payroll or taxes.
- Live jobs marketplace, employer verification, labor law settings.
- Business approval and licensing, company management, hiring, revenue.
- Multi-country currencies, country-level economy, market prices,
  inter-player transfers and permitted in-game spending.
- Receipt/checkpoint-backed monetary conservation, dispute-resolution or
  production-grade multi-region ledger; current SVC is a small pilot.
- Regulated fiat payments, exchange with naira/dollars, gift-card
  redemption, blockchain or custodial services.
- Graphical avatar/work/salary simulation (3D development paused).

## Release gates
1. GitHub CI runs Prisma DB schema setup, TypeScript, ESLint, Vitest and Next
   build against the stacked Phase 1–5 branches.
2. Register a player and select a username; view wallet 0 SVC initially.
   Choose agriculture to receive 850 SVC exactly once. Second selection
   cannot mint any credits and the audit event is recorded.
3. Second player cannot view or modify the first player's wallet or drafts;
   attempting to duplicate another player's company name is rejected.
4. Verify no client can set ledger amounts, roles or company approval status.
5. Check mobile/desktop UI and production database migrations manually.
6. Review proper economy design before enabling payouts or credit transfers.

## Dependency and deployment
Stacked on Phase 4 `feature/player-nationality-policy-phase4`; previous
Phases 1–4 and paused 3D branches have not been merged to master. All
Phase 1–5 code must be reviewed/migrated in correct dependency order.
