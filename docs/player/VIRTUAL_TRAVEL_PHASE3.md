# SIMVERSE — Phase 3: Virtual Immigration, Residency and Travel Access

## Scope
This feature models **fictional, in-game** movement eligibility between
SIMVERSE countries. Nothing in this module issues or authenticates genuine
national passports, visas, residence status, or any real-world travel rights.
Actual 3D world movement/border crossing is deliberately NOT implemented.
The 3D branch remains paused.

## What is implemented
- Authenticated player's **/profile/travel** dashboard and sidebar link.
- POST /api/player-travel/eligibility to check current SIMVERSE route policy
  and the caller's actual, unexpired virtual credentials. Do not evaluate
  permissions from a selected profile country, purchased access, workspace role,
  or uploaded claim. No policy means the route is CLOSED.
- Two-country typed route policies (origin + destination) with explicit:
  * isActive = false by default,
  * mode: CLOSED, VISA_REQUIRED, VISA_WAIVER,
  * required passportKind: NATIONAL_PASSPORT or INTERNATIONAL_PASSPORT.
  All travel rules are operator-provisioned in the database; there is no
  public/user API to create or edit them.
- Domestic movement eligibility: active destination virtual citizenship or
  an unexpired, issued destination virtual RESIDENCY credential.
- Cross-country eligibility: active origin SIMVERSE citizenship, valid approved
  virtual passport of the configured type, and (only for VISA_REQUIRED routes)
  approved, unexpired virtual entry visa for the exact origin/destination pair.
  Citizenship and passports are the **Phase 2 reviewed** records. A profile
  home-country selection never grants residency, travel access or citizenship.
- VISA_WAIVER means "no visa required" for the explicitly active route, **not**
  an exemption from the citizenship or passport requirement.
- Authenticated POST /api/player-travel/visas applies only on a configured
  VISA_REQUIRED route, with valid origin citizenship/passport, and a SIMVERSE
  username. Applications are PENDING_REVIEW. One per route/person in the
  current pilot; reapplication, renewal, appeal and replacement are deferred.
- Country-scoped virtual reviewer queue and review console at
  /profile/travel/review. Reuses Phase 2 explicit PlayerDocumentReviewer grant
  for the **destination country**. No grants are provisioned by default.
  Reviewers cannot review their own application; recheck current route policy
  and passport/citizenship before approving. A race-safe PENDING status
  compare-and-set permits exactly one final decision.
- Approved fictional entry visas get unique random SV-VISA-* serials,
  pilot 90-day expiry, status derived as VALID or EXPIRED. An approval by
  itself **never** overrides a closed route or expired supporting passport.
- All application decisions receive scoped audit events; private application
  history is user-only and absent from /u/[username] public profiles.
- Tests use a synthetic second country fixture only; no fictitious regional
  policies are presented as real international agreements.

## Travel status terminology
- UNAVAILABLE: no active policy / country pair is explicitly closed.
- MISSING_REQUIREMENTS: route open or domestic travel but prerequisites missing.
- ELIGIBLE: requirements for the fictional route-checking pilot are met,
  not an issued real visa, real entry permission, or even in-world teleport.

## Incomplete and deliberately deferred
- Country policy UI, reviewer-grant provisioning and policy version approvals.
- Treaties/region membership and cross-country regional travel agreements.
- Visa types, visits vs work vs study, multi-entry, case history, renewals,
  appeals, revocations, suspensions, dual citizenship policy.
- Borders, player teleport/travel events, trip booking or physically entering
  the 3D world (paused), transport, money, currency, migration analytics.
- Real identity verification, official government data or real-world visas.
- Per-country residency qualifications and route-to-specific-city policies.

## Review and validation
Schema, TypeScript, ESLint, Vitest and production build run in GitHub Actions.
Two-country service integration tests include registration, country fixture,
approved citizenship + passport, visa review, policy disablement and reviewer
privilege barriers. Manual QA is still required for responsive UI, browser
rendering, production migration and operation of country reviewer grants.
All Phase 1/2/3 stacked PRs remain drafts until independently accepted.
