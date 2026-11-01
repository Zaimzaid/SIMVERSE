# SIMVERSE — Phase 6: Vascoin & District Treasury Foundation

**Status:** source implementation + verification on a draft branch, not a live economy.
**Branch:** `feature/build-your-civilization-phase6-vascoin-ledger`.
**Base:** `feature/build-your-civilization-simplified-public-home`, stacked on draft PR #58 and earlier civilization PRs.
**Geography:** Phase 2 still paused. No country, citizenship, district or treasury was activated by this change.
**Games:** Game developer owns Phase 5. No unverified game score produces VC in this release.

## Purpose

Deliver isolated **Vascoin (VC)** accounting with fixed, server-verified daily claims, an auditable journal, private citizen balances and *approved-residence-only* district contributions. Unlike SVC/GFC, VC is a different, nonredeemable game resource. There is no cashout, exchange rate, cryptocurrency, gift card, real-money charge, staking, speculative asset, or obligation for SIMVERSE to develop anything in exchange.

## New data

- `VascoinPolicy` singleton `vascoin-pilot-v1`, containing `dailyClaimsEnabled`, `contributionsEnabled` (both **false by default**), and `totalIssued` (bounded to 1,000,000 VC).
- `VascoinAccount` for unique `CITIZEN` (per user), `DISTRICT` (per district), and a fixed `ISSUANCE` account. Accounts are distinct from legacy player wallet and economy lab.
- `VascoinJournal` unique event reference, kind, positive integer amount, **debit** and **credit** account refs and timestamps. Each transaction atomically moves equal and opposite VC. Treasury does not have a spend API.

## Actions and rules

1. `GET /api/civilization/vascoin`: signed-in caller's **own** balance, status, last 25 journal entries and current approved district treasury balance. No arbitrary wallet ID or user ID accepted.
2. `POST /api/civilization/vascoin/claim`: user-triggered server-date UTC daily check-in, fixed **+10 VC**. An event key with caller ID and UTC date blocks repeat claims. A conditional totalIssued update enforces 1,000,000 VC lifetime pilot issuance ceiling; if missing/disabled policy, claim fails closed. Never accepts an amount/date from callers.
3. `POST /api/civilization/vascoin/contribute`: strict `{ amount: integer 1..500, requestId: UUID }`. No caller-chosen district, account or currency. Requires operator-opened contributions policy; server resolves current residence and verified active district (published country, active primary citizenship, geography ID, activation date). Sends VC from signed-in wallet to district treasury atomically only when wallet has enough balance. At most 3 contributions and 500 VC total per account per UTC day; unique user-scoped UUID key prevents duplicate requests.
4. `/profile/civilization/vascoin`: private wallet page with balance, status, claim, treasury and wallet transactions. Linked from My Civilization.
5. `verifyVascoinLedger()`: internal read-only audit that reconstructs balances from entries and asserts sum is 0 and policy total issuance equals journal minted total.
6. Tests cover default closed, daily duplicate, overall supply ceiling, invalid/malicious payload, approved home-country and district gates, double-entry balance, contribution replay and rate limits, and zero legacy SVC/GFC transactions.

## Financial & operational boundaries

- **Never** mix VC with SVC, GFC, fiat, crypto, payments or external payment services.
- All funds are explicitly in-game credits. No external deposits, purchasable tokens, withdrawable assets, guaranteed value or redeemable balances.
- District VC treasury is a ledger balance with NO payout/spend/land/build/contract endpoint. A contribution is **not** a construction deposit or guarantee. Future projects require a separately approved Phase 8 site/cost/build policy.
- Neither reward issuance nor contributions are opened by user registration, country creation or visiting a wallet. For a pilot, authorized operators must explicitly add and review `VascoinPolicy` in a controlled migration/provisioning process; no public policy-edit route exists.
- Current daily reward is a **user click** rather than auto-earning from fake game scores. A future Phase 5 game integration must provide server-authenticated game outcome records and distinct idempotent event types.
- Issuance and ledger account uniqueness rely on DB transactions and unique keys. On future multi-region/Postgres deployments, review concurrency/rate limits, write transaction isolation, daily policy reset, chargebacks/appeals and operational abuse alerts.
- Balance uses Prisma `Int` (signed 32-bit), guarded at credit time; a future scale-up may require BigInt/decimal migration and independent accounting audit.
- Existing user deletion/export processes may need a separate explicit wallet-retention/anonymization policy due to new `onDelete: Restrict` financial audit relations. **Do not deploy before deletion/export regressions and data policy signoff.**
- No operator console for toggling policies, funds reconciliation UI, money transfers, refunds, self-sends or direct user-to-user transfers in this phase. Avoid claiming those are implemented.

## Release checklist

- [ ] Prisma disposable SQLite preparation
- [ ] TypeScript, ESLint, full tests, production build
- [ ] Two-account isolated balance and journal tests
- [ ] No existing currency changes; account delete/export compatibility review
- [ ] Web/mobile browser wallet QA in light and dark
- [ ] Security review including rate limiting, email verification, bot/fake account resistance before enabling daily credit
- [ ] Backup/restore/rollback + independently reviewed additive migration; no `db:push` on live databases
- [ ] World/geo authority reviewed before true district treasury activation
- [ ] Owner signoff and explicit controlled operator activation

**Scope:** A safe foundational economy engine, not a live or complete virtual national economy.
