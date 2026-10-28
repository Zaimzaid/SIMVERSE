# SIMVERSE Player Phase 6 — Virtual Orientation, Business Review & Employment

## Scope
This branch adds **a functional fictional-world vertical slice** for career
orientation, business review, job applications and accepted in-world jobs.
It is not a real employment service, professional qualification/license,
payroll provider, legal business registry or regulated-money payment tool.
3D work remains paused. Builds on Phase 5 PR #11.

## Implemented
- Player work center: **/profile/work**, linked from the personal career page
  and sidebar.
- Three introductory orientation questions (account safety, authorization,
  honest record-keeping); passing all three creates one immutable,
  server-assessed `PlayerOrientationCertificate` linked to the user's
  already-selected career. These are *not occupational qualifications*.
  No additional SVC credits are minted and no workplace rights are granted.
- Phase 5 virtual business drafts can be submitted for independent review
  after orientation. DRAFT -> PENDING_REVIEW -> APPROVED or DENIED.
  Decisions require a 10–500-character rationale and are audited.
- Only a separately and explicitly provisioned active
  `PlayerBusinessReviewer` can approve company drafts. It is
  **inactive by default** and independent of user ownership, workspaces,
  country governance and passport reviewer grants. Reviewer cannot
  approve their own business. No player-facing reviewer-grant API exists.
- Reviewer console: **/profile/work/review**; grant checked on server.
- A player with completed orientation can post a virtual job only through
  a business they own that has status APPROVED.
- All signed-in users can see the latest currently OPEN jobs from approved
  businesses. A candidate must have matching selected-career orientation,
  cannot be the business owner, and cannot apply twice to one vacancy.
- Employer reads applicants only for their own business, and may
  reject an applicant or make **one pending offer per job**.
  One outstanding offer changes vacancy OPEN -> OFFER_PENDING.
  The candidate may accept (OFFERED -> ACCEPTED, vacancy CLOSED and one
  `PlayerVirtualEmployment`) or decline (DECLINED, vacancy OPEN).
  Status updates are guarded with compare-and-set checks, and the acceptance
  creates an employment record and closes the vacancy within one transaction.
- Ledger balances are not touched by jobs, offers or employment acceptance.
  There is **no salary**, taxation, transfer, payment, or monetization.
- Audit records for training, business submission/review and employment
  actions; deterministic server-side input validation, account ownership
  checks, database uniqueness constraints, unit/integration tests and
  FK-safe test cleanup.

## API routes
- GET /api/player-work (owner-scoped work dashboard and open job board)
- GET/POST /api/player-work/orientation
- POST /api/player-work/businesses/[businessId]/submit
- GET /api/player-work/business-review
- POST /api/player-work/businesses/[businessId]/review
- POST /api/player-work/jobs
- POST /api/player-work/jobs/[jobId]/apply
- POST /api/player-work/applications/[applicationId]/employer
- POST /api/player-work/applications/[applicationId]/offer

Every mutation uses the logged-in session user; inputs cannot set company
status, wages, review grants, offer acceptance for others, wallet balances
or qualification scores. Public user profiles do not expose private
applicant statements or application/employment history.

## Deliberate limitations
- No actual licensed or regulated occupational credential or examination.
- No external qualification verification, training modules or degree records.
- No real or simulated payroll, job performance tracking or contract terms
  beyond status and start date.
- No company review grant management UI; a trusted operator must provision
  reviewers out-of-band before any drafts can be approved.
- One-person job opening with one active offer at a time. No recruitment
  cohorts, multiple vacancies per posting, contracts negotiation or appeals.
- No company reapplication after denial, document uploads, business
  registration fees, procurement, trade, taxes or bank/crypto integrations.
- Public job descriptions and company drafts are unscreened user-provided
  text; deployment should add moderation, reporting and abuse controls.
- Browser visual QA, end-to-end auth review, database migration and
  staged rollout required before merging any of the stacked draft branches.

## Verification
GitHub workflow: Prisma schema setup, TypeScript, ESLint, unit/integration
tests and Next production build. Tests verify wrong quiz answers never
create a certificate, no extra credits on training, independently approved
business prerequisite, cross-account isolation, duplicate applications,
authorized job offer, applicant acceptance, one employment record, and
offer decline returning vacancy to OPEN.

Parent PR: #11; this Phase 6 PR must remain draft until human review.
