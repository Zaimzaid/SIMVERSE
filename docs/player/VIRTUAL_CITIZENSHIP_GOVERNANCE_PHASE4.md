# SIMVERSE Phase 4 — Advanced Virtual Citizenship and Bilateral Agreements

## Boundary
All "countries", "citizenships", "residency", "treaties", "passports" and
"visas" in this feature refer to the **fictional SIMVERSE world** only.
None of these policies are based on, or claim to represent, Nigerian or
foreign laws, real-world passport/visa regimes, immigration status, national
identification or real-world travel. 3D rendering and in-world border
crossing remain paused.

## Implemented in this pull request
### 1. Versioned SIMVERSE country citizenship policies
- A country-scoped governance grant is **separate** from workspace roles,
  Earth steward privileges and the Phase 2 passport-review grant.
- Grants must be provisioned by an independently authorized operator;
  stored default is `isActive=false, canActivate=false`.
  **No public API creates or alters governance grants.**
- A country governor with a grant can propose a policy version with:
  `allowsDualCitizenship` (default false), and
  `minResidenceDays` (integer 0–365; default 180).
- Drafts can be activated only by **another** country representative with
  `canActivate=true`. At activation previous active policy becomes
  SUPERSEDED, preserving previous version records. Policy actions are audited.
- There is no prepopulated policy for Nigeria, Canada or any real nation;
  no active policy means a second virtual citizenship is **not** eligible.

### 2. Two-citizenship qualification rule
- The first citizenship remains limited to the player's explicitly chosen
  SIMVERSE home country (Phase 2 review still required).
- The second requires:
  1. Exactly one existing ACTIVE SIMVERSE citizenship.
  2. **Both** origin and destination have ACTIVE policies allowing dual
     SIMVERSE citizenship.
  3. An APPROVED/ISSUED **and unexpired virtual RESIDENCY** credential for
     the destination, held for the minimum days of destination policy.
  4. A separate new citizenship application reviewed by a destination-
     country document reviewer with no self-approval.
- The qualification is checked at both application and approval time.
- Pilot limits to two ACTIVE SIMVERSE citizenships.
- Player self-service, read-only `/api/player-governance/citizenship-preview`
  and new section on `/profile/documents` show unmet requirements without
  granting any documents.

### 3. Explicit two-country virtual travel agreements
- An authorized country representative may propose one directional pair
  (treated as a reciprocal waiver when active).
- The origin and destination virtual countries must each explicitly approve.
  Approvals must come from two **different** authorized administrators with
  `canActivate=true` for the respective country.
- Until both approvals, status DRAFT; no waiver.
- Once ACTIVE, the agreement supports an **in-game VISA_WAIVER** in both
  directions; each player still needs active origin citizenship and a valid
  SIMVERSE INTERNATIONAL_PASSPORT.
- **An existing manually configured route overrides the agreement,**
  including CLOSED or inactive routes; explicit closure cannot be bypassed.
- No real-world ECOWAS, Schengen or bilateral arrangements are inferred.
- The governance UI is restricted at `/profile/governance`, with country
  policy/treaty management and approval buttons.

## Endpoints
- GET `/api/player-governance` (country governor only)
- POST `/api/player-governance/citizenship-preview` (authenticated player)
- POST `/api/player-governance/policies` (authorized draft proposer)
- POST `/api/player-governance/policies/[policyId]/activate` (distinct approver)
- POST `/api/player-governance/treaties` (country-scoped proposer)
- POST `/api/player-governance/treaties/[agreementId]/approve`
  (separate origin and destination representative approvals)

## Additional features intentionally deferred
- Full domestic and international visa-class taxonomy (work, student,
  tourist), fees, appeal, renewal, reissue and revocation UIs.
- Residency accumulation rules beyond issued SIMVERSE residency start date.
- Governed grants provisioning, operator audit/signature chain and a
  production-grade governance console.
- Treaty expiry, suspension, revocation, version amendments, disputes,
  resident limits and world-economy consequences.
- Actual travel events, character transportation or physical border crossing.
- Full multi-country treaty organizations/regional blocs. Phase 4 supports
  secure **bilateral** pilot agreements only.
- Production backfill/migration operations and browser interaction QA.
- No imaginary "complete world government" claims.

## Release checks
1. GitHub CI: Prisma schema initialization, strict TypeScript, ESLint,
   Vitest, Next build.
2. Two-country fixture (Nigeria sourced Earth catalog + synthetic test-only
   second country) verifies first citizenship, approved residency, independent
   two-country policies, second citizenship and no auto-grant.
3. Two independent country approvals activate treaty; before that it
   contributes no waiver. An explicit CLOSED travel route still blocks it.
4. Cross-tenant and unauthorized users cannot propose/activate or see private
   governance desk.
5. Profile screens need manual responsive/browser review and data migration
   review before merging any stacked pull request.

This branch stacks on Phase 3 PR #9; Phase 1/2/3/4 must be reviewed
in dependency order before going into `master`.
