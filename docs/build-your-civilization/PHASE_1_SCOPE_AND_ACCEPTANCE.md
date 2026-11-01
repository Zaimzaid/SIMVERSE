# SIMVERSE — Build Your Civilization | Phase 1 Scope and Acceptance

**Date:** 2026-10-31  
**Status:** proposed execution checklist only. No UI, database, asset or permission changes have been implemented in this Phase 0 documentation branch.

## Product goal

Replace the ordinary citizen's creator/workspace-first orientation with **Citizen Home → Explore Planet → My District → Games/Challenges → Community → Development → Wallet/Profile** while keeping unfinished actions absent or clearly marked unavailable.

Never treat hiding a button as revoking permissions. Restrict citizen access to routes/API through independently enforced server authorization. Keep authorized staff and legacy creator access where needed, and avoid breaking saved projects or group messaging.

## Feature and route matrix

| Current route or source | Citizen presentation | Authorized staff / historical continuity | Initial action |
| --- | --- | --- | --- |
| `/`, `/dashboard`, `src/app/(platform)/dashboard/page.tsx` | New first-time/returning-citizen experience | Keep existing workspace statistics within staff/creator area | **IMPROVE** |
| `/planet` | Prominent fictional-world entry only when visually verified; clearly mark no countries published | Preserve planet steward APIs | **KEEP / EXTEND** |
| `/earth`, `/earth/geography` | De-emphasize legacy real-world view for fictional citizenship onboarding | Keep Earth records/routes as legacy/staff until data transition tested | **HIDE IN CITIZEN NAV** |
| `/profile`, `/profile/documents` | Citizen profile, nationality documents and privacy | Preserve reviewer workflows, issued records and access separation | **KEEP / IMPROVE** |
| `/social` | Friends, messages, groups, notifications | Preserve block and privacy permissions, groups and calls restrictions | **KEEP / REGRESSION TEST** |
| `/create`, `/projects`, `/simulations`, `/experiences` | No ordinary citizen-facing shortcuts until creator mode deliberately enabled | Existing creator/staff functionality remains reachable under correct role/entitlement | **HIDE / STAFF OR CREATOR** |
| `/entities`, `/assets`, `/worlds`, `/templates` | Not on citizen primary nav | Retain legacy tools and saved data | **STAFF/CREATOR** |
| `/animation`, `/studio`, `/studio/video` | No citizen nav | Preserve work for later optional creator platform | **POSTPONE PUBLIC EXPOSURE** |
| `/anything-wars`, `/tournaments` | Evaluate for a limited Game Centre and genuine completed challenges | Preserve existing simulation mechanics and user runs | **EVALUATE / ADAPT** |
| `/economy/lab`, `/profile/career`, `/profile/work` | Only explicitly supported citizen-facing functions | Keep distinct private GFC lab and existing SVC credits | **HIDE/POSTPONE COMPLEXITY** |
| `/marketplace` | Not required for first district pilot | Preserve listing/ownership and moderator records | **POSTPONE** |
| Planned `/district`, `/challenges`, `/developments`, `/wallet` | Show only implemented pages, or disabled explanatory states | Scope each API/model separately | **NEW; NOT BUILT** |

## Source files to inspect/change in Phase 1

- `src/lib/platform-navigation.ts` and `src/lib/nav.ts`: explicit citizen versus staff/creator navigation; do not rely solely on workspace permissions.
- `src/components/platform/platform-shell.tsx`, `sidebar-nav.tsx`, `top-bar-redesigned.tsx`: mobile and desktop navigation consistency.
- `src/app/(platform)/dashboard/page.tsx`: replace creation-first hero and stats with useful citizen identity, planet and activity entry points; show real data or honest empty states.
- `src/app/(platform)/create/page.tsx`: preserve the creator gateway behind appropriate access; no destructive code removal.
- `src/app/page.tsx`: public brand and onboarding content aligned to new direction, without implying fictional countries have been published.
- `src/app/planet/page.tsx`: keep existing visual prototype truthful and available; country overlay integration is **Phase 2**, not a Phase 1 shortcut.
- `src/app/(platform)/social/page.tsx`: regression coverage only unless necessary navigation integration.

## Proposed acceptance tests

1. Signed-out user can reach truthful landing, registration and login pages.
2. Signed-in ordinary citizen sees clear Home, Explore, Community and Profile without irrelevant technical project/creation calls-to-action.
3. Hidden creator links do not appear in citizen quick actions, mobile drawer, top navigation or command/search.
4. Staff/creator users retain explicitly authorized legacy routes; direct URL and API authorization behavior is verified, including users without access.
5. `/planet` does not claim published countries or functioning entry when no fictional country exists.
6. Current Earth routes are not overwritten; existing saved countries, user records, media, projects and messages remain intact.
7. Profile privacy, friend-only access, blocked-user restrictions and unread social behavior regressions pass.
8. Display at 320, 375, 390, 768 and 1366 px in light and dark themes: no overflow, clear focus/keyboard access, readable content.
9. Developer environment and CI: isolated DB, `npm ci`, Prisma generate, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Actual device/browser QA still required.
10. Every claimed release feature corresponds to a real, authorized, persisted interaction; unfinished features are absent or clearly preview-only.

## Data safety

**No migration is needed solely to simplify navigation.** Any schema change must be reviewed separately. Never run `npm run db:push`, database reset helpers or schema migrations against a valuable local database without backup, copy verification and rollback plan. Preserve `SVC` and `GFC` and do not create new Vascoin money flows in Phase 1.

## Proposed Phase 1 implementation checkpoints

- **P1A — Permissioned navigation model:** citizen/staff/creator paths and tests.
- **P1B — Home and onboarding:** new citizen dashboard grounded in real records or safe states.
- **P1C — Planet and identity entry:** coherent links, existing profile and citizenship workflows remain functional.
- **P1D — Regression and visual acceptance:** tests, recorded screenshots, two-user QA, owner signoff.

Phase 1 is complete only after all checkpoints and the owner acceptance; committing a mock interface alone does not qualify.
