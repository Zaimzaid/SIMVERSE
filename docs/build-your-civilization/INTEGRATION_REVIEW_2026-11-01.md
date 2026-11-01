# Build Your Civilization — Combined Integration Review

**Date:** 2026-11-01
**Purpose:** Explicitly test the combined `master` history after merging the citizen-first UI and fictional geography concept atlas (PR #52) together with the independent citizenship/district/economy/land/development branch stack (PR #61).

## What this integration contains

- Citizen-first dashboard and public interface.
- Read-only original fictional five-continent concept atlas, candidate ten-country borders, terrain and topology readiness reporting.
- Citizens' saved founding-country preference and drafts; independently permissioned citizenship intake/review/issuance; reviewed residence and visits.
- Restricted district assembly and advisory voting with server-side eligibility rules.
- Simplified public landing.
- Isolated Vascoin (VC) virtual-currency ledger and treasury **disabled by default**.
- Schematic planning-zone board with independently authorized staff access.
- Proposal feasibility and published **planning** updates, not construction approvals.

## Critical boundaries

- **Geographic concepts are NOT adopted/published world territory.** No live nation, district or land ownership can be inferred from concept sketches.
- **No automatic real or fictional citizenship:** documented approval and active nation gates apply.
- **No redeemable money:** VC is nonconvertible, its rewards/contributions default disabled and never exchange with SVC/GFC.
- **No real developed buildings, funding guarantees, 3D placement, land purchases or production deployment.**
- Preserve all real-Earth records, SIMVERSE identities, social data and creator projects.
- New Prisma models must be migrated only with backup+rehearsal for the user's **actual** database, not by running isolated test setup against it.

## Quality gate

This PR was retargeted to `master` after the fictional geography integration landed. The new CI run on this PR verifies **the combined merge candidate** with a disposable SQLite database. Validate TypeScript, ESLint, tests and production build before merging. Browser/device usability and any published-world activation remain separate gates.

## Local test note

Once merged into `master`, fetch and pull with a clean working tree; do not run `prisma db push` or schema-reset integration tests against a valuable existing `dev.db`. Use a test database first, then follow a backup/migration plan for the real development database.
