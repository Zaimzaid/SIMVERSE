# SIMVERSE — Phase 8: Citizen-Led Development Feasibility Pipeline

**Status:** implementation in a draft stacked GitHub branch, not merged or deployed.
**Branch:** `feature/build-your-civilization-phase8-development-pipeline`
**Base:** `feature/build-your-civilization-phase7-land-planning` (PR #60, itself stacked on Phase 6 PR #59 and prior civilization drafts).

## What the code does now

- Starts from a **district-assembly proposal independently shortlisted for staff feasibility** (Phase 4); not an ordinary submitted/unmoderated/voted idea.
- A separate active per-district **FoundingDevelopmentStaffGrant**, not inherited from creator roles, staff title, assembly moderator, planner, citizenship or workspace permissions, is required to open, review or modify a case.
- Every shortlisted proposal can have at most one **FoundingDevelopmentCase**. Staff cannot open a case about their own citizen proposal; an independent reviewer different from the person who opened the case and its author records the feasibility decision.
- Feasibility decisions: **FEASIBILITY_REVIEW → NEEDS_REVISION / DECLINED / FEASIBLE_CONCEPT**. These are analysis outcomes, NOT `APPROVED` construction, completed projects or binding budget allocations.
- Indicative VC cost estimates are optional reference numbers only. No funds are reserved/debited and estimates are never displayed as allocated budget.
- A feasible concept can reference a **development-class Phase 7 schematic area from the same district** as an internal nonbinding location candidate. Protected/civic reserves, other districts, missing or non-draft area plans and forged approvals are blocked.
- Staff can publish dated **planning-status updates** with strict kinds (review, consultation, geography dependency or hold), a bounded length and daily rate limit. A district resident can see these updates on their own private development progress board.
- Dedicated pages: `/profile/civilization/development` for residents (with a clearly labeled example preview while no district is active), and independently gated `/profile/civilization/development/staff` for staff.
- APIs: authenticated `GET /api/civilization/development` for a caller's own district; `GET/POST /api/civilization/development/staff` for scoped staff queues and actions.
- Audited staff intake, review, schematic candidate selection and public planning updates. No issuance, wallet balance, land title or build object is created.

## Important truthfulness and safety constraints

**Phase 2 is paused**. The current fictional-country and district dataset lacks independently approved, authoritative world-space district polygons and parcel geometry. Phase 7's 10,000 × 10,000 coordinate diagram and `FoundingDistrict.verifiedGeoVersionId` text marker are not authoritative site data. No project may become physically placeable, constructible, funded or completed from these records.

**Vascoin and treasury balances are read-only indicators** within the staff queue. There is no district treasury-spending endpoint, no way to release VC to an artist/vendor, no simulated crowd-funding escrow, no payment acceptance and no promised project return. A community majority, an individual staff review or a schematic candidate never commits funds.

**Public communication should not promise project delivery or publish private reviewer comments.** The citizen page shows only case status and deliberately public staff planning updates, not internal assessment text or itemized feasibility notes.

## Live activation gates remaining

1. Approved country, city and district boundaries from Phase 2; independently signed-off topology and verified spatial foreign keys.
2. Real candidate-site verification and containment outside protected ecological, roadway, utility and civic reserve corridors.
3. Full development approvals: independent reviewers, policy versions, land capacity/utility engineering, safety standards, project milestones and staff construction authority.
4. Budget appropriation, project costing methodology and independent controlled treasury issuance/expenditure policies (never spend from this Phase 8 case directly).
5. Delivery tools: 3D asset acceptance, placement validation, world revision publication, versioning, rollback and a genuine citizen-visible before/after.
6. Abuse/anti-corruption safeguards, conflict-of-interest escalation, formal appeals and reviewer governance.
7. Review of Prisma additive schema migrations, data backup, rollback, account deletion/export compatibility and any restriction from journal relations.
8. Browser acceptance on desktop and mobile, dark/light modes, plus multi-account and real-world performance tests.

## Automated acceptance

- Unauthorized users and arbitrary district members cannot access the staff queue.
- Staff cannot self-review either their proposal or a case they themselves opened.
- Only already-shortlisted proposals may start one feasibility case.
- Proposed financial/spatial/construction 'approval' extra fields are rejected.
- Protected land and foreign-district schematics cannot become candidate locations.
- Citizen status/progress data is isolated to a currently approved resident of the district.
- Every response explicitly says **no construction and no funding**.
- Prisma on disposable SQLite, TypeScript, lint, full unit/integration suite and production build must pass.

**Classification:** a code-complete feasibility and progress-reporting foundation **after CI**, not a launch-ready physical development engine. No production migration, external action or merge occurs automatically.
