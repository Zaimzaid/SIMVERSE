# SIMVERSE Economy Lab — Phase 2: Players, Real In-Game Commerce, and Employment

**Status:** isolated draft development branch stacked on Economy Lab v1.
All amounts are fictional nonredeemable GFC, **not** platform SVC, real money,
tradeable tokens or national fiat. Do not combine payment wallets.

## This phase adds
- Private by default. Creator can explicitly share a lab with members of the
  *same workspace*. Others cannot discover, join, or operate that scenario.
  Sharing can be disabled at any point.
- User must have one server-verified Phase 5 career to JOIN a lab.
  Starting GFC varies by profession (80–120 GFC), transferred from the
  *existing town treasury*, never minted. A player can join each lab once.
  Max 12 joined players in this pilot; the treasury must have enough funds.
- Career-based SVC wallet and GFC remain separate, with no exchange.
- Independently APPROVED Phase 6 fictional businesses may open one operating
  shop per player per lab with 30 GFC of invested startup capital.
  No real-world registration, tax or professional qualification results.
- Players may invest their local balance, buy finite inventory from the AI town
  grocery (10 GFC/unit, max 8 units per order), and draw available company
  money back to their *own* local wallet.
- Every day, AI citizens may buy from player shops as well as the default
  market, constrained by physical inventory and their own money.
  Sales result in business revenue and fictional sales taxes.
- Active Phase 6 employment records may authorize 4 GFC paid shifts at
  operating lab companies, once per employment per simulated day; wages
  are paid from the *company's account*. Never minted.
- Revisions, structured strict schemas, authenticated workspace membership,
  company ownership, accepted employment checks and immutable transfer records
  enforce account isolation.
- New browser-friendly town join and commerce interface.

## Deliberate limits
- AI residents have lightweight deterministic purchasing decisions, not
  individual general-purpose AI agents, and no pathfinding or visible avatars.
- Full autonomous offline processing and 3D economy connection remain separate.
- Business reviewers are independently granted in Phase 6 and inactive by
  default. No shortcut via Lab UI. Only approved companies can operate.
- Creator tax/access controls are *private sandbox settings*, not elections,
  paid Government Passes or sovereign power.
- Maximum three labs per workspace creator, maximum 12 human joins per lab.
- This phase does not implement industry-wide production, banking, international
  trade, player-run factories, landownership, subscriptions or payouts.
- Closing workspace access restricts others' access; it does not mint, delete
  or confiscate any balance. Reopening restores their previous participation.

## Verification
GitHub Actions: Prisma schema push, TypeScript, ESLint, Vitest, Next build.
Manual QA: create lab; join after selecting profession; open independently
approved company, invest and buy stock; advance days; observe AI customer
sales and treasury taxes; recruit a separate player via Phase 6 job workflow,
join same workspace lab, accept a job, work paid shift. Check a duplicate
shift is blocked, money supply remains 13,000 GFC, unauthorized workspace
members cannot access, and the creator can close sharing.
