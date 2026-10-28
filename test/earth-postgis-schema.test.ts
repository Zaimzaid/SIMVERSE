import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function projectFile(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("isolated Earth PostGIS proof", () => {
  it("pins an isolated PostGIS image and persistent local volume", async () => {
    const compose = await projectFile("infrastructure/earth-postgis/compose.yaml");
    expect(compose).toContain("postgis/postgis:17-3.6-alpine");
    expect(compose).toContain("127.0.0.1:${EARTH_POSTGIS_PORT:-55432}:5432");
    expect(compose).toContain("earth_postgis_data:/var/lib/postgresql/data");
    expect(compose).toContain("./init:/docker-entrypoint-initdb.d:ro");
  });

  it("defines WGS84 geometry validity, spatial indexing and version history", async () => {
    const sql = await projectFile(
      "infrastructure/earth-postgis/init/001-earth-geography.sql",
    );
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS postgis");
    expect(sql).toContain("geometry geometry(Geometry, 4326)");
    expect(sql).toContain("ST_SRID(geometry) = 4326");
    expect(sql).toContain("ST_IsValid(geometry)");
    expect(sql).toContain("geometry IS NOT NULL AND geometry_type = 'Point'");
    expect(sql).toContain("USING GIST (geometry)");
    expect(sql).toContain("CREATE TABLE earth_geo.dataset_version");
    expect(sql).toContain("CREATE TABLE earth_geo.import_run");
    expect(sql).toContain("WHERE is_current");
  });

  it("defines immutable reviewed zones and spatial Phase 4 verification", async () => {
    const [schema, verification, workflow] = await Promise.all([
      projectFile("infrastructure/earth-postgis/init/002-earth-land.sql"),
      projectFile("infrastructure/earth-postgis/verify/phase4-verification.sql"),
      projectFile(".github/workflows/earth-postgis-verification.yml"),
    ]);
    expect(schema).toContain("CREATE TABLE earth_geo.development_zone_version");
    expect(schema).toContain("geometry geometry(MultiPolygon, 4326) NOT NULL");
    expect(schema).toContain("development_zone_version_immutable");
    expect(schema).toContain("ST_CoveredBy(NEW.geometry");
    expect(schema).toContain("development_zone_one_active_version_idx");
    expect(schema).toContain("USING GIST (geometry)");
    expect(schema).not.toContain("parcel_owner");
    expect(schema).not.toContain("parcel_claim");
    expect(verification).toContain("25) > 0.001");
    expect(verification).toContain("625) > 0.001");
    expect(verification).toContain("Stable parcel identifier derivation failed");
    expect(verification).toContain("point-only development-zone geometry rejected");
    expect(verification).toContain("invalid self-intersecting zone geometry rejected");
    expect(verification).toContain("unsupported non-UTM projection rejected");
    expect(workflow).toContain("002-earth-land.sql");
    expect(workflow).toContain("phase4-verification.sql");
  });
});
