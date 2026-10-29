# SIMVERSE Signature Orbital Planet — Locked Design & Implementation Specification v1.0

**Owner-approved:** 2026-10-29
**Document status:** LOCKED product direction; implementation pending
**Repository baseline reviewed:** Zaimzaid/SIMVERSE, master, commit 16945fe (2026-10-29)
**Implementation lead:** ChatGPT working through authorized repository/tools and review checkpoints
**Scope:** SIMVERSE main fictional planetary map and territory creator

## 1. Decision and precedence

SIMVERSE will use a **fictional, initially unallocated spherical planet** instead of the existing Earth-first geographic presentation. No real countries, administrative areas, imported coastlines or national borders appear in the new public planet. Every visible country and subordinate area must be intentionally defined within SIMVERSE. Example: a creator with owner/admin permission may publish a country named **Galex** with an original, measured geographic boundary; it then becomes selectable on the rotating planet.

This owner decision **supersedes the real-world geography presentation and country/state hierarchy assumptions** in earlier docs/earth/* requirements wherever they conflict. Those documents remain historical references for useful technical patterns (authorization, geo-geometry validation, navigation, parcels, persistence), **not authority to import or display real geography in fictional planet mode**. Existing data is not to be deleted before a dependency audit, rollback backup and verified transition.

The design is locked; minor implementation details can change if a technical proof shows that a safer or faster approach delivers the same observable product behavior. Any material product design change requires owner review.

## 2. What users must experience

1. Open SIMVERSE Planet and see one polished, smooth, atmospheric, rotating **spherical planet**, with one luminous tilted orbital ring and one faint secondary ring.
2. On first deployment of fictional mode, the planet has **zero countries**. It must not silently seed Nigeria, Ghana, Galex or any other country.
3. Rotate with pointer/touch; pinch/scroll zoom; reset view; keyboard-accessible country search; mobile list alternative.
4. As an owner/admin publishes countries, their uniquely shaped surface territories appear with subtle tinted fills, clear boundaries and legible zoom-dependent labels.
5. Tap or click a country to highlight it, show a concise info panel and an **Enter country** action.
6. Entering a country must navigate to a genuinely functioning country overview, and later to an interactive 3D country/world scene when that runtime is delivered. Do **not** pretend a scene is complete when only metadata exists.
7. Visitors see only PUBLISHED, accessible countries. Drafts are visible exclusively to authorized editors. Unallocated planetary surface remains visibly unallocated.

### Explicit non-goals for the first playable proof

No mandatory population generation, seamless whole-planet city simulation, multiplayer, economy, virtual real-estate purchasing, creator marketplace, Unreal runtime or user-created countries at first launch. These are downstream integrations, not prerequisites for the first functional planet.

## 3. Locked visual design

| Area | V1 lock |
|---|---|
| Main silhouette | One smooth sphere, no cube/doughnut/fragmented shape |
| Planet surface | Deep sapphire/navy, subtle mineral-like detail, no Earth landmass silhouettes |
| Palette | Base #06172B; deep shadow #020812; sapphire #13466A; cyan #38DCE4; light cyan #B5F7F6; restrained violet #9D81E8 |
| Atmosphere | Thin cyan rim and subtle purple secondary highlight; not overpowering |
| Ring A | One tilted thin luminous cyan orbital ring, visible around/behind planet |
| Ring B | One dimmer, thinner secondary orbital ring |
| Star field | Sparse, quiet, cinematic; no distracting moving particles by default |
| Unallocated surface | Neutral and smooth; **never interpreted as a country** |
| Country fill | Distinct low-saturation tint, alpha blend for visible base texture |
| Country boundary | Thin, clear luminous edge; stronger only when hovered/selected |
| Labels | Clean sans-serif, restrained scale, limited by zoom and collision checks |
| Controls | Minimal desktop/mobile overlay; help and advanced options progressive |
| Country information | Short name, description, approx. surface area, published status; Enter action |

Reference planet composition: centered prominent spherical body; ring tilt selected for a visibly distinctive but unobstructed geography view. Ring geometry is visual only and has no legal/territorial effect. No need for external copyrighted globe imagery.

### Interaction states

- **EMPTY**: default blank orb; public text "No countries have been created yet"; owner/admin shortcut "Create country".
- **IDLE**: published countries have muted borders and optional labels.
- **HOVER/FOCUS**: subtle brighter boundary and descriptive tooltip.
- **SELECTED**: clear edge glow + info card + gentle ring lighting response.
- **ENTERING**: brief, skippable reduced-motion-aware camera move or instant jump.
- **UNAVAILABLE**: accessible error and Retry / Back actions; never a fake interactive country.

Avoid extreme bloom, repeated particle effects, overly saturated neon, dense UI and decorative clutter. Visual quality must be proven with browser screenshots/videos, not asserted from code changes.

## 4. Fictional coordinate and territory rules

Use a **planet-local geographic coordinate convention**, not real-world place identities:

- Planet ID is explicit; V1 displays one active planet. Schema supports multiple planet IDs for future extension without enabling multi-planet UX in V1.
- Planet-local longitude range [-180°, +180°]; latitude [-90°, +90°]; geometry interchange uses [longitude, latitude] order as GeoJSON-style shapes.
- Canonical fictional planet radius for V1: **6,000 km**. This is a game-world measurement convention; it is not Earth WGS84 or an astronomical claim. Changing it later requires audited area recalculation.
- Country territory is a validated Polygon or MultiPolygon on the sphere; canonical area displayed in km² calculated from spherical/geodesic geometry (not pixel area).
- Supports irregular original shapes, detached islands, holes where allowed, antimeridian-crossing geometry and polar-adjacent geometry.
- Published sovereign country polygons **must not overlap**; empty gaps may remain. Admin can draft overlapping proposals but cannot publish until resolved.
- Coordinates, geometry topology and surface-area constraints are server-validated. Reject self-intersections, degenerate shapes, zero area, invalid rings, over-coverage and conflicts.
- Boundaries cannot be derived from Natural Earth or a real nation dataset. Designers may hand-draw original territories, adjust a generated organic shape, or import owner-authored fictional geometry after validation.
- A country is a container/territorial record, **not automatically a giant rendered 3D open-world scene**. Country entry binds to an associated world/scene when one is published.

## 5. Geographic hierarchy and data contracts

Initial functional hierarchy:

PLANET → COUNTRY → REGION/PROVINCE/STATE (optional) → CITY → DISTRICT/NEIGHBORHOOD → ZONE/PARCEL → BUILDINGS/ACTIVITIES.

Subdivision labels are configurable per country, not hard-coded to Nigerian states or LGAs. The source of truth is custom owner-authored geography.

Minimum records:

- **Planet**: id, name, radiusKm, visualSettingsVersion, activeFlag, publication status.
- **Country**: id, planetId, name, slug, description, presentationColor, previewAssetId?, ownerScope, status (DRAFT/PUBLISHED/ARCHIVED), createdBy, timestamps, publishedVersionId?.
- **CountryVersion**: immutable version id, countryId, polygon or multipolygon geometry, computed surfaceAreaKm2, labelAnchor, bounding metadata, shape checksum, revision, provenance (SIMVERSE-authored), createdBy/createdAt.
- **Place**: id, planetId, countryId, parentId?, type, name, position/boundary?, version, visibility.
- **WorldBinding**: countryId or placeId, worldId and optional worldVersionId, entryPosition, readiness status; **not required** to publish map-only countries.
- **Audit**: create/edit/publish/archive/revert actor, time and version.

Never use legacy ISO codes as the identity of a fictional nation. Distinct countries need stable identifiers across renames and shape revisions. A draft's edits must not silently mutate a published boundary. Country publication is audited and authorized.

Data API principles:

- Public read: only published country summaries and generalized display boundaries; bounded responses and appropriate caching.
- Protected admin CRUD: permission-checked create/draft/update/publish/archive/revert, with Zod or equivalent validation.
- Area and topology calculations occur on server, independently revalidated on publication.
- Human-friendly display units: km², with optional km for dimensions; never pretend visual pixels are real distances.
- Integration IDs link to existing SIMVERSE Worlds, Assets, Entities and Simulations without copying or destroying them.

## 6. Country Creator UX

Guided flow for authorized owner/admin:

1. **Create country** → name, optional description and display color.
2. **Position country** → rotate globe, choose center/rough placement.
3. **Shape country** → choose organic generated starter shape or draw boundary / import original GeoJSON; move vertices, undo/redo, preview area.
4. **Validate** → live overlap warnings, topology and size checks, region fit and read-only preview.
5. **Save draft** → only admins see the candidate territory.
6. **Preview as visitor** → inspect label, colors, mobile readability and selection.
7. **Publish** → country becomes discoverable; retains immutable geometry revision.
8. **Edit later** → new draft revision; review changes before republishing; protect existing dependent parcels/places.

The owner should not need to understand GIS jargon. Provide plain-language instructions and advanced geometry tools only when requested. Existing admins must not gain accidental publication rights through public routes.

## 7. Country discovery and entry UX

Planet view is the default and visually dominant experience, not a dashboard full of forms.

- Globe supports pointer drag, touch drag, pinch zoom, wheel zoom, reset/orbit, country click, keyboard search and a country list for accessibility/WebGL failure.
- Labels selectively appear as view scale permits; selected country is always unmistakable.
- On selection: show country name, short description, approx. area, Enter button and optional Explore details.
- Enter navigates to a functioning country overview; if the associated 3D scene is not ready, clearly label it as not yet available and do not misrepresent a metadata page as a living world.
- Existing sign-in/return intent logic can be adapted. Public viewing remains possible; private entry obeys product permissions.

## 8. Engineering design and reuse plan

Repository checked 2026-10-29: Next.js 16.3.5, React 19, TypeScript 7, Prisma 7, Three.js 0.186, MapLibre GL JS 6.15, existing Earth public globe, geography explorer, position/geometry services, and a Three.js neighborhood proof.

### Preferred architecture

1. **Three.js renders the signature exterior planet** (sphere, rings, atmosphere, subtle star environment, country polygon meshes and selection raycasting) so one renderer owns the cinematic orbit and camera interactions.
2. Reuse validated geometry, place data contracts, auth, audit and routing patterns from the existing Earth system, while replacing the real-geography catalogue for fictional mode.
3. **MapLibre can remain a specialized flat/region editor or internal geography view**, where it actually helps; the user-facing signature globe must not depend on Natural Earth tiles.
4. Existing World Creator/3D neighborhood systems inform country interior entry; keep country territory and country world runtime separate so they can progress independently.
5. Avoid a second incompatible app or copy of SIMVERSE. Implement inside the connected repository with feature branches and reviewable PRs.
6. Server is authoritative for territory edits, publication, world bindings and overlap decisions. Client previews are never the source of truth.

### Rendering proof gate

Before committing the globe to production, compare (a) Three.js all-in-one planet and (b) extending MapLibre globe with custom ring rendering, using browser evidence for geometry precision, selection, animation, touch controls and performance. **Three.js is the preferred baseline, not a reason to rewrite unrelated services.** Select the approach that meets the approved look and measured usability with least integration risk. Record the final choice.

### Performance and accessibility

- Target smooth interaction on typical Android/mobile hardware and desktop. Target ≥30 FPS mobile and ≥60 FPS capable desktop in the simple empty/one-country scene, subject to real-device verification.
- Implement pixel-ratio cap, texture budgets, geometry simplification/LOD, pause-on-hidden, render-on-demand where appropriate, reduced motion, disposal, and fallbacks.
- Test 390px mobile viewport as well as desktop; account for low-memory and no-WebGL environments.
- Keyboard-focusable controls, touch-friendly targets, readable info cards, descriptive list fallback and motion controls honoring user preferences.

## 9. Migration from existing SIMVERSE Earth

The existing Earth-oriented flows cannot simply be relabeled; docs and code use sourced Natural Earth land, Nigeria and administrative data.

**Migration policy: safe replacement, never blind deletion.**

1. Capture branch baseline; enumerate Earth places, public tiles, imports, zones, parcels, destination intents, world links and UI references.
2. Back up current database and test fixtures. Determine whether any genuine user-created/claim data already depends on legacy records.
3. Introduce new fictional Planet/Country models and routes in parallel behind a feature switch or dedicated new route.
4. Ensure the fictional public interface reads only the fictional catalog; no source tiles or real countries enter its presentation.
5. Migrate or intentionally archive dependent user-created associations only after a reviewed mapping plan; no automatic erasure of user-owned virtual items or audit records.
6. Replace legacy Earth navigation with **SIMVERSE Planet**; keep safe redirects/deprecation handling for old bookmarks/deep links where feasible.
7. Disable public real-world country/state/city catalogue and old country import scripts for the new planet once verified.
8. Remove legacy code/data only after audit, passing tests, rollback plan and explicit approval for destructive operations.

This migration **does not create real-world land rights**; existing virtual-property legal clarity remains applicable where land features eventually exist.

## 10. Implementation stages and verifiable exit gates

| Stage | Delivery | Evidence/exit gate |
|---|---|---|
| 0 — Baseline/audit | dependency inventory, route map, data relationships, migration/rollback plan | reviewed repo inventory and no user data lost |
| 1 — Visual-first planet proof | isolated playable Three.js globe, both orbital rings, touch controls, atmosphere, zero geography | real browser screenshots/video on mobile and desktop; compelling appearance and smooth navigation |
| 2 — Fictional geographic core | Planet/Country versioned records, topology/area/overlap validation, server permissions, public read API | automated geometry/auth tests and empty database check (0 countries) |
| 3 — Country Creator | guided owner/admin drawing, positioning, draft, preview and publish | create Galex in app, publish original polygon, survives reload; unauthorized user blocked |
| 4 — Public planet integration | country overlays, search, selecting, labels, info panel, empty/list state | public sees published Galex only; globe remains smooth and accessible |
| 5 — Enter-country proof | country overview + real country-to-World binding and a navigable small 3D scene | user selects Galex and enters functioning scene; Back to Planet works |
| 6 — Country expansion | configurable regions/cities, navigation, asset/world connections, camera transitions | sample new place hierarchy and stable integration tests |
| 7 — Legacy transition | replace Earth-first UI and old sourced catalogue access, preserve rollback/data integrity | no real-world coastlines/countries in fictional mode; no broken deep links or dependencies |
| 8 — Release verification | mobile/desktop QA, security, performance, polish, accessibility, README/status/roadmap | all required tests/CI pass and owner accepts visual proof |

**Hard first acceptance milestone:** empty planet → owner creates and publishes Galex → public sees Galex on the globe → selects Galex → enters a real functioning country view → returns to planet. Everything beyond that should build incrementally.

Every stage must be accompanied by visible proof (not just a passed unit test), documented issues and a state of COMPLETE, PARTIAL, BLOCKED or NOT STARTED. Do not claim polished 3D because a file or placeholder route exists.

## 11. Engineering quality gates and collaboration

- Code changes are made on dedicated GitHub branches with small PRs; no unreviewed destructive changes to master.
- Reuse existing commands: npm run typecheck; npm run lint; npm test; npm run build.
- Add domain tests for polygon self-intersection, overlaps, island multipolygons, antimeridian, area, revision history, auth, empty-state and route transitions.
- Browser verify actual rendering, touch, keyboard and reduced-motion behavior; capture screenshot/video evidence.
- Database changes require migration and rollback checks on disposable databases; production credentials/secrets are not embedded in code or documents.
- Preserve existing platform accounts, workspaces, simulations, Worlds and Assets.
- Owner approves major creative direction and destructive data migrations. Implementation lead performs design-to-code work through available connected tools during active work sessions; recurring unattended work requires a separately authorized automation/workflow and cannot be assumed.

## 12. Acceptance checklist

- [ ] Brand-new fictional planet shows exactly zero countries.
- [ ] No real-world continents, countries, borders or imports appear.
- [ ] Orbital rings and atmosphere match the approved visual style.
- [ ] Smooth rotation/zoom, desktop and touch controls, accessible fallback.
- [ ] Only authorized admins can create/edit/publish countries.
- [ ] Galex can be created, dimensioned by km², validated and published.
- [ ] Countries have non-overlapping, immutable published territory revisions.
- [ ] Published Galex appears on the planet after refresh and from another session.
- [ ] Country selection shows information and a working Enter action.
- [ ] Country entry opens an actual working place/scene, not a deceptive placeholder.
- [ ] New countries can be added without overwriting existing ones.
- [ ] No existing user-created Worlds, Assets, simulations or virtual holdings are lost.
- [ ] TypeScript, lint, tests, build, UI/browser QA and migration checks pass.
- [ ] Documentation reflects what is actually done, with visual evidence.

## 13. Change control and source of truth

This document is the **locked source of truth for the fictional planet redesign** from 2026-10-29 onward. It controls visual identity, empty-world semantics, custom-country behavior, user experience and phased delivery. The existing docs/earth/* materials remain historical/technical context where compatible. Changes to country names, textures and individual world designs are content additions, not specification changes. Significant direction changes require a dated addendum.

**Current implementation status at lock:** specification only; the new fictional Signature Orbital Planet is **not yet coded, tested, deployed or visually verified**. The existing real-Earth implementation is not evidence that this new world is complete.
