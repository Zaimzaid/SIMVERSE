# KAVANDRO K2 — Connected fictional world explorer

**Created:** 2026-11-01  
**Branch:** `feature/kavandro-k2-concept-world-navigation`  
**Status:** Code implemented; CI and browser QA required before closing K2.

## Goal

Make **one consistent country concept selection** travel among the flat atlas, the Three.js orbital concept globe, the founding-country detail, and its district-planning hierarchy, without inventing or publishing new territories.

## Implemented in this slice

- Public `/world` exploration hub listing **five original fictional continents** and **ten country concept locations**, with direct country links for map, globe and planning hierarchy.
- Shareable `?country=<slug>` selection for `/planet/planning/map` and `/planet/planning/globe`. Unknown values safely resolve to the first founding nation; no arbitrary query content is rendered as an authenticated country.
- Selecting a country on the flat atlas updates its highlight, selected info and address without losing map layer settings. A link carries the selected country to the globe.
- 3D concept globe offers an accessible country selector, focuses the selected country using the same original planet-local spherical UV coordinates, and links to the matching atlas and country plan. It pauses automated rotation when a selection is focused.
- Country plans have synchronized links to the map and globe.
- District planning slots each have a distinct readable detail URL `/planet/planning/[slug]/districts/[districtKey]`, displaying their parent country/state/city and honest status. They do **not** claim a mapped polygon or real placement.
- Public entry links and citizen navigation expose the concept-world hub.
- Pure utility tests validate all 10 slugs, rejected invalid values, finite camera focus, and district hierarchy resolution.

## Product scope and honesty rules

This is a **concept-world navigation milestone**. The main `/planet` route remains a different, empty/unallocated first-stage visual proof. Do not call either of these views official geographic publication.

- No real-Earth geometry was imported or modified.
- Original five continents, ten draft countries, and their terrain come from existing versioned concept modules. Nothing in K2 seeds or publishes `FictionalCountry` data.
- District **slots** are identifiers and hierarchy labels only; K2 defines no authoritative district shape, map location, construction zone or membership grant.
- Existing proposal, voting, citizenship and Vascoin staff restrictions remain independently enforced.
- No schema, migrations, database contents, authentication rules, payment or virtual-currency ledgers were modified.
- Globe focus is presentation, **not** a polygon accuracy certification. Verify it visually on desktop and Android.
- WebGL-unavailable users can explore and select every country through the HTML-first `/world` and SVG flat atlas.

## Manual test cases

1. Visit `/world`; verify 5 groups / 10 countries and no false publication claims.
2. Select Arandia from flat atlas. The URL should contain `?country=arandia`; overlay highlights Arandia.
3. Open matching globe link. Arandia should be the selected option and in camera view.
4. Select Terranova on globe; use the flat-map link and verify Terranova is selected there.
5. Open Valdora from `/world` and expand State 1 → City 1 → District 1; open its district detail and return to country/world.
6. Try `/planet/planning/map?country=../../earth` and `/planet/planning/globe?country=bogus`; neither should load a fictional country outside the approved 10-name planning list.
7. Confirm an invalid district ID returns not found.
8. Turn WebGL off: `/world`, flat SVG map, country and district descriptions must remain usable.
9. Test keyboard selection, focus, accessible labels and 390px/768px/desktop layout.
10. Check existing `/planet`, `/earth`, `/social`, `/profile/civilization`, identity and creator tools for regressions.

## Not yet implemented / next geography work

- Owner-approved coastlines/country placement/national boundaries (the existing geometry audit is concept-only).
- Real country-specific district boundaries and national/state/city/district coordinate system.
- Formal spherical GIS, antimeridian and polar behavior, validated polygon topology and versioned data publishing.
- Live in-world citizenship, district assemblies, property placement, roads, buildings, 3D avatars or travel.
- Polished art acceptance and actual browser FPS measurement.

## CI and safety

Use a disposable SQLite database in the repository PR workflow, then TypeScript, lint, Vitest and production build. After clean CI and code review, **merge for local testing**, not for a production activation. Never apply schema reset/migration commands to a valuable SQLite database.

**Recommended next K2 slice:** formal fictional-country boundary design approval and mapping district geometry to the model—before any published world or citizenship activation.
