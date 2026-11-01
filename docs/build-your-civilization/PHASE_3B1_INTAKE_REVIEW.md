# SIMVERSE Phase 3B.1 — Controlled Citizenship Intake and Review Foundation

**Status:** implemented in a stacked draft branch for verification; not merged, deployed or approved.
**Branch:** `feature/build-your-civilization-phase3b-intake-review`
**Base:** Phase 3B.0 draft PR #54, which depends on Phase 3A PR #53 and Phase 1 PR #47.
**Phase 2:** paused; no draft Phase 2 country geography has been merged or published by this work.

## Purpose

Move beyond purely private citizenship drafts without accidentally creating citizens. Provide a real, testable gated application queue whose default state is **closed** and whose reviewer privileges are independently granted. This phase does **not** approve applications, grant a primary nationality, issue SIMVERSE passports or assign district residence.

## Implemented

- `FoundingCitizenshipIntake`: one optional country-controlled flag, **closed unless independently provisioned and opened**; no public endpoint can open it.
- `FoundingCitizenshipReviewerGrant`: independent country-specific reviewer permission, inactive by default; normal players, workspace admins, document reviewers and planet stewards receive no implicit rights. No public reviewer-grant endpoint.
- `FoundingCitizenshipApplication`: one immutable applicant/country submission per account for this cautious pilot, snapshot of motivation, status restricted to `PENDING_REVIEW`, `DENIED`, `WITHDRAWN`; no APPROVED status or issuance relation.
- `GET /api/civilization/my-application`: private readiness checklist (draft, completed username, published founding country, independently opened intake, one-application constraint). Shows own prior application status and optional feedback.
- `POST /api/civilization/my-application`: accepts no caller country/user ID. Server finds the signed-in account's saved draft, resolves its founding-name slug against an **actually published version** of the authoritative `FictionalCountry` in the SIMVERSE planet, rechecks every prerequisite inside a database transaction, and creates a pending application only after all checks pass.
- `DELETE /api/civilization/my-application`: only the applicant can withdraw their own pending application; retains an audit trail and historical row.
- `GET /api/civilization/reviewer`: only country-scoped active reviewer grants can see up to 50 pending applications in their assigned country, including the private applicant statement.
- `PATCH /api/civilization/reviewer`: reviewer may only **DENY** a pending application with a reason. Must be a different account from the applicant, a specific active country grant and an unchanged pending status. Explicit approval is impossible.
- `/profile/civilization`: readiness checklist and disabled/enabled submission button; existing preference and private draft stay editable independently.
- `/profile/civilization/reviewer`: restricted country-review UI (no ordinary citizen navigation link).
- Tests cover isolated published country and privileged operator fixtures, all negative gates, duplicate/withdrawal, self-review, wrong country access, unauthorized users, and **zero** official citizenship/doc issuance.

## Security and deployment gates

1. The pilot intake must **not** be opened as a side effect of publishing a country, visiting a profile or creating a draft.
2. An operator-controlled, independently reviewed change-management process is required to insert/update `FoundingCitizenshipIntake.isOpen`; there is **no** public write API for this.
3. Reviewer grants are similarly provisioned out-of-band; no permission inherited from a national citizen, administrator or planet steward role.
4. Tests may provision published countries, reviewer grants and open intake **only in disposable test DBs**. Never seed them in real accounts for demo purposes.
5. Country IDs reference the authoritative `FictionalCountry` and a matching published version slug; name-only Phase 2 concepts are insufficient.
6. No upgrade of the old EarthGeoPlace-linked citizenship ledger; it is not a new SIMVERSE primary citizenship.
7. Applicant statements are private; reviewer visibility is restricted by server-side grants. Audit metadata does **not** include private motivation text.
8. One application per account for this initial pilot; withdrawal or denial does **not** permit immediate resubmission. Future policies for repeat applications, transfers and additional citizenship require a separate reviewed migration/workflow.
9. A separate later phase must design verified primary-citizenship policy, independent multi-reviewer approval, permanent nationality ledger, race-safe one-primary constraints, residency and governance rights. **No such grants exist in this slice.**
10. CI must pass Prisma setup, TypeScript, lint, unit/integration tests and Next build; browser/mobile QA is a separate owner acceptance gate.

## User test now while Phase 2 is paused

Using a clean, disposable Phase 3B.1 checkout and DB, log into a test account, save a founding-country application draft, and inspect the readiness panel. The published-country and intake checks should be **unmet**, so submission must be disabled. Your earlier Phase 3A preference and draft should be unaffected. As a developer-only automated fixture (not a user-facing seed), tests prove that a published nation plus explicitly opened intake can accept a pending review and an authorized different reviewer can deny it. No production data, country publication or nationality is created by the feature installation.

## Next milestone

Once actual founding countries are reviewed and published and intake policy approved, implement positive country citizenship issuance with separate grant authorities and policies. District residence remains a distinct later phase, and Phase 2 can remain paused until its design is accepted.
