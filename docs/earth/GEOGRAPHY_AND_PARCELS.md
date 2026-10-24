# SIMVERSE Earth - Geography and Parcels

## 1. Purpose

This document defines how SIMVERSE Earth can represent sourced real-world
geography and derive virtual parcels without inventing boundaries or storing a
global parcel grid. All implementation choices remain proposed until the Phase
1 architecture is approved.

## 2. Geography principles

1. **Source before shape.** Every displayed boundary has a dataset revision,
   source feature identifier, license, checksum and quality classification.
2. **A place is not its boundary.** A country, city or locality has a stable
   identity; its name, hierarchy, point and boundary may change by dataset
   revision.
3. **Point-only is valid.** A locality may have a label point and no polygon.
4. **Uncertainty is data.** Missing, approximate, disputed, overlapping and
   provider-derived boundaries are explicit states.
5. **Development is policy.** Geographic membership does not make land eligible
   for virtual acquisition. Only an approved SIMVERSE DevelopmentZone does.
6. **History stays interpretable.** Prior properties retain the dataset and zone
   revision used when they were created.

## 3. Coordinate standards

### Canonical global frame

- Store source and display geography in WGS84 longitude/latitude, EPSG:4326.
- Use `[longitude, latitude]` order in API contracts and file formats.
- Validate longitude in `[-180, 180]` and latitude in `[-90, 90]`.
- Keep elevation separate and identify its vertical datum when used.
- Normalize polygon ring orientation and validate multipolygons at import.

WGS84 is suitable for identity and display, not for measuring a 25 metre
parcel. Web Mercator also distorts distance and area, especially near the poles.

### Parcel-local metric frame

Each DevelopmentZoneVersion records:

- a local projected coordinate reference system or reviewed local projection;
- EPSG/SRID or complete projection parameters;
- grid origin in that projected frame;
- grid bearing;
- cell width and height in metres;
- measurement and parcel-algorithm versions.

Use an appropriate local UTM zone where it is valid. Zones crossing a UTM
boundary, the antimeridian or high latitudes need a reviewed local projection,
such as a local azimuthal/equidistant frame. No implementation may silently
fall back to Web Mercator for parcel measurements.

## 4. Place and hierarchy model

### Stable place types

Proposed types are:

```text
PLANET
COUNTRY_OR_TERRITORY
ADMIN_LEVEL_1
ADMIN_LEVEL_2
ADMIN_LEVEL_3
CITY
TOWN
LOCALITY
NEIGHBORHOOD
```

Source-specific `admin_level` is preserved separately. The normalized type is a
search/navigation aid and must not claim that every country uses the same
administrative system.

### Place revision fields

An immutable revision should carry:

- source dataset version and source feature ID;
- canonical and localized names plus alternate names;
- country/administrative codes where available;
- parent relationship for that dataset revision;
- label point;
- optional `Polygon`/`MultiPolygon`;
- source and computed bounding boxes;
- boundary quality and confidence;
- dispute/policy labels;
- source properties retained in a bounded provenance document;
- effective/superseded timestamps.

### Boundary quality

```text
VERIFIED_SOURCE
PROVIDER_BOUNDARY
APPROXIMATE
DISPUTED
POINT_ONLY
MISSING
INVALID_QUARANTINED
```

Map styles, search results and property flows use this field. A `POINT_ONLY` or
`MISSING` locality remains searchable but cannot directly create a development
zone from an imaginary outline.

### Disputed geography

Source geometry and SIMVERSE display policy are separate. Raw imported facts
are immutable. A reviewed policy layer selects label variants and visual
treatment without deleting source provenance. The owner must approve a neutral
territory policy and launch-region review before public release.

## 5. Dataset lifecycle

### Candidate source evaluation

No provider is approved in Phase 1. License terms and current release contents
must be verified from the provider before download or redistribution.

| Candidate | Appropriate use | Limits / review required |
| --- | --- | --- |
| Natural Earth | Small-scale global countries, coastlines and low-zoom context. | Not parcel-scale; simplify/display only; verify the exact release and attribution/public-domain statement. |
| Overture Maps data | Versioned global places, divisions and building/transport context where its current themes support the launch scope. | Theme coverage and source attribution vary; inspect the chosen release and license obligations. |
| OpenStreetMap | Rich place labels, administrative relations and building/road context. | Uneven completeness; community boundaries are not legal cadastre; ODbL attribution/database obligations need review. |
| geoBoundaries or similar reviewed boundary catalog | Comparable administrative-boundary releases and source metadata. | Coverage/licensing/accuracy vary by country and release; verify commercial redistribution. |
| National or municipal open-data portals | Potentially authoritative high-detail boundaries and planning layers for one launch region. | Fragmented formats, update schedules, local datums and incompatible licenses require per-source import adapters. |
| Commercial boundary/geocoding provider | Contracted coverage, support and service levels. | Cost, cache/redistribution limits, vendor lock-in and use in a persistent virtual world require contract review. |

GADM or any dataset with noncommercial or redistribution restrictions must not
be adopted by assumption. Real cadastral/parcel datasets are also unnecessary
for the SIMVERSE virtual grid and could create false legal expectations. The
recommended proof combines a low-zoom global source with one reviewed detailed
launch-region source, while retaining source identity for every feature.

Cities and towns are expected to be the least uniform layer. A provider may
offer only a point, a statistical area, an administrative area or a built-up
area. These concepts are stored distinctly and never substituted silently.

```text
REGISTERED -> IMPORTING -> VALIDATING -> STAGED -> ACTIVE -> SUPERSEDED
                                \-> REJECTED
```

1. Register provider, version, URLs, license/attribution and expected checksum.
2. Import into staging tables; never write directly into active geography.
3. Validate geometry, hierarchy, IDs, encoding, counts and license metadata.
4. Quarantine invalid features with machine-readable reasons.
5. Produce generalized boundaries and immutable vector tiles.
6. Review a manifest and representative map samples.
7. Atomically activate a dataset version for a configured scope.
8. Keep the old version addressable for property history and rollback.

An activation must not regenerate or move existing acquired parcels.

## 6. Search and navigation

Search ranks exact names/codes, alternate names, prefix matches and then fuzzy
matches within a bounded geographic or country context. Every result includes a
breadcrumb, such as:

```text
Earth / Country / State or Province / City / Locality
```

Selection behavior:

- a polygon result fits the camera to a safe padded extent;
- a point-only result centers at an appropriate zoom and displays its boundary
  limitation;
- children are loaded from the versioned hierarchy;
- if a hierarchy level does not exist, the flow skips it truthfully rather than
  creating a placeholder administrative division;
- users can also pan/zoom directly and inspect features under the cursor.

Search APIs return a bounded projection. Tile responses carry display geometry;
they do not expose licensing-incompatible source attributes.

## 7. Development zones

A DevelopmentZone is a SIMVERSE virtual-development policy area. It references
one or more geography revisions for context but owns its exact eligible polygon,
exclusions and grid rules.

Each immutable DevelopmentZoneVersion contains:

- source geography and dataset revision references;
- eligible `MultiPolygon`;
- exclusion polygons for water, protected areas, roads or policy restrictions;
- zoning categories and allowed property/building types;
- parcel projection, grid origin, bearing and cell dimensions;
- minimum cell coverage and edge-cell policy;
- height/setback/density rules where used;
- activation window and status;
- provenance, creator/reviewer and content hash.

Proposed statuses are `DRAFT`, `REVIEW`, `ACTIVE`, `PAUSED`, `SUPERSEDED` and
`RETIRED`. Only `ACTIVE` versions produce new available parcel candidates.

## 8. Deterministic parcel grid

### Initial size

The approved default base parcel size is 25 m by 25 m (625 m²). The architecture
stores width and height per immutable zone version because an approved
development-zone rule may require different dimensions for density, geography
or product policy.

### Stable indices

Transform the zone polygon into its metric frame. A candidate cell is identified
by signed integer `(column, row)` relative to the frozen grid origin and bearing.
Its geometry is derived only from:

```text
parcel-algorithm version
development-zone version ID
projection definition
grid origin and bearing
cell width and height
column and row
edge-cell policy
```

Proposed canonical key:

```text
earth:p1:<zone-version-id>:<signed-column>:<signed-row>
```

The external public parcel ID should be a URL-safe deterministic digest or
UUIDv5 of that canonical key. The canonical components remain server-side.
Changing any grid-defining input requires a new zone version, so an existing ID
never points to a different geometry.

### Eligibility algorithm

For each candidate cell requested by viewport or stable key:

1. derive the exact metric square/rectangle;
2. intersect it with the eligible zone;
3. subtract exclusion polygons;
4. apply the versioned edge rule and minimum eligible-area ratio;
5. reject invalid, empty, self-intersecting or out-of-range geometry;
6. transform the accepted geometry to WGS84 for storage/display;
7. derive centroid and measured area;
8. overlay any materialized reservation, property, retirement or construction
   status.

**Proposed launch rule:** admit only full grid cells inside the eligible polygon.
This produces predictable equal parcels and avoids unusable slivers. Clipped
edge parcels can be added later through an explicit algorithm version.

## 9. On-demand materialization

The system does not create rows for every available candidate.

### Computed only

An unclaimed candidate returned for a viewport is deterministic and ephemeral.
It carries its public ID, geometry projection, zone category and an
`AVAILABLE_AT_QUERY_TIME` state. This is not a promise or reservation.

### Materialized

A claim row is created or locked when a user:

- starts a reservation;
- acquires the property;
- receives a starter allocation;
- creates a development record;
- or a steward explicitly retires/blocks the candidate.

The unique `(zoneVersionId, column, row)` constraint and the same deterministic
derivation prevent duplicate materialization.

### Viewport query limits

Parcel geometry is served only beyond a configured zoom and within bounded
viewport area/candidate count. When too many candidates are visible, the API
returns zone summary/availability density rather than millions of cells.

## 10. Availability and zoning

Availability is derived from zone state plus claim state:

```text
AVAILABLE_AT_QUERY_TIME
RESERVED
OWNED_UNDEVELOPED
OWNED_DEVELOPED
UNIT_AVAILABILITY
BLOCKED
RETIRED
```

The browser may render these states, but an acquisition request always rechecks
the current authoritative row under a database lock. Availability responses
include a short cache policy and timestamp; they are never a guarantee.

Zoning is versioned policy data. It may constrain template categories, maximum
height, setbacks, footprint ratio, unit type and publication visibility. It must
not make claims about real municipal zoning unless the UI names and sources a
separate licensed dataset.

## 11. Existing structures and units

Real building footprints, when used, are sourced geographic data with the same
provenance rules. A footprint does not prove ownership, occupancy, address,
condition or unit layout.

Virtual developed properties and units are SIMVERSE records:

- a Building may sit on one or more explicitly linked virtual parcels;
- a PropertyUnit belongs to one Building and has a stable unit identity;
- land, whole-building and unit ownership are separate claim types;
- rights to edit common structure, private unit and exterior are explicit;
- no unit is created from guessed real-world interiors.

## 12. Geography edge cases

| Case | Required behavior |
| --- | --- |
| Antimeridian | Split/wrap display geometry correctly; use a reviewed local parcel frame. |
| Polar area | Do not measure in Web Mercator or an invalid UTM zone. |
| Islands/multipolygons | Preserve every sourced component; require explicit zone selection. |
| Boundary disagreement | Preserve source revisions and show dispute/policy state. |
| Point-only town | Search and center by point; no automatic town polygon or parcels. |
| Overlapping source polygons | Quarantine or resolve through policy before zone activation. |
| Coastline change | New dataset/zone revision; existing property geometry remains frozen. |
| Invalid source geometry | Quarantine and exclude from active tiles/zones. |
| Very small locality | Permit navigation; do not force a 25 m grid if no valid zone exists. |
| Renamed/reparented place | New revision and aliases; stable place/property identifiers persist. |

## 13. Owner indicators and privacy

The map should distinguish "mine", "available", "reserved", "owned" and
"developed" without color alone. Public projections must not expose account
email, internal User ID, workspace membership or exact activity history.

Whether another player's display name is public is an open policy decision.
Until approved, non-owner public projections should use neutral copy such as
"Owned virtual property" and expose only approved public profile identity.

## 14. Validation gates

Before any zone is active, automated and human checks must confirm:

- dataset/license manifest and checksum;
- stable ID uniqueness and complete hierarchy diagnostics;
- geometry validity and representative map review;
- correct metric projection and unit tests against known distances;
- deterministic parcel IDs and geometry across repeated runs;
- no overlap among accepted cells for the same grid version;
- exclusions and edge policy applied correctly;
- tile and API attribution requirements;
- point-only/missing boundaries never become fabricated zones.

Detailed tests are listed in [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md).
