# SIMVERSE — Build Your Civilization | New Development Roadmap v1.0

**Proposed:** 2026-10-31 | **Source baseline:** `master@b22c410` | **Status:** planning branch — **not approved as a release or implemented as gameplay**.

## Product direction

Start with a **fictional undeveloped planet** containing ten founding countries. Citizens have a primary fictional citizenship, belong to an active district community, play enjoyable games/challenges, and help decide **what** their districts should become and **where** approved improvements go. SIMVERSE staff validate, design and implement approved works. Citizens **do not** directly place arbitrary official buildings. A team-managed showcase country provides games and experiences to all visitors; citizen communities develop other districts.

**Citizenship != district residence != current physical/virtual location.** Travel/visits should not overwrite nationality or voting residence. No compulsory employment or bills; recreational participation remains legitimate.

**No imaginary asset delivery:** fictional budget/Vascoin is nonredeemable game state, not the team's real-world cash. Only accept development funding commitments when the deliverable and team capacity are feasible.

## Provisional world data (planning, not published terrain)

- Five continents; ten founding countries: **Valdora, Arandia, Novara, Dravonia, Marovia, Solandia, Vestria, Altavia, Eldoria, Terranova**.
- **Aven** is Valdora's planned capital and potential SIMVERSE showcase hub; Valdora team-management and Arandia as first citizen pilot remain proposals.
- Administrative model under review: **38 states, 76 towns/cities and 228 potential districts**, where every state is provisionally assigned two cities and three districts per city. Exact province names, shapes, sizes and ratios await geography validation.
- A provisional urban pilot district is **4 km²**; mixed-use 8 km², rural 16 km². Use accurate spherical area calculations and future scale limits.
- A provisional **10% land reserve for SIMVERSE-managed functions** in standard urban districts; transport/environmental/public uses remain separately planned. Do not treat this as automatic property ownership.
- **Launch with one active citizen-led district, one accessible team-managed showcase area, and up to two reserved pilot expansion districts.** The other potential districts are geographically defined or reserved only when data exists and verified, not assumed to be real entities today.
- More districts activate only after minimum engaged population, functional existing communities, operational capacity and geographic/planning approval.

## Gated phases

| Phase | Objective | Minimum deliverable | Exit gate |
| --- | --- | --- | --- |
| **0** | Repository audit and safe baseline | Verified inventory, scope matrix, migration/QA plan, roadmap docs | Tests/device QA/backup review + owner signoff; **partial** |
| **1** | Simplify citizen UI/UX | Citizen dashboard and navigation with old creator actions hidden from citizen views, staff tools preserved | Desktop/mobile usable, no broken routes, permission regression |
| **2** | Fictional planet geography | Ten *approved* country records and validated hierarchy data model; globe displays published regions | No overlap, stable IDs, geometrically valid boundaries, steward-only publishing, visual QA |
| **3** | Identity and districts | Fictional nationality, residence, active district join and migration rules | Register/sign in/join/return works; one ballot residency; privacy checks |
| **4** | District assemblies | Moderated discussions, proposals, announcements, meetings | Multiple users submit/review with membership and abuse controls |
| **5** | Games and challenges | One genuinely playable challenge, scores, results and replay | End-to-end enjoyable pilot, no fake score or automatic credit exploit |
| **6** | Vascoin and treasuries | Separate nonredeemable personal wallet, rewards, audited district funds | Correct balanced ledger, idempotent rewards, rate limits, zero SVC/GFC mixing |
| **7** | Zoning and parcels | District land overlays, reserves, protected corridors, selectable proposal sites | Stable parcels, overlap blocking, citizen cannot modify protected land |
| **8** | Citizen-led development engine | Catalogue, proposal→vote→review→fund→staff implementation→visible map change | One completed small project with legitimate site and persisted audit history |
| **9** | Closed beta | Controlled first-district civilization cycle with real testers | QA, moderation, backups, accessible UX, feedback and returning-player evidence |
| **10** | District competition + expansion | Second/third district, fair rankings, cooperative events, controlled activation | Population-adjusted results and sustainable community participation |
| **11** | Advanced society and progressive 3D | Separate, individually gated commerce, property, avatars, 3D locations and deeper multiplayer | Each feature playable, backed by authoritative persisted state and tested on target hardware |

**Gating rule:** Phase numbers in this plan are **not** the same as the historic Earth 8-phase or earlier M0–M10 roadmap. Existing docs remain historical; reconcile them in the eventual signed-off source of truth. Some implementation work may run in parallel *after* dependencies and safety gates are satisfied.

## Important architectural boundaries

1. **Fictional planet vs Earth:** reuse rendering, validation, permissions and spatial algorithms where sound, but do not import real-world country polygons/ISO identifiers into the fictional planet. Existing Earth records are preserved.
2. **Administration authority:** planet publishing by steward; district zoning/proposal approval by explicit district/world governance policy; creator workspace permissions must not confer those rights automatically.
3. **Spatial hierarchy:** Planet → Continent → Country → State/Province → City/Town → District → Zone/Parcel → Approved Development. All objects get stable IDs, parent checks, immutable geography versioning and safe migration strategy.
4. **Land and projects:** a proposal does not create ownership. Reserve protected infrastructure corridors before local projects. Staff must audit final site, capacity, project cost and placement.
5. **Currencies:** `SVC` starter credits, `GFC` Economy Lab money and future **Vascoin** are distinct nonredeemable systems unless a future specifically approved design says otherwise. District development budget is not real cash.
6. **Play before bureaucracy:** immediate games, social interaction and easy exploration are required before citizens spend time planning public works.
7. **Social safety:** reporting, blocking, user privacy, content moderation, fraud controls and appeals are release gates, not optional later enhancements.
8. **Media truth:** concepts, planned regions and placeholder designs must be labeled as such; only tested, available features may be represented as live.
9. **Cost control:** small project catalogue, reusable map assets and capped staff production capacity. Weekly challenges may recur, but custom construction deadlines must not be guaranteed.
10. **Visual progression:** 2D map first, independent 3D technical proofs later, without rewriting underlying place/project identity.

## Pilot scenario (first complete gameplay loop)

1. Register and receive stable SIMVERSE ID, choose allowed primary citizenship.
2. Join the active district or access an available national community while waiting for district activation.
3. View undeveloped land, infrastructure constraints and available project sites.
4. Meet members in the district assembly; submit and discuss a feasible development.
5. Play one fun challenge; receive authorized, recorded in-game rewards.
6. Vote under one-residence-per-citizen rules; approved project opens for **optional** contributions.
7. Staff review site, budget and production feasibility; implement a small map-level result.
8. District map and public project history change; citizens can celebrate/revisit.
9. Testers return on their own and optionally invite friends.

## Measuring success

Record completion of signup, first district join, first meaningful action, first game finished, 7-day voluntary return, valid proposal submissions, vote participation, safe contributions, and **actual** delivery of first project. Do not set success claims based only on registration counts, concept illustrations, or automatic daily logins.

## Constraints and open decisions

- Final 10-country shapes, five-continent land design, state/city/district numbers, capital hierarchy and map scale.
- Team-managed country designation (Valdora proposed), pilot country (Arandia proposed).
- Which first game is fun enough and technically viable from existing modules.
- Vascoin emission and contribution economics; developer implementation capacity; reserve percentage by district type.
- Privacy/age rules, district moderation, vote eligibility, migration cooldown and anti-fraud fairness.
- Runtime deployment, staging hosting and operational spend.

## Immediate next work

Finish Phase 0 browser and disposable-database verification, review the `PHASE_0_BASELINE_AUDIT.md` assessment, then implement the scoped Phase 1 feature-gated citizen UI on another reviewable commit/PR. Do **not** delete code, migrate valuable databases or publish fictional countries during the planning-only checkpoint.
