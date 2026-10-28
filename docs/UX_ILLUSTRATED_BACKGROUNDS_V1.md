# SIMVERSE — Illustrated Page Backgrounds V1

## Goal
Replace empty dark panels and washed-out plain white light-mode pages with
actual local illustrated imagery, while retaining legible buttons, documents,
forms and the existing responsive navigation.

## New original lightweight image assets
The five vector illustrations below are created for SIMVERSE and live under
`public/backgrounds/`; they have no remote URLs, purchased licenses, network
dependencies, fonts or raster payloads:
- `simverse-city-night.svg`: futuristic waterfront skyline with lit high
  rises, avenue, palms and a nighttime atmosphere.
- `simverse-city-day.svg`: same city composition in bright daylight for the
  light-mode home and dashboard heroes.
- `simverse-world-atlas.svg`: fictional translucent orb, map grid, orbital
  and geographic motif for Explore and Economy spaces.
- `simverse-creator-grid.svg`: abstract layered 3D workspace blueprint for
  Create and Simulation pages.
- `simverse-identity-cards.svg`: decorative SIMVERSE-only virtual profile
  card shapes and ambient identity motifs for Profile and My Documents.

None purports to depict the real Lagos geography, real travel documents,
real addresses or screenshots of an already-playable city. The illustrations
are decorative and are not to be mistaken for the user's actual 3D viewport.

## Where the images are actually used
- Public homepage `/`: complete wide immersive dark or light city hero.
- Authenticated home `/dashboard`: prominent cityscape welcome panel,
  automatically switching night/day with the existing theme setting.
- Global authenticated shell: ambient fixed low-opacity area illustration
  behind content; Explore/Economy uses world art, Build/Simulations creator
  art, My Life virtual identity art, Home subtle cityscape. Large maps and
  3D economy views automatically reduce ambient art opacity.
- `/create`, `/simulations`, `/economy/lab`, `/profile` and
  `/profile/documents`: area-specific scene header art, with appropriate
  text overlays in each theme.
- Main functional forms, interactive maps, nav menus and cards remain
  solid/semisolid so backgrounds never obscure controls.

## Design and performance
- Theme rules use `html[data-theme="light"]` and the existing ThemeProvider;
  no flash of unstyled content, no new runtime state.
- Sky/city image colors automatically change to actual day artwork in light
  mode. Layered overlays preserve dark text on light and light text on dark.
- `prefers-reduced-motion` respected; no animated background or autoplay
  that drains a laptop or induces motion sickness.
- 5 SVG files, all under 100 kB, no external image API, no added npm
  dependencies or image loading at interactive frame rates. Browser caching
  shares each illustration across pages.
- Backgrounds are accessible `aria-hidden` decoration and never encode
  critical text. All important information remains ordinary HTML.
- Entire image system can be replaced with licensed WEBP backgrounds later
  without changing navigation routes or backend APIs.

## Manual laptop review (required)
1. Check out `feature/platform-illustrated-backgrounds-v1` after preserving
   uncommitted work. Run `npm ci`; `npm run dev -- --port 3020`.
2. Open `http://localhost:3020/` and `/dashboard`, switching dark/light.
   Confirm a **different city image** appears in each mode, and heading,
   buttons and navigation remain clear.
3. Open `/create`, `/profile`, `/profile/documents`,
   `/economy/lab`, `/simulations` and `/earth/geography`. Verify each
   decorative background matches its area and never hides content.
4. Check 390px, 768px and 1366px Firefox responsive widths, plus browser
   zoom at 200%. Hero must not cause horizontal overflow.
5. Watch DevTools Network for 200 responses from
   `/backgrounds/simverse-city-night.svg` (dark) and day artwork
   (light), and check that textures remain cached across navigation.
6. Compare sidebar/headers/buttons in both modes, report any unreadable
   labels or over-busy imagery. Test with slow network or disabled images:
   app remains functional with plain fallback colors.
7. Compare a screenshot against the previous completely flat background
   before approving. CI cannot substitute for visual QA.

## Dependency and release
Draft PR stacked on Virtual Document Wallet PR #18, which includes UI
Navigation PR #17. This branch does not merge the separate Marina Junction
3D city branch PR #16. No original backend schema, account permissions,
payment logic or player identity rules are altered.

The artworks are static illustrations, not photos or 3D renders of the
SIMVERSE city. Blender + optimized glTF city work remains a separate next
stage. Keep this background PR draft until laptop visual acceptance.
