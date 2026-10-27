# Isolated Earth PostGIS development environment

This environment is a reversible Phase 2 geography and Phase 4 virtual-land
proof. It does not replace the current SIMVERSE SQLite datasource and does not
migrate `dev.db`.

The image is pinned to PostgreSQL 17 with PostGIS 3.6. It creates an isolated
`earth_geo` schema with WGS84 geometry, validity checks, immutable dataset and
Development Zone versions, import/lifecycle history, hierarchy and containment
constraints, local UTM grid definitions and GiST spatial indexes.

## Prerequisites

- Docker Engine with Compose support
- stable storage on C: or another owner-approved volume
- a local password stored only in an ignored `.env` file

The previously unstable D: drive must not be used.

## Start and verify

```powershell
Copy-Item infrastructure/earth-postgis/.env.example infrastructure/earth-postgis/.env
# Set a local-only password in infrastructure/earth-postgis/.env.
docker compose --env-file infrastructure/earth-postgis/.env `
  -f infrastructure/earth-postgis/compose.yaml up -d
docker compose --env-file infrastructure/earth-postgis/.env `
  -f infrastructure/earth-postgis/compose.yaml exec database `
  psql -U simverse_earth -d simverse_earth_dev -c `
  "SELECT PostGIS_Full_Version(), ST_IsValid(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 0))',4326));"
```

The container entrypoint applies `init/001-earth-geography.sql` followed by
`init/002-earth-land.sql`. To run the committed verification scripts manually:

```powershell
Get-Content infrastructure/earth-postgis/verify/phase2-verification.sql -Raw |
  docker compose --env-file infrastructure/earth-postgis/.env `
    -f infrastructure/earth-postgis/compose.yaml exec -T database `
    psql -v ON_ERROR_STOP=1 -U simverse_earth -d simverse_earth_dev

Get-Content infrastructure/earth-postgis/verify/phase4-verification.sql -Raw |
  docker compose --env-file infrastructure/earth-postgis/.env `
    -f infrastructure/earth-postgis/compose.yaml exec -T database `
    psql -v ON_ERROR_STOP=1 -U simverse_earth -d simverse_earth_dev
```

Use the configured user/database values if they differ from the example. Stop
with `docker compose ... down`. Add `-v` only when intentionally discarding the
isolated proof database.

Docker and `psql` were not available on the Phase 2 development machine. The
repository therefore runs the same bootstrap against a real isolated service in
`.github/workflows/earth-postgis-verification.yml`. The gate executes both
verification scripts. Phase 2 checks geography constraints and indexes. Phase 4
checks PostGIS/pgcrypto availability, zone/exclusion geometry and containment,
projection/origin consistency, immutable versions, lifecycle foreign keys,
GiST/one-active-version indexes, 25 m by 25 m / 625 m² full cells, stable parcel
IDs, bounded generation and non-overlap. Its log is retained as the
`earth-postgis-verification` workflow artifact.

Each numbered SQL file is a versioned one-time bootstrap. Applying one twice to
the same database is expected to fail at the existing table and roll back
without changing data. Applying the ordered bootstrap to another empty database
is supported and is also exercised by the workflow.
