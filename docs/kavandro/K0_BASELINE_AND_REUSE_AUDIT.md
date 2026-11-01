# KAVANDRO K0 — Baseline, Safety and Reuse Audit

**Prepared:** 2026-11-01  
**K0 state:** STARTED — remote source audit recorded; local runnable baseline and user-device validation PENDING.  
**Repository:** `Zaimzaid/SIMVERSE`  
**Reference branch:** `master`  
**Frozen baseline SHA:** `b22c4108228b292111f745a6470392b46226e36e`  
**Working branch:** `chore/kavandro-k0-baseline`  
**Purpose:** establish a safe, reproducible baseline before the KAVANDRO civilization pivot. **Documentation-only checkpoint: not a software release or completed test pass.**

## 1. What K0 must prove

1. Preserve current SIMVERSE source, accounts, sessions, Earth geography, player history, content, creator tools, social records and any real development data.
2. Capture branch/commit baseline and identify dependencies, data models, routes, auth boundaries, graphics proofs and technical liabilities.
3. Establish a reproducible **isolated** test environment, then measure install, generate, typecheck, lint, tests, build and essential browser flows.
4. Identify what can safely be reused, hidden, or replaced for KAVANDRO.
5. Create a reviewed additive migration plan. **K0 does not authorize schema changes, deleting legacy features, dropping databases, changing live configuration, or merging to master.**

## 2. Evidence gathered (remote read-only inspection)

| Area | Observed evidence at reference SHA | Reuse / risk |
| --- | --- | --- |
| Default branch and rights | GitHub repository metadata: default `master`, public repository; current head `b22c410` | Branch-based development appropriate; keep master unchanged |
| Runtime | `package.json`: Next.js `16.3.5`, React `19.3.0`, TypeScript `7.0.2`, Prisma `7.10.0`, SQLite adapter, MapLibre, Three.js, Vitest | Strong reusable web stack; local runtime compatibility/lockfile unverified |
| Source/test commands | `npm run typecheck`, `lint`, `test`, `build`; `db:generate`, `db:push` | **Do not run DB-mutating or tests resetting tables without a disposable DB** |
| DB | `prisma/schema.prisma`: SQLite datasource; `prisma.config.ts`: URL from env; `src/server/db/client.ts`: better-sqlite3 adapter | Preserve local SQLite; new fictional world models must be additive and planned |
| Secrets & session | `src/lib/env.ts`: DB URL and >=32-char session secret required; `src/server/auth/session.ts`: HMAC hash of opaque token stored in DB, secure/httpOnly cookie | Good foundations; full auth and anti-abuse review not completed |
| Proxy and auth rate limits | `.env.example`: `AUTH_TRUST_PROXY=false` by default; states in-memory auth rate buckets per server process | Multi-instance deployments need deliberate shared rate limiting; don't trust forwarded IP by default |
| Player identity | `PlayerIdentity` retains stable `SV-` IDs, profile data; `PlayerCitizenship` is linked to `EarthGeoPlace` | Preserve existing identifiers; **do not turn Earth-country rows into fictional KAVANDRO nations** |
| Home country selection | `src/server/services/player-identity-service.ts` reads active Earth `COUNTRY` records, and says selecting home does NOT grant citizenship | Needs separate fictional-world enrollment and privilege model |
| Social | `src/app/(platform)/social/page.tsx` and service: accepted friendship, messages and blocking | Reuse foundation selectively; new district club permissions/threads required |
| Landing and dashboard | `src/app/page.tsx` still says "SIMVERSE — Simulate anything"; dashboard promotes Earth, creator tools, simulations and Economy Lab | Rework in K1 for citizen-first onboarding; keep old services until safely de-scoped |
| Legacy explorer | `src/app/earth/page.tsx` is explicitly real-world MapLibre / Natural Earth | Must not be represented as KAVANDRO's fictional world |
| Fictional planet | `src/app/planet/page.tsx` is Stage-1 proof; renderer says **no Earth shapes, tiles, states or seeded countries** | Suitable starting renderer, **not** the completed ten-country atlas |
| Existing 3D | Repo README describes Marina Junction V0.2 / economy lab as prototypes, not released world | Preserve; outside civic MVP's critical path |
| CI proof | GitHub commit-status and associated PR-workflow queries for `b22c410` returned **no runs/statuses** | **No CI pass claim is established for this exact K0 baseline** |

Reviewed file paths include: `README.md`, `package.json`, `prisma/schema.prisma`, `prisma.config.ts`, `.gitignore`, `.env.example`, `src/lib/env.ts`, `src/server/db/client.ts`, `src/server/auth/session.ts`, `src/server/services/player-identity-service.ts`, `src/server/services/social-service.ts`, `src/app/page.tsx`, `src/app/earth/page.tsx`, `src/app/planet/page.tsx`, `src/lib/planet/signature-planet-renderer.ts`, `src/app/(platform)/dashboard/page.tsx`, `src/app/(platform)/profile/page.tsx`, `src/app/(platform)/social/page.tsx`, and key status/roadmap docs. This is a **targeted audit**, not an exhaustive source scan.

### Source access limitation

The isolated execution environment **cannot resolve github.com for git clone/npm dependencies**. No full checkout could be obtained to install dependencies or run tests locally. Do not infer any green test result from source review or from the October 28 README's historical CI report.

## 3. KAVANDRO divergence and mandatory design safeguards

**Existing code is not yet the KAVANDRO civic product.**

- Create a **separate fictional planet/country/district domain** and corresponding new URLs. Existing Earth models and data stay intact.
- Create membership and a single-primary-citizenship rule with explicit authorization, not just a new home country selector.
- Implement district assembly, proposals, ballot uniqueness, project approvals, progress updates and moderation as new features.
- Reuse authentication, account, social, rendering shell, UI components and tests only after validating compatibility.
- Do not mingle legacy SVC starter credit or GFC economy lab currency with future Vascoin or fiat.
- Preserve user ID continuity and protect private records during branding migration.
- Treat the Stage-1 orbital planet as a **visual proof only**: it has no authoritative original country/district atlas.
- De-emphasize or feature-flag legacy creator/economy pages for KAVANDRO MVP; **do not delete their code/data in K0**.

## 4. Risk register

| ID | Severity | Risk | Required treatment |
| --- | --- | --- | --- |
| K0-R01 | CRITICAL (data) | Running migrations, `db push` or resetting tests against a valuable SQLite file | Verified backup, new isolated DB URL, inspect actual resolved file location before any DB mutation |
| K0-R02 | HIGH | Current auth/session regression after new onboarding | Automated tests, real browser sign in/out/recovery tests with disposable account |
| K0-R03 | HIGH | Fake citizenship from reusing Earth location/paperwork | New fictional membership tables and server-side privilege constraints |
| K0-R04 | HIGH | Code-only fictional planet mistaken for complete map | Original country/district geometry plus validated dataset and accessible fallback in K2 |
| K0-R05 | HIGH | No verified build/test pass on frozen SHA | Run reproducible baseline and capture logs in a trusted checkout/CI |
| K0-R06 | HIGH | Social/vote brigading or unmoderated district speech | Voter eligibility, unique voting, rate limits, moderation logs, staff escalation |
| K0-R07 | MEDIUM | In-memory auth rate limits are not shared between server instances | Keep single-instance pilot or design shared atomic throttling before scaling |
| K0-R08 | HIGH | Public releases without backup/restore and production migration rehearsal | Separate staging, backup+restore test, explicit production signoff |
| K0-R09 | MEDIUM | 3D prototype slows or confuses MVP delivery | Independent quality milestone after core civic loop works |
| K0-R10 | MEDIUM | Brand switch breaks legacy deep links/docs | Redirect and route/SEO inventory; retain legacy routes during cutover |

## 5. Safe local K0 runbook (Windows PowerShell)

**Do this in a trusted local checkout, never on a valuable live database.** These are preparation/check commands **not executed during this remote audit**. Local repo path is user-controlled.

```powershell
# 1) Confirm you are in the right repository and have no uncommitted work.
git status --short
git branch --show-current
git remote -v
git fetch origin

# 2) Check the audited branch and reference commit exist upstream.
git rev-parse origin/master
git rev-parse origin/chore/kavandro-k0-baseline

# 3) Take a verified backup of your *actual* project database before any operation.
# Identify its resolved location from your private .env and prisma.config.ts.
# Do not paste .env contents or keys into chat or logs.
# IMPORTANT: merely copying a hot SQLite .db with WAL may NOT produce a valid backup;
# use an SQLite-aware backup (or cleanly stop all writers first), then test restore.

# 4) If the local working tree is clean, create an isolated branch/worktree.
# Do not execute any switch/clean/reset that would discard uncommitted work.
# Use a separate cloned worktree or clean disposable checkout for tests.
```

**Isolated test preparation checklist:**
- [ ] Identify the **exact real** DATABASE_URL and resolve the underlying DB path without revealing secrets.
- [ ] Obtain a SQLite-consistent backup; demonstrate restore in a separate location. Never overwrite user data.
- [ ] Use a newly named, empty **disposable** SQLite database with a test-only environment, safe directory/permissions, and a secret different from real production.
- [ ] Confirm the test process really points to the new DB **before** any `db:push`, migration or integration test.
- [ ] Use the repository lockfile with `npm ci`; then `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` after environment configuration.
- [ ] Run tests only if confirmed integration-test helpers cannot touch a valuable DB.
- [ ] Launch a disposable local server and manually test register/login/logout, /profile, /social, /earth/geography, /planet, /economy/lab, Marina prototype and main navigation.
- [ ] Record logs, test case counts, pass/fail, screenshots and test DB path without secrets; do not claim success from a log-free command.
- [ ] Keep generated dependencies and artifacts out of commit.
- [ ] Do not deploy, merge or apply production migrations during K0.

**CI alternative:** If the repository's Pull Request CI safely provisions a disposable DB, use a draft documentation PR to trigger/read its results; verify its actual configuration before treating its green status as evidence.

## 6. Measurable K0 exit criteria

| Gate | Status as of audit | Completion evidence required |
| --- | --- | --- |
| K0-A — Pin default-branch baseline SHA | **PASS** | Repo head = `b22c410...` at start |
| K0-B — Isolated K0 branch | **PASS** | `chore/kavandro-k0-baseline` created from the pinned SHA |
| K0-C — Preliminary code/data/route inventory | **PASS (targeted)** | Evidence inventory in this document |
| K0-D — No direct changes to master / no DB mutation | **PASS for work performed in K0 so far** | Only audit branch/docs touched, no application DB access |
| K0-E — Verified backup + restore of user's data | **NOT RUN** | Backup receipt and separate successful restore test |
| K0-F — Clean isolated install, Prisma generate, typecheck, lint, test, build | **NOT RUN / BLOCKED** | Exact SHA and all command logs |
| K0-G — Authentication/profile/social/map/3D browser smoke | **NOT RUN / BLOCKED** | Device screenshots and result table |
| K0-H — Security and dependency assessment | **NOT COMPLETE** | Findings with actionable severity and owner signoff |
| K0-I — Explicit K1 readiness/approval | **PENDING** | Founder reviews K0 risks, release constraints, required fixes |

**K0 is NOT complete** until E/F/G/H/I are closed. A draft PR is not a release authorization.

## 7. Next instructions (no production mutation)

1. Complete local/CI baseline run using a disposable DB; upload sanitized check logs.
2. Verify backup and restore and stabilize any current auth or build errors.
3. Inventory all current routes/modules and database model dependencies more completely.
4. Draft K1 migration contract: legacy ID continuity, new fictional-world tables, onboarding UI and feature flags.
5. Present K0 exit gate results for review; only then authorize K1 implementation.

**Audit source links:** [repository](https://github.com/Zaimzaid/SIMVERSE) · [README](https://github.com/Zaimzaid/SIMVERSE/blob/master/README.md) · [Prisma schema](https://github.com/Zaimzaid/SIMVERSE/blob/master/prisma/schema.prisma) · [fictional planet renderer](https://github.com/Zaimzaid/SIMVERSE/blob/master/src/lib/planet/signature-planet-renderer.ts) · [old Earth explorer](https://github.com/Zaimzaid/SIMVERSE/blob/master/src/app/earth/page.tsx).
