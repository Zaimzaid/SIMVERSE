# SIMVERSE Earth Phase 2 source snapshot

This directory is the reproducible Nigeria/Lagos geography proof used by the
Phase 2 importer. `manifest.json` records every committed file, source adapter,
ISO country coverage, source revision, license, attribution, checksum, quality
policy and expected feature count. The manifest reader is country-neutral;
Nigeria is the first production proof rather than an importer assumption.

## Boundary source

Nigeria ADM0 and ADM1 geometry is the simplified GeoJSON published by
[geoBoundaries](https://www.geoboundaries.org/) under the gbOpen release. The
snapshot is pinned to geoBoundaries repository revision `9469f09`. Its metadata
identifies GRID3 as the underlying source and CC BY 4.0 as the layer license.

The simplified files preserve real sourced Polygon/MultiPolygon coordinates for
navigation testing. They are generalized display geometry and must not be used
as cadastral, survey or parcel boundaries.

## Locality source

The Lagos point is derived from the GeoNames Nigeria country dump retrieved on
2026-10-24. The source archive checksum is recorded in the manifest. GeoNames ID
`2332459` is a WGS84 populated-place point. It has no boundary in this snapshot,
so the importer records `POINT_ONLY` and never creates a city polygon.

GeoNames data is provided under CC BY 4.0. Attribution:
`GeoNames (https://www.geonames.org/)`.

## Updating

Do not replace files in place. Add a new versioned source directory, record its
immutable checksum and metadata, run the importer verification tests, and create
a new dataset version. Prior versions remain inspectable.

The test-only second-country fixture under
`test/fixtures/earth/synthetic-second-country/` demonstrates extension without
claiming authentic geography. Never copy that synthetic geometry into this
production source snapshot.
