# SIMVERSE Profile — Phases 0–4 Implementation Tracker

Date: 2026-10-29
Branch: feature/profile-unified-phase0-4-20261029
Base: feature/team-settings-phase3-collaboration (draft PR #31)
Dependency chain: master → #28 → #29 → #31 → this branch.
**This is development code, not a claim of deployed or visually verified functionality.**

## Phase 0 — Architecture and safety checkpoint
- **Account:** User model remains source of display name/email and avatar image.
- **Player profile:** PlayerIdentity owns unique username, permanent SV ID, biography, privacy, creator label, optional country, banner, and the new avatar appearance JSON.
- **Social:** reuse SocialFriendship and /api/social/friends, /social for chatting; no new social tables.
- **Creation:** read existing Project, World, Simulation, AnimationProject and MediaShare rows. Private creations are bounded by current workspace membership. Public portfolio contains **only PUBLIC media shares**, excluding unlisted and private.
- **Security:** existing draft PRs #28, #29, #31 supply password/session/2FA/avatar-upload/privacy/export foundations; do not merge out of order.
- **Access:** public profile remains PUBLIC-only; private SIMVERSE ID, email, visa, documents, wallet and role data do not appear in public profiles.
- **Database:** one nullable PlayerIdentity.avatarAppearanceJson column. No table reset or destructive migration intended.
- **Screenshot/QA gate:** UNVERIFIED. This API-only development environment cannot launch the user's app, capture real UI screenshots, execute migrations or run full npm verification. A reviewer must capture 390px mobile and desktop screenshots and test two accounts.

## Phase 1 — Unified profile
- Implemented in code: /profile identity header, seven sections, optional setup checklist, social/creation summary cards, existing identity edit form, visitor link.
- Missing verification: contrast, tap targets, mobile scroll, empty states, language clarity, save/refresh.

## Phase 2 — Identity, uploads, account controls
- Reused: draft #28 password/session/preferences; #29 2FA/email/native avatar; #31 export/deletion requests.
- Added: banner upload endpoint with existing image signature/size checks and owner-scoped replacement; player form provides avatar and banner upload UI; internal hosted image URLs accepted by player identity validation.
- Must verify: security-draft CI, email sender configuration, recovery codes, upload security, migration and DB backups. Do not represent optional Google Drive setup as universally active.
- Not implemented: production image-processing/CDN, direct in-form crop/resize, autonomous account deletion.

## Phase 3 — Social + creations
- Added: public profile add/accept/remove friend actions, one-click message deep-link to accepted-friend chat; published media showcase; private workspace creation directory.
- Public lists intentionally exclude unpublished worlds/animations/projects because no separate authorized public publishing contract exists for those modules.
- Missing: full creator publication pipeline, thumbnails, report flows, richer privacy controls, achievements, social graph privacy options and actual two-user browser QA.

## Phase 4 — Player avatar visual proof
- Added: validated account-owned appearance JSON, authenticated GET/PATCH, defaults for old accounts, basic test, 3D character customization and reusable renderer for /profile/avatar and /profile/avatar/world.
- Prototype only: original procedural low-poly figure and a compact scenic test. The same saved colors/height/hair are loaded in both routes.
- **Not yet completed:** true game-world spawn, movement controls, imported GLB/FBX humanoid rigs, reusable animation-state contract, clothing assets, multi-avatar sessions, mobile performance measurements and real-world browser screenshots.
- Acceptance requires save → refresh → same avatar → enter a genuinely playable runtime with the same avatar, including WebGL fallback. Current prototype is not sufficient for full Phase 4 closure.

## Verification plan (run on disposable local database first)
1. Back up actual data and inspect the stacked Prisma schema before migration.
2. npm ci; npm run db:generate; npm run typecheck; npm run lint; npm run test; npm run build. Run schema push only in a disposable database, not the production one.
3. Register two accounts: private profile inaccessible; PUBLIC profile visible; no email/SV ID/document leaks.
4. Set username/bio, upload small PNG avatar and banner, save, refresh, check display in /settings and /u/username.
5. Profile A sends request to B; B accepts; A opens direct message; B blocks; API must deny chat.
6. Create an unlisted share; it must not appear in public portfolio. Change it to PUBLIC; it must appear. Private works remain owner-only.
7. Customize avatar, save, reload, open /profile/avatar/world. Test disabled WebGL and low-end mobile.
8. Confirm PR dependencies and GitHub checks are green before merge, with a manual browser review.

## Current status
- Phase 0: documented code inventory and safety contract; screenshots/CI pending.
- Phase 1: code implemented, unverified UX.
- Phase 2: code built on draft dependencies; unverified and not merged.
- Phase 3: social + limited media portfolio code implemented; publication and moderation still incomplete.
- Phase 4: persisted procedural-avatar prototype built; true world integration NOT done.
- No production-ready certification is given.
