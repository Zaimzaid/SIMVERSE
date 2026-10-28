# SIMVERSE Economy Lab v1 — Persistent closed-currency town pilot

Status: source implementation on an isolated development branch, not merged into master.

## What is implemented

- A beginner-facing /economy/lab screen, linked from the authenticated sidebar.
- Three private lab slots per creator and workspace. Owner-only reads and mutations.
- A new local GFC currency (strictly fictional); completely separate from
  the existing player SVC career-wallet pilot.
- 50 deterministic AI agents, 5 distinct businesses, 1 public treasury,
  56 funded opening accounts, verified opening issuance, transaction history.
- One-day manual simulation: finite seeds/water enable farm production;
  processing and shop restocking transfer both stock and currency.
- Five businesses pay real simulated wages to 25 AI employees if affordable.
  AI households purchase food if affordable, generating shop revenue and tax.
- The logistics business collects transport fees. Government treasury funds
  regular construction contracts; road count increases when funded.
- Private creator can set bounded 0–25% fictional retail tax policy.
- Money conservation enforced after every step, no negative balances or
  arbitrary user mint/transfer action, optimistic concurrency/revision checks,
  atomic SQL persistence of daily state and transfers.
- Deterministic engine tests and persistence/security integration tests.

## Routes
- GET/POST /api/economy-labs
- GET/POST /api/economy-labs/[labId]
- GET /economy/lab

## Not delivered

No purchases, SVC conversion, World Creator Pass, Government Pass, payouts,
country currencies, true continuously-running worlds, full AI behavioral
autonomy, 3D visual economy, player-owned business salaries, real commerce,
banking, elections, inter-world trade, economic inflation or advanced
national governance. No payment credentials are accepted.

The limited economy is a PRIVATE LAB, not an already-published living world.
An authenticated workspace member needs world.view/world.manage permissions.
No political office, platform authority or property rights are conferred.

## Required verification and deployment gates

1. npm ci, npx prisma validate, npx prisma generate and npx prisma db push.
2. npx vitest run, npx tsc --noEmit, npx eslint ., npm run build.
3. Authenticated browser review of /economy/lab, mobile and desktop.
4. Create a town and advance several days. Check constant 13,000 GFC supply.
5. Change tax to zero, advance and see zero new retail tax. Change it to 25%.
6. Verify another user and workspace cannot read or mutate your lab.
7. Production migration design, usage monitoring, and manual signoff before merge.

Next: connect human business and employment records to local ledgers and jobs;
develop reusable economy simulation mechanics; render citizen and production
events in the separate playable 3D neighborhood prototype; introduce
independently authorized in-world government rules. Billing/legal review must
precede all paid passes, money purchases and creator payouts.
