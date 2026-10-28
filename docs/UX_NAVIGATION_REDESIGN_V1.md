# SIMVERSE Workspace UI Reorganization — Navigation V1

## Purpose
The previous authenticated SIMVERSE shell put nearly every destination into one
very long left-side menu. This change rearranges the **real existing routes**
without inventing destinations, extending grants, moving business data, or
claiming that unfinished functionality is live.

## New layout
- **Top toolbar:** compact brand, active workspace switcher, live page search
  (Ctrl/Cmd+K), enabled Create action, theme toggle, account menu.
  A horizontally scrollable second row gives six logical product areas:
  Home, Explore, Build, Play & Simulate, Economy, My Life.
- **Left sidebar:** shows only current-area navigation on desktop. Users can
  collapse it to recover working space. For geography and 3D Economy Town,
  it defaults collapsed to protect map/world rendering space.
- **Right contextual rail:** actual permission-filtered quick links, active
  workspace name, shortcuts to real Create/Earth/Profile pages on >=1280 px
  standard routes. Never shows made-up analytics or notifications.
- **Mobile:** top product tabs scroll horizontally; hamburger opens the full
  six-section navigation in an existing accessible drawer. Right rail is hidden
  and content takes available width. No nested horizontal document scroll.
- **Dashboard:** replaces dense overview with a welcoming hero, four
  role-filtered entry cards, real stats, real recent activity, Anything Wars
  actual events. Keeps all service calls and data authorization unchanged.
- **My Profile:** replaces two stacked link banners with three distinct
  service tiles (Documents, Travel, Career) above the existing profile editor.
- **Create:** clarifies copy and limits card columns on narrower viewports.
- Search uses real permitted routes: not a nonfunctional placeholder.
  Navigation hiding is NOT authorization; all server route checks remain.
- Immersive Watch routes preserve their full-screen viewer. Earth map and
  economy world pages do not get the right rail.

## Source of truth
- src/lib/platform-navigation.ts: route-to-area mapping, longest-prefix
  resolution and permission filtering.
- src/components/platform/platform-shell.tsx: adaptive three-zone layout.
- src/components/platform/top-bar-redesigned.tsx: full functional top navigation
  and keyboard-searchable tool launcher.
- src/components/platform/sidebar-nav.tsx: contextual/full drawer modes.
- src/components/platform/context-rail.tsx: helpful role-filtered right rail.
- src/app/(platform)/dashboard/page.tsx: redesigned dashboard.
- src/app/(platform)/profile/page.tsx: profile service tiles.
- src/app/(platform)/create/page.tsx: responsive creation hub.
- src/lib/platform-navigation.test.ts: route mapping and permissions.

## Review requirements
Automated: prisma setup, TypeScript, ESLint, Vitest, Next build.
Manual on Windows/laptop:
1. Log in and open /dashboard, /profile, /create, /earth/geography,
   /simulations and /economy/lab. Ensure all reachable links work.
2. Verify **Home / Explore / Build / Play & Simulate / Economy / My Life**
   change the left menu and active top tab correctly.
3. Search with Ctrl+K (or top Search); query "profile", "earth" and
   "project"; navigate and close with Escape.
4. Collapse/expand sidebar, ensure map canvas retains usable width and
   no horizontal content clipping in Create or Profile.
5. Test settings, account logout, workspace switching and theme toggle.
6. Test Firefox responsive widths 390, 768, 1024, 1366 and 1600 px.
   On mobile, use hamburger drawer and horizontally scroll the top tabs.
7. Test with viewer roles having fewer permissions. No links or quick actions
   should incorrectly imply server authorizations.
8. Inspect keyboard focus and check desktop light/dark contrast.
9. Confirm immersive viewer URLs still omit normal navigation chrome.

## Branch integration
This PR is stacked on Economy 3D PR #15 (therefore player phases 1–6 and
Economy Lab 1–3). The separate **Marina Junction V0.2 PR #16** lives on
an independent city branch and is intentionally NOT automatically included.
Bring the two tracks together only after code/route conflict review.

No backend/schema changes, no assets, and no real-world payment integration.
This PR remains DRAFT until human laptop UX review.
