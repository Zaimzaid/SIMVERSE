# SIMVERSE Earth — Phase 4.5 Detailed Geography & Navigation

## Status (2026-10-27)
- Scope: restore progressive world navigation and recognisable street context *before* acquisition (Phase 5).
- Branch: `feature/earth-4-5-navigation-streets`, based on the existing Phase 4 visibility fix.
- This checkpoint implements a **street-map pilot, LGA-ready UI, and explicit camera controls**. It does **not** claim to import all LGAs, construct 3D buildings, or finish Phase 4.5.
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
1. **ADM2 source ingest.** Use the current pinned geoBoundaries gbOpen Nigeria
   revision `9469f09` ADM2 metadata (774 LGAs), its matching sourced GeoJSON and
   CC BY 4.0 attribution. Pin checksums; verify parent-state mapping for all
   geometries; store data versions/revisions immutably; run repeated imports on
   disposable databases. Reject ambiguous cross-state mappings rather than
   guessing. Test parent-child hierarchies for Lagos, Ogun and other states.
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
- LGA panel must clearly report lack of imported LGA data **until the ADM2
  import milestone is actually complete**.

Automated CI/build/browser verification is still required; this document is
not a claim that those gates have passed.
