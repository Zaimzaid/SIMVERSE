# SIMVERSE Planet — Phase 4 Public Country Discovery

Date: 2026-10-30
Scope: Published fictional country display on the interactive Signature Orbital Planet
Branch: `feature/planet-public-country-discovery-phase4`, stacked on Phase 3 `feature/planet-country-creator-phase3`

## Public experience

- The `/planet` viewer fetches the **authoritative public country catalog** from `GET /api/planet/countries` on load.
- If the country table is empty, the public planet remains empty: no default Galex, no imported Earth country boundaries or seeded fantasy nations.
- Published countries render as colored translucent fills and luminous boundaries on the spherical planet. Separate island polygons and holes are supported by the renderer.
- A visitor may drag/rotate, zoom, click a visible territory, select a name label or use the searchable published country list.
- Selecting a country highlights its border, displays a concise info panel and its approximate area, and reveals the **View country overview** link.
- Search-selection rotates the globe to put the selected country in view. All selection is derived from stored geometry and point-in-polygon tests; the decorative orbital rings are not clickable territory.
- Country overview route `/planet/countries/[countryId]` loads the specific published revision, returns 404 for unpublished or nonexistent countries, and does NOT pretend an explorable 3D city exists.
- The public catalog displays **only published revisions**, never saved drafts or unfinished edits. The number of published countries is dynamic.
- WebGL failure still leaves the accessible country list and country overview reachable. Errors show Retry rather than presenting stale zero counts as confirmed truth.

## Existing systems preserved

- Original Earth explorers and imported geographic tables are unchanged.
- Owner's unfinished visual refinement and Phase 3 Country Creator remain separate stacked pull requests; do not merge Phase 4 ahead of them.
- There are no schema changes and no auto-created countries.
- Phase 5 enter-country runtime is not part of this phase; the button is explicitly named **View country overview**.

## Implementation

- `src/lib/planet/public-country-geometry.ts` provides published-country types, dateline-aware point tests, MultiPolygon island and interior hole tests; tested in `public-country-geometry.test.ts`.
- `src/lib/planet/signature-planet-renderer.ts` holds a separate public country overlay group, dynamically triangulates transparent polygon meshes with islands/holes, draws borders, handles selection styling and projects screen-position labels. Earlier admin Creator preview is preserved.
- `src/components/planet/signature-planet-explorer.tsx` loads published backend data with request abort handling, accessible search and a responsive selected-country panel.
- `src/app/planet/countries/[countryId]/page.tsx` provides a publication-pinned read-only country overview.

## Acceptance / verification

- GitHub Actions (Prisma preparation, TypeScript, ESLint, Vitest, Next production build).
- Manual desktop/mobile browser QA for 0 / 1 / several published countries and simple polygons, multipolygons with islands/holes, antimeridian cases, country selection, labels, orbit motion and touch.
- As Admin, create/save/publish a country in `/planet/create`, then visit `/planet` and verify its public boundary and name appear after refresh; unpublished drafts must not be visible.
- Test that archiving removes a country from public list and globe after reload, and that a new unpublished draft revision does not change the public geometry.
- On real mobile/WebGL fallback, users must still be able to find and open a published country.
- Release must not be claimed visually accepted until screenshots and manual interactions are actually checked.
