# SIMVERSE — Build Your Civilization | Phase 3B.0: Profile QA and Citizenship Application Preparation

**Date:** 2026-11-01
**Base:** Phase 3A `feature/build-your-civilization-phase3-citizen-interest` (draft PR #53).
**Branch:** `feature/build-your-civilization-phase3b-ui-application-drafts`
**Status:** source changes for QA; no release, country publication, citizenship submission or approval.

## User-observed Phase 3A issues (screenshots, Nov 1)

- Profile header and citizen preference text were hard to read at typical viewing scales.
- Two adjacent **Edit Profile** buttons duplicated the same state transition.
- Profile page described privacy as private-by-default even when `profileVisibility` was `PUBLIC`.
- The tall empty hero/banner and large card spacing obscured the core profile actions.

## Changes

1. Removed lower duplicate Edit Profile button; existing top Edit Profile and Cancel still drive the same form.
2. Shortened empty profile banner and reduced profile menu-card height/padding.
3. Increased secondary copy to readable `text-sm` sizes in the citizen preference form, status cards, profile help and profile menu cards.
4. Dynamic privacy explanation based on `identity.profileVisibility`, without changing the user's setting or hiding public profile links.
5. Added **a private, one-per-user citizenship application DRAFT**. Allows saving target founding nation and optional motivation (max 750 chars), changing or deleting. This is preparation, **not an application submission**.
6. `GET/PATCH/DELETE /api/civilization/my-application-draft` uses the authenticated session's user ID, never request-provided user ID; payload is strict validated and user-private.
7. No `POST/submit`, no queue, no reviewer ability, no official status transition, no country approval, no privilege or document issuance.
8. Save/delete events use the existing audit trail, excluding the potentially private motivation text from audit metadata.
9. One isolated Prisma `FoundingCitizenshipDraft` table linked to `User`. It is separate from the prior `FoundingCitizenInterest`, existing legacy `PlayerCitizenship` and Earth-based `PlayerDocumentApplication`.
10. Added automated tests for draft persistence, clear/change, two-account isolation, invalid country, forged approval/status/user ID, and zero new citizenship/document records.

## Critical boundaries

- Phase 2 is paused. The ten fictional founding country names are names only, **not authoritative published country records**.
- Current `FictionalCountry` publishing requires independent planet stewardship; citizenship reviewer rights must be separately provisioned and never inherited from workspace owner, planet steward or general login.
- The existing Earth-linked passport/citizenship application system remains unchanged.
- **No person should be told their draft is a submitted application or that they have acquired a primary citizenship.**
- A saved founding-country preference and a saved future application draft may differ, and neither overrides the other.
- Do not include real identity numbers, credentials, or sensitive personal data in the optional motivation field.

## Future reviewed citizenship application (not implemented here)

A separate, *future* actual `FoundingCitizenshipApplication` should have a stable approved/published fictional country ID, an explicit `SUBMITTED/PENDING_REVIEW/APPROVED/REJECTED/WITHDRAWN` lifecycle, country-scoped reviewer grant, audit and expiration policies. Application submission must ensure country publication, applicant eligibility, one primary citizenship, migration/cooldown rules and race-safe duplicate rejection. Reviewer approval should use an independent reviewer identity (no self-approval), atomic transaction, unique primary-country constraint and explicit policy revisions. Only after all that can a permanent fictional citizenship record be issued. Existing Earth-linked identity/citizenship should not be repointed.

## Acceptance criteria

- [ ] GitHub CI: disposable SQLite schema, Prisma generation, TypeScript, ESLint, integration tests, production build pass.
- [ ] Browser: Profile has one Edit Profile button when collapsed, editing/cancel work, saved public vs restricted privacy wording reflects actual setting.
- [ ] Browser: profile on 320/390/768/1366px and both themes; banner, stats and card text legible.
- [ ] Browser: My Civilization existing preference and pilot interest remain saved and unchanged.
- [ ] Browser: User A saves a private future citizenship draft, refreshes, and sees it; User B cannot view or modify it.
- [ ] Browser: change country, clear draft, sign out, sign in, check persistence; verify no application is submitted.
- [ ] Browser: explicitly no reviewer control or approved citizenship shown.
- [ ] Authorized production migration: DO NOT run `db:push` or integration tests on valuable DB. Review additive migration plus backups and rollback. Use isolated `DATABASE_URL` and disposable test checkout for development.
- [ ] Owner visual acceptance before merging stacked draft PRs #53 and this PR.

Phase 3B.0 is **not Phase 3B completion**. Do not mark full citizenship applications or review as implemented while geographic approval is paused.
