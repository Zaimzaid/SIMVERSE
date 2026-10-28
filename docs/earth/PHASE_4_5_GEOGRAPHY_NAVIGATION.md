# SIMVERSE Earth — Phase 4.5 Detailed Geography & Navigation

## Status (2026-10-27)
- Scope: restore progressive world navigation and recognisable street context *before* acquisition (Phase 5).
- Branch: `feature/earth-4-5-navigation-streets`, based on the existing Phase 4 visibility fix.
- This checkpoint implements a **street-map pilot, LGA-ready UI, explicit camera controls, and a guarded LGA importer**. It does **not** claim the 774-LGA import has successfully run, construct 3D buildings, or finish Phase 4.5.
- Existing Phase 4 virtual plots remain synthetic, discovery-only, and separate from real-world land rights.

## Existing catalog gap
The current committed Nigeria source manifest contains only:
1. One sourced Nigeria ADM0 country polygon.
2. 37 sourced ADM1 state/FCT polygons.
3. One Lagos city **point**, intentionally without a fabricated boundary.

There are no imported ADM2 LGAs or detailed city/town/neighborhood geometries yet.
The public globe remains a broad Natural Earth overview. The protected explorer
now offers additional street context, but that does not create new administrative
database records.

## First vertical slice — protected Earth navigation
- OSM raster street context is enabled at medium/high zoom in the protected explorer.
  It supplies recognizable roads and settlement labels *where OSM maps them*.
- An explicit **Streets** control toggles this layer; it can be disabled without
  losing the sourced boundaries or local virtual parcel map.
- **Focus place** / **Focus plots** reset the camera without manually scrolling
  from world scale to individual 25 m plots.
- Progressive camera limits now cover country, state, LGA, and settlement.
- After import, `ADMIN2` direct children appear in a dedicated **Local government
  areas** section; their selection and state/country breadcrumbs reuse the existing
  authenticated geography API. Until import, a truthful empty message remains.
- All demo parcel geometry, zone provenance, parcel zoom >=16, and list fallback
  remain in place.

### Map source and deployment restriction
This is a **developer-scale live tile pilot**, not a production-grade street tile
deployment. By default, the interactive, visible viewport uses
`https://tile.openstreetmap.org/{z}/{x}/{y}.png` as permitted by OSM's standard
tile usage policy, with browser caching and © OpenStreetMap contributors
attribution. Do **not** bulk-scrape, prefetch, download for offline use, bypass
cache, or deploy a high-traffic SIMVERSE installation against the donated tile
service. Replace this pilot with a licensed/self-hosted tileset and reviewed
attribution before scaling. OSM raster labels do **not** confer authoritative
administrative boundaries or editable road geometry.

- [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [OSMF ODbL FAQ](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ)

## Remaining gated work — not implemented
1. **ADM2 source ingest.** A **guarded importer has been written but not
   exercised against the complete downloaded dataset**. It targets the pinned
   geoBoundaries gbOpen NGA ADM2 revision `9469f09` (774 LGAs), validates
   geography and fails closed on ambiguous parent-to-state mapping. It records
   immutable source provenance and backs up `dev.db` before modification.
   The complete 774-feature dry-run, import, repeat-import, database comparison,
   and Lagos/Ogun/other-state browser verification remain acceptance gates.
   Run `npm run earth:import:adm2 -- --dry-run` to validate all LGA matches
   **without writing**, then only if it reports 774 safe matches run
   `npm run earth:import:adm2` against the repository-local development DB.
   Source data is downloaded from the GitHub commit-pinned URL; its calculated
   SHA-256 and complete parent-state counts are printed, not guessed.
   No claim is made that all LGAs have already been imported.
2. **City/town catalog.** Import reviewed settlements (point-only when that's
   all the source supports). Do not confuse city names with LGA boundaries or
   force each city to be fully inside one LGA.
3. **Detailed street/road data.** Move beyond pilot OSM raster to a licensed
   basemap/vector pipeline with roads, POIs and building footprints, with
   provider-independent layering, local cache / CDN and legal review.
4. **Multi-scale development summaries.** Render meaningful zones at state/city
   scales and 25 m parcels only in close views. Preserve bounded on-demand
   parcel generation, strict viewer authorization and virtual-only notices.
5. **3D neighborhood proof.** Build one visually evaluated urban block with
   realistic roads, terrain, structures, performance measurements and navigation.
   This is separate from (and cannot be substituted by) a 2D street tile layer.

## Manual acceptance checklist
From the repository root with a backed-up disposable local development DB:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run earth:setup:phase4-demo -- --user-email <existing-local-account>
npm run earth:import:adm2 -- --dry-run
# Run the next command only after the dry run reports all 774 safe mappings:
npm run earth:import:adm2
npm run dev -- --port 3020
```

While signed in, open `http://localhost:3020/earth` and enter virtual land.
Select Nigeria, Lagos State, and the synthetic demo zone:
- Select a place: map frames that location without repeated mousewheel scrolling.
- At state/city zoom the **Streets** layer shows real OSM map detail where available.
- Toggle Streets off: sourced map boundary and plot overlays remain usable.
- **Focus plots** moves to the 187 synthetic parcel example; selection still
  shows 25 × 25 m, 625 m² and the deterministic virtual parcel ID.
- WebGL fallback and accessible parcel list must not regress.
- LGA panel reports missing LGA data until successful ADM2 import. After
  import it must list authentic sourced LGAs as `ADMIN2` children of states,
  allow selecting one, fit its real boundary and show its provenance.

Automated CI/build/browser verification is still required; this document is
not a claim that those gates have passed.

## Second vertical slice — settlement discovery and zone overview (unverified)

This branch adds two additional capabilities without changing the synthetic
parcel or ownership model:

- At state scale, authenticated development-zone summaries yield **amber
  approximate markers** made from the zone bounding-box midpoint. Selecting one
  fetches its reviewed geometry and eligible cells through existing authorized
  endpoints. Markers vanish at parcel zoom so they do not obscure cell clicks.
  No parcel grid is generated during zoomed-out browsing.
- State selections render **blue point markers** for sourced settlement records.
  Clicking a marker uses the existing protected place detail and camera flow.
- LGA selection can list those state-sourced settlement points that fall inside
  the LGA's sourced polygon. This is a **point-in-polygon location test**, not a
  claim that the city/town itself is legally contained by one LGA or has that
  shape. The current protected place-list endpoint limits results to 100, so
  this first pilot is not an exhaustive national discovery service.
- A local, checksum-approved importer for **up to 80 Lagos State GeoNames
  populated-place point records** is included. These are classified into
  CITY/TOWN/LOCALITY for display, explicitly as an internal heuristic. It
  never fabricates a polygon, road or building.

### Settlement importer prerequisite and dry run (when the local PC is available)

Download the official `NG.zip` Nigeria dump from
`https://download.geonames.org/export/dump/NG.zip` and extract `NG.txt`
under the project directory, for example
`data/earth/sources/geonames/NG.txt`. The raw text is intentionally not
committed (source file can change and may be large); its exact SHA-256 forms an
immutable dataset version. **Do not import an unreviewed dump into production.**

```powershell
# From the SIMVERSE repository root:
npm run earth:import:settlements -- --file data/earth/sources/geonames/NG.txt --dry-run
# Review count, source metadata and checksum printed above. A write requires
# the exact checksum returned by that dry run:
npm run earth:import:settlements -- --file data/earth/sources/geonames/NG.txt --expected-sha256 <printed-64-hex-sha256>
```

The script refuses production, non-local SQLite or any DB other than the
repository's `dev.db`, rejects mismatched digests, and backs up the database
before any write. The source points are filtered against Lagos State's
reviewed boundary. Existing GeoNames place identities remain stable, including
the earlier Lagos city point. Re-importing identical content must be tested for
idempotency before deployment. Independent ADM2 data import is **not**
implicitly executed by the settlement importer.

### Pending local acceptance gates

- Run TypeScript, ESLint, Vitest and production build; no clean gate is asserted
  for this branch yet.
- Confirm the official `NG.txt` dry run returns sourced Lagos settlements, the
  write creates a small city/town list, and an identical rerun is idempotent.
- Confirm state-scale amber markers can open zones with correctly zoomed plots;
  blue source-point markers and textual lists open their correct place.
- Check display at 390px and desktop; ensure fallback list still works with
  WebGL disabled; check map attribution and tile provider limits.
- Verify that the parent Phase 4.5 ADM2 importer passes its separate 774-feature
  dry run before concluding that LGA navigation is ready.
- Later: source broad nationwide city/town coverage, scalable paged place
  discovery, licensed vector roads/buildings and one visually judged 3D block.

**No 3D city, real-property acquisition, reservations or ownership is implemented.**
