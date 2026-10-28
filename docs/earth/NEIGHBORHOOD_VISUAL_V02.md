# Marina Junction V0.2 — Visual-First Street and Plaza Upgrade

## Status
This is a browser-rendered, original procedural **visual prototype**, not a
photorealistic Lagos city. Its purpose is to compare before/after screen
recordings and actual performance on the owner's laptop.

## V0.2 improvements
- Four featured building frontages and the adjacent civic plaza receive
  layered glass, mullions, shade canopies, simple balconies and original
  canvas-drawn signage rather than expanding the city indiscriminately.
- Landscaped stone planters, shaded plaza seating, kerbs and a street shelter.
- Eight moving low-poly residents with looped arm swings, for illustrative
  street activity, not AI NPCs or pathfinding.
- Nine existing decorative cars receive more distinct rooflines, hubcaps,
  lamp housings and body trim. Traffic remains scripted and non-physical.
- A contextual backdrop skyline helps prevent an isolated-grid appearance.
- More balanced skylight and exposure; collision-aware walk camera and
  draggable orbit in the aerial overview.
- Showcase street button positions the camera near the newly detailed area.
- Approximate FPS and current Three.js draw-call count displayed on screen.
  These are measured browser telemetry, not guaranteed performance.

## Implementation
- src/lib/earth/neighborhood/showcase-v02.ts: visuals and resident animation.
- src/lib/earth/neighborhood/renderer.ts: lighting, camera, traffic and telemetry.
- src/components/earth/neighborhood-showcase.tsx: visual controls/readout.
- src/lib/earth/neighborhood/world.test.ts: safe focus and model invariants.
- No third-party asset downloads, no new npm dependencies, no 3D engine
  export and no changes to GIS or the identity/economy backend.

## Test on Windows
1. Preserve existing uncommitted changes; switch to branch
   feature/marina-junction-visual-v02.
2. Run npm ci and npm run dev -- --port 3020.
3. Log in; visit http://localhost:3020/earth/neighborhood.
4. Click Showcase street. Confirm plaza and feature facade are visible.
5. Walk with WASD, sprint with Shift, rotate with mouse, use Overview and
   back to Walk; check collisions, clipping and corner behavior.
6. Click buildings, toggle virtual plot guides, keep fictional land warning.
7. Test Low, Medium, High; record observed FPS/draw calls, freezes or lag.
8. Inspect phone-width controls with Firefox responsive mode.
9. Compare V0.1 and V0.2 screenshots at similar camera angles. Rate
   architecture, street life, lighting, movement and performance.

## NOT implemented
Photorealism, free/CC0 third-party assets or their license manifest,
animation-rigged characters, NPC AI, traffic AI, interiors, road connections
to an infinite world, real Lagos GIS streets/buildings, property purchases,
multiplayer, persistent world or live platform integrations.
Also no measured laptop performance until owner testing.

## Release rule
GitHub Actions must pass TypeScript, ESLint, Vitest and Next build.
This PR stays draft until human browser inspection and owner acceptance.
It stacks on existing 3D proof PR #6 and does NOT touch the separate
player identity/career feature stack.
