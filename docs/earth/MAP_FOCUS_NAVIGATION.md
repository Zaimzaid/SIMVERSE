# SIMVERSE Earth — Country-first Map Focus Navigation

## Purpose
Bring the map-first navigation from the owner's visual concept into the existing
SIMVERSE Earth geography explorer without fabricating owned land or real
administrative boundaries.

## Implemented as a dedicated, reviewable UI slice
- The global SIMVERSE desktop sidebar starts **collapsed to a compact icon rail**
  on `/earth/geography`, preserving a button to restore it. Other authenticated
  platform screens retain their existing navigation behavior.
- The Earth explorer's own `My Country` chip remains visible above the map,
  including when information panels are hidden. If the protected catalog
  contains exactly one supported country (currently Nigeria), that country is
  displayed; if it contains multiple countries, the user must select one.
  This is the **currently browsed country**, not an inferred account nationality.
- The chip opens a keyboard-operable menu: My Country, States, LGAs,
  Cities/Towns, Development Zones, and My Land. Each place selection uses the
  existing authenticated geography API and automatically focuses the camera.
- The **My Land** panel is intentionally a *future feature placeholder*:
  claiming/purchasing and virtual ownership have not been implemented.
  It never invents plot counts or ownership records and does not provide a
  simulated purchase action.
- Blank map clicks hide the large details sidebar, allowing the map to fill
  the available horizontal space. Clicking a virtual plot or development
  marker still opens the relevant information. A visible `Show details` control
  restores the panel; users do not lose access to the existing plot list.
- MapLibre resizes after map layout changes to avoid clipped/stretched tiles;
  WebGL fallback remains a text/list interface.

## Future account and ownership integration (not claimed complete)
A later profile setting should persist the user's preferred home country
*per user, across devices*, rather than inferring it from IP or forcing
Nigeria globally. Future Phase 5 land ownership should provide My Land
list/map filters backed by authorized property holdings, not workspace-wide
development zones. Include saved properties and construction projects only
after corresponding persistence, permissions, and audit workflows exist.

## Acceptance checks
- On desktop, opening `/earth/geography` collapses the global sidebar;
  `Expand platform navigation` restores it without changing the map URL.
- On mobile, the existing global drawer continues to work; the country chip
  opens an accessible, scrollable navigation menu.
- In an empty or multi-country catalog, the chip does not claim a user's
  nationality and can list supported countries.
- With a single supported country, the chip displays its sourced name
  (Nigeria in the current local proof).
- Select Nigeria → Lagos, then an available LGA/city/zone. Place selection
  should refocus without repeated manual zooming.
- Clicking a blank map area hides details; choosing a virtual plot restores
  the panel with its real generated ID and area.
- My Land shows a transparent Phase 5 notice with **no ownership claim**.
- Verify at desktop width and 390px mobile; map and menu must not overflow.
- TypeScript, ESLint, tests, production build and browser verification must
  pass before the pull request is merged. This document is not itself a
  claim that visual behavior has been tested.

Dependent drafts: Phase 4.5 navigation and street context, then sourced
settlement/zone markers. No changes to `master` or virtual-land purchase logic.
