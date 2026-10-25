# Isolated Earth PostGIS development environment

This environment is a reversible Phase 2 proof. It does not replace the current
SIMVERSE SQLite datasource and does not migrate `dev.db`.

The image is pinned to PostgreSQL 17 with PostGIS 3.6. It creates an isolated
`earth_geo` schema with WGS84 geometry, validity checks, immutable dataset
versions, import history, hierarchy constraints and a GiST geometry index.

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

Use the configured user/database values if they differ from the example. Stop
with `docker compose ... down`. Add `-v` only when intentionally discarding the
isolated proof database.

Docker and `psql` were not available on the Phase 2 development machine. The
repository therefore runs the same bootstrap against a real isolated service in
`.github/workflows/earth-postgis-verification.yml`. The gate executes
`verify/phase2-verification.sql`, checks PostGIS and spatial indexes, accepts a
valid WGS84 polygon, rejects invalid geometry and broken references, and checks
bootstrap repeat behavior. Its log is retained as the
`earth-postgis-verification` workflow artifact.

The SQL file is a versioned one-time bootstrap. Applying it twice to the same
database is expected to fail at the existing table and roll back without changing
data. Applying the same bootstrap to another empty database is supported and is
also exercised by the workflow.
