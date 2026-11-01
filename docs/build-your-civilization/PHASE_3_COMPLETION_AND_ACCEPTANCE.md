# SIMVERSE — Phase 3 Completion Package and Release Gates

**Working branch:** `feature/build-your-civilization-phase3-completion`, stacked on Phase 3B.1 PR #55 (then #54, #53 and Phase 1 #47). **Phase 2 is paused.**

## Implemented in source

- 3A: Permanent existing SIMVERSE ID preserved; ten preferred founding-nation choices and proposed Arandia pilot interest, with authenticated persistence and no false privileges.
- 3B.0: Profile UX improvements and private saved future-citizenship draft.
- 3B.1: Optional founding-country application intake, published-country and independent intake gates, pending/denied/withdrawn lifecycle, private reviewer queue and denial, all scoped separately from old EarthGeoPlace citizenship.
- 3B.2: Real *fictional primary* nationality ledger, **one per user**; independent country-specific reviewer grants, two different reviewer endorsements and an operator-provisioned issuance gate matching the application policy version, confirmed published fictional-country version. Applicant cannot review themself; old Earth citizenship/passports remain unchanged.
- 3C: Separate approved-district registry and one-home-per-account residence ledger. Joining requires active matching primary citizenship, a published country, an active district with a reviewed geographic version and capacity; transfers have a 30-day cooldown and atomic seat-count updates. District movement history and audit trail retained.
- 3D: Seven-day published-country visits separate from country citizenship, home residence and ballot district. One eligible voting district per account, derived from active approved residence after 14 days' continuous tenure. Moving resets eligibility; travel never creates voting rights.
- 3E: Unit/integration tests of double approvals, negative gates, uniqueness, district capacity, transfer cooldown, absence of unreviewed district access, visiting other nations, and protection against cross-user rights.

## Important operating constraints

**Phase 2 has not published or authenticated any actual fictional continents, countries, cities or districts for use in live citizenship/residence.** This package installs no fake geography or residency. Its outward-facing systems remain **closed by default** until the real Phase 2 geography and independently reviewed operator enablement are complete.

- Fictional country publication still controlled by existing independent FictionalPlanetSteward grant.
- Founding-country intake is separately operator-opened; no ordinary user endpoint provisions that gate.
- Reviewer grants are per-country and provisioned separately; no public role-grant API.
- Primary-citizenship issuance requires a distinct `FoundingCitizenshipIssuanceGate.enabled` and matching policy version. No public endpoint can enable the gate.
- Every application is limited to one submission per account for this pilot. Resubmission, dual/multiple nationalities, appeals, citizenship revocation and cross-national residence transfers require later reviewed policies.
- `FoundingDistrict` geographic version is an **integration placeholder**. A verified, versioned Phase 2 geographic authority must be connected before production district activation; no UI or public activation endpoint exists.
- Actual electronic voting and ballot storage are **not** implemented here. The phase calculates one eligibility/district designation for a future district assembly, not a ballot cast or election.
- No real-world citizenship, migration, visas or legal rights are created.
- No payments, Vascoin transfers or financial benefits result from these records.

## Migration, QA and deployment restrictions

This change adds several Prisma models to the previous draft schema, and additional fields to `FoundingDistrict`. No production migration or live database update has been performed. **Do not run Prisma db push or integration tests against valuable player data.** Use a disposable SQLite DB and verify additive migration with a backup, restore trial and rollback plan before any future deployment.

Phase 3 acceptance checklist:

- [ ] TypeScript, ESLint, complete unit/integration tests and Next production build green.
- [ ] New checkout with independent disposable DB; existing profiles and old Earth citizenship function.
- [ ] Browser at 320px, 390px, tablet and desktop; forms usable in light/dark, correct copy, accessibility.
- [ ] Two test accounts: preferences/drafts isolated, unauthorized reviewer blocked, no self-approval.
- [ ] Default local environment: approved countries and districts remain absent. Intake/issuance/join disabled, no hidden automatic nationality.
- [ ] Disposable integration fixtures verify independent double endorsement and one primary.
- [ ] Disposable integration fixtures verify a single residence, capacity, transfer delay, travel and voting eligibility.
- [ ] Owner inspects real country/district geography after Phase 2 resumes and explicitly accepts operator migration/policy/activation.
- [ ] Merge dependency chain resolved with branch-by-branch code review and safe database migration plan; no direct production release from this stacked draft branch.

## Acceptance language

**Code-level Phase 3 completeness** can be evaluated once CI and browser QA pass. **Live-world activation cannot be declared complete** while Phase 2 geography, human-reviewed membership policies, production migration and operational authorization are outstanding. A green test suite is not a production deployment or owner acceptance.
