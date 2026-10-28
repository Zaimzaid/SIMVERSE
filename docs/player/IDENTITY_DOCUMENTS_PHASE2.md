# SIMVERSE Player Documents — Phase 2 (Fictional Citizenship and Passports)

## Boundary
All identifiers, passports, citizenships, residency permits, permissions and
eligibility conditions in this module are fictional **in-game SIMVERSE**
constructs. They have no relationship to Nigerian or foreign governments,
international travel, actual passports, legitimate residency, or property rights.

This phase builds on `feature/player-identity-citizenship-phase1` and does not
depend on any paused 3D prototype.

## Delivered
- `/profile/documents` private application/status center for CITIZENSHIP,
  NATIONAL_PASSPORT, INTERNATIONAL_PASSPORT and RESIDENCY.
- `GET/POST /api/player-documents/applications`, authenticated and
  user-scoped. The API never accepts self-supplied statuses, awards or roles.
- Checks at application time: SIMVERSE username is required. Citizenship
  requires that the user's chosen **fictional home country** matches the
  requested virtual country. National and international virtual passports
  additionally require reviewed ACTIVE SIMVERSE citizenship in that country.
  Residency requires username and a country with active sourced catalog data.
  These are deliberately simple pilot eligibility rules, **not immigration law**.
- Immutable stored application status transitions:
  PENDING_REVIEW -> APPROVED or DENIED, never self-approved.
- Country-scoped, active `PlayerDocumentReviewer` grant for reviewer actions,
  distinct from Earth steward, workspace owner/admin and Player/Creator roles.
  No public API creates these grants. A reviewer cannot approve their own file.
- `GET /api/player-documents/review-queue` only reveals pending applications
  in grant-scoped countries. Reviewer interface `/profile/documents/review`
  requires a reviewer grant. Approve or deny via
  `POST /api/player-documents/reviews/[applicationId]`, with a required
  10-500 character review rationale and audit event.
- An approved citizenship application establishes one separate ACTIVE
  fictional citizenship record. An approved national/international virtual
  passport or virtual residency issues a random `SVV-` serial, with **pilot
  1-year** validity and a derived EXPIRED status. No real passport images,
  signatures, seals, document exports or payments are created.
- Country choices are sourced from active Earth country geometry data.
- Application history, private citizenship records and virtual document
  serials are never included in public `/u/username` profiles.

## Reviewer provisioning
There is **no initial default document reviewer**. This intentionally keeps
all applications pending until the SIMVERSE operator provisions qualified,
country-specific reviewer access via a controlled, separately audited
administrative process. No workspace-owner/admin role implicitly grants
authority. The test suite creates reviewer grants directly in disposable
fixtures, not in production.

Review access must be granted by an operator who independently verifies the
target user and virtual country; do not accept a public API request, ordinary
workspace invitation, or self-reported citizenship as such a grant. The
production provisioning interface and dual-approval governance are deferred.

## Data model
- `PlayerDocumentApplication`: one application per identity + kind + virtual
  country (pilot). Tracks status, statement, policy snapshot, review rationale,
  actor and timestamps.
- `PlayerVirtualDocument`: one fictional credential per approved non-
  citizenship application with a unique, random serial and expiry.
- `PlayerDocumentReviewer`: user/country-scoped and false by default.
- `PlayerCitizenship.sourceApplicationId`: issuer trace to the reviewed
  citizenship application. No applicant profile field can write it.
- All country references are proper EarthGeoPlace FKs (not free-form strings).

## Limitations and follow-ups
- Single application per kind/country. Denials cannot be re-applied or appealed
  until the next policy phase adds reconsideration and versioned applications.
- No renewal, loss/reissuance, suspension, court decision, fraud review,
  cross-country visa recognition or dual-citizenship policymaking.
- No separate government interface or regional visa treaty data yet.
- No out-of-band reviewer grant UI, email delivery, signed PDF, payment
  collection, fee table, KYC or real-world document upload.
- No legally meaningful passport or actual border-crossing entitlement.
- Revocation is modeled but admin revocation workflow is deferred.
- Browser review still needed for appearance, accessibility and behavior.

## Verification gates
1. GitHub CI: Prisma schema push, TypeScript, ESLint, Vitest, Next build.
2. Register two players, import the approved Nigeria Earth catalog, choose a
   fictional home country, and set a SIMVERSE username.
3. Citizenship application begins in PENDING_REVIEW; changing home country
   does not approve or award anything.
4. Passport application fails before country-specific active citizenship.
5. Unauthorized reviewer / self-approval fail closed.
6. With a separately provisioned reviewer, citizenship review is recorded;
   national/international passports can then be applied for and separately
   reviewed; expiry is derived from date.
7. Private identity and application data are not exposed through public
   profiles or another user's endpoints.
8. Repeated submissions or reviews fail without duplicate grants/documents.
9. Verify no 3D dependencies are introduced or modified.

**Strict rule:** this system never claims to issue genuine government or
international travel documentation.
