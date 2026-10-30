# Aven MVP 1.0 — implementation foundation

## Status
First increment: interactive **venue directory** at `/aven/mvp`. This is a scope/navigation prototype, not a 3D world or gameplay delivery.

## MVP candidate locations
Arrival Plaza; Anything War Headquarters (reception, fighter inventory, AI battle); Starter Apartments; Property Agency; Convenience Store; SIMVERSE Bank; Public Park; Transport Terminal.

## Deferred
Custom construction, racing stadium, national government/elections, international travel, full economy and multiplayer battle tournaments.

## Architecture gates
1. Audit existing Marina Junction scene, player identity, Earth geography and Economy Lab before connecting or replacing any system.
2. Implement a single small walkable Aven district, using optimized assets and performance measurements on representative devices.
3. Add venue entry/exit and interaction with server-authoritative player identity.
4. Add one complete Anything War PvE loop (lion/tiger assets, battle state, tactical actions, results).
5. Implement housing only after ownership, transaction safety, access control and persistence are tested; no real-money convertibility.
6. Validate integration, security, accessibility, mobile performance and gameplay with end-to-end tests before any release.

## Acceptance criteria for this increment
- `/aven/mvp` loads as a responsive route.
- Zone filters change displayed venues.
- Selecting a venue displays its zone, activity and implementation status.
- Deferred features are clearly labeled.
- No unimplemented feature is represented as live.
