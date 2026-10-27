# SIMVERSE Earth — Marina Junction 3D visual proof (Prototype v0.1)

## Status
Standalone source-code prototype on `feature/earth-neighborhood-3d-proof`.
This is NOT a full Lagos, not a production game, not a GIS copy of real streets,
and not part of the Phase 4 synthetic grid. No acquisition, land ownership,
cash/payment functionality or persisted construction is present.

## Why this exists
Recent Earth development proved geography and 187 synthetic virtual plots, but
players could not visualize an appealing, explorable 3D world. Before a large
world or more backend features, this branch provides one small,
measurable visual-first pilot. We can evaluate its *actual screen appearance*
before scaling or buying any assets.

## What is built
- Route: **`/earth/neighborhood`** (authenticated; standalone immersive viewer).
- Entry: **Explore 3D proof** button on `/earth/geography`.
- Existing pinned `three` package only; no added dependency or paid 3D asset.
- Seeded `Marina Junction` world blueprint: four crossing road axes,
  nine sidewalk blocks (central landscaped civic plaza), 32 modeled buildings,
  32 demonstrative lot guides, street trees, lights, benches, an eastern
  waterfront promenade, and nine continuously driving decorative cars.
- Mixed fictional land uses (small shops, residential, offices, civic).
  Architectural massing includes facade windows, shop awnings/signs, roof
  service units and contrasting materials; not photorealistic scanned assets.
- Walk camera with collision against building footprints, WASD/arrows,
  Shift sprint, pointer drag to orbit, on-screen touch movement buttons,
  aerial overview toggle, select-building inspection, toggle cyan plot guides.
- Automatic LOW mode for narrow screens; manual LOW/MEDIUM/HIGH settings;
  capped FPS, instanced greenery, stronger lighting/shadows on HIGH,
  canvas resize handling and thorough GPU disposal on leaving the scene.
- WebGL error fallback with a link back to the working 2D Earth explorer.

### Source files
- `src/lib/earth/neighborhood/world.ts` — deterministic pure scene blueprint,
  plot metadata and collision/slide rules.
- `src/lib/earth/neighborhood/renderer.ts` — imperative Three.js scene and
  interaction. Browser-only import; never loaded during server rendering.
- `src/components/earth/neighborhood-showcase.tsx` — controls and HUD.
- `src/app/(platform)/earth/neighborhood/page.tsx` — protected Next route.
- `src/lib/earth/neighborhood/world.test.ts` — deterministic/collision tests.

## Review constraints and safety
1. The visual prototype must remain separate from licensed map tile and
   source-boundary imports and cannot create virtual land records.
2. Display persistent on-screen wording that fictional plots have NO real-world
   land significance and NO Phase 5 user ownership or purchase capability.
3. Clickable buildings provide only a fictional building name/type.
4. Never use fake performance numbers or screenshots as proof of rendering.
5. No heavy Unreal export or multi-GB downloads are required; geometry is
   generated on device. This has a deliberate trade-off: procedural buildings
   prove interaction/layout but will not match a high-end handcrafted city.
6. Do not merge until visual QA confirms it is clearly better than the prior
   underwhelming SIMVERSE/RISEWORLD prototypes.

## Technical and manual acceptance gate
Run GitHub checks (TypeScript, ESLint, Vitest, Next build). Later on a real
browser/device, log in and visit:
`http://localhost:3020/earth/neighborhood`.

- The initial camera visibly reveals streets, realistic proportions and
  several identifiable buildings.
- WASD movement and drag rotation work; walk into a building to confirm
  collision, then slide sideways along its edge.
- Click a shop or house and confirm the selected building card.
- Toggle plots and confirm visible synthetic outlines, and disable again.
- Toggle Overview and Walk and inspect scene from above.
- On desktop compare LOW vs HIGH and measure approximate FPS via browser
  performance tools; check WebGL memory and startup time.
- On narrow/mobile display inspect touch directional arrows,
  card overlap and frame rate. LOW should avoid dense facade details.
- Disable WebGL to verify the text fallback and 2D Earth link.
- Verify no geometry persists after leaving the page (disposal).
- Compare a screenshot with design expectations and collect owner feedback
  before committing to later advanced asset pipelines or larger scenes.

## Not done yet
- Texture/PBR/glTF commercial asset pipeline or city-world GIS alignment
- Animated residents, walking pedestrians, traffic AI or physics
- Indoor building exploration, jobs, purchases, properties, plots ownership
- World streaming, persistence, multiplayer, accounts in-scene or servers
- True photorealistic 3D city
- Integration of sourced real Lagos roads/buildings with virtual plots
- Measured performance on the owner's computer or gameplay visual signoff

## Follow-up visual production slice (proposed)
After device review, choose **one small block**, replace selected procedural
buildings with reviewed free/CC0 glTF assets and custom materials in a documented
attribution manifest. Add a low-poly collidable player avatar, an actual camera
orbit rig, real sidewalks/curbs and verified lighting/postprocessing quality.
Set explicit draw-call, VRAM, load time and framerate budgets. Do not enlarge
the area until that block passes visual and performance evaluation.
