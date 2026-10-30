# SIMVERSE map-first MVP — October 2026

## Current decision
No 3D environment in the MVP geography flow. The user will provide or commission environments later. The map contains five fictional continents, ten founding countries, their capitals, and eight proposed Aven districts including Anything War.

## Routing
- `/planet`: new interactive fictional map.
- `/earth`: redirects to `/planet`, replacing the public real-Earth entry experience.
- `/aven/mvp`: redirects to `/planet`.
- `/aven/scene`: deleted (discarded 3D proof).

## Safety
Existing Earth import data, database tables, authenticated geographic routes, economy, player profiles and server services were **not deleted**: doing so without a dependency audit risks data loss and broken user features. The legacy public explorer component is unused by the replaced public page but is retained pending full reference audit.

## Accuracy
The SVG is an illustrative schematic, **not** geodetically correct country/state boundaries. Country and continent names are approved; district boundaries and geometry are placeholders. No playable 3D content is claimed.

## Verification still needed
Run typecheck, lint, unit tests, build, and browser smoke tests on /planet, /earth, /aven/mvp. Review authenticated map routes and navigation links before any broader removal of legacy geography. Do not merge before CI and user acceptance.
