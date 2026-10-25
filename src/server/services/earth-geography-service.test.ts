import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { EARTH_GEOMETRY_MAX_BYTES } from "@/lib/earth/constants";
import { readEarthGeographyBundle } from "@/lib/earth/import";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  importEarthGeography,
  importEarthGeographyBundle,
} from "./earth-geography-import-service";
import {
  getEarthGeographyCatalogStatus,
  getEarthPlace,
  getEarthPlaceBoundary,
  getEarthPlaceHierarchy,
  listEarthBoundaryIssues,
  listEarthCountries,
  listEarthPlaces,
  listEarthSubdivisions,
} from "./earth-geography-service";

beforeEach(async () => { await resetDb(); });

let sequence = 0;
async function account(label = "Earth User") {
  sequence += 1;
  return registerUser({
    displayName: `${label} ${sequence}`,
    email: `earth-${sequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

async function importedAccount() {
  const owner = await account();
  const importResult = await importEarthGeography(prisma);
  return { owner, importResult };
}

describe("Earth geography imports and dataset history", () => {
  it("persists and repeats a synthetic second-country revision without special cases", async () => {
    const bundle = await readEarthGeographyBundle(
      process.cwd(),
      "test/fixtures/earth/synthetic-second-country/manifest.json",
    );
    const first = await importEarthGeographyBundle(prisma, bundle);
    const second = await importEarthGeographyBundle(prisma, bundle);
    expect(first).toMatchObject({
      totalRecords: 2,
      results: [{ provider: "synthetic-test-boundaries", created: 2, skipped: 0 }],
    });
    expect(second.results).toEqual([
      expect.objectContaining({
        provider: "synthetic-test-boundaries",
        created: 0,
        updated: 0,
        skipped: 2,
      }),
    ]);
    expect(await prisma.earthGeoPlace.count({ where: { isoAlpha3: "CAN" } })).toBe(2);
    expect(await prisma.earthGeoPlaceRevision.count()).toBe(2);
    expect(await prisma.earthGeoImport.count()).toBe(2);
  });

  it("imports the pinned catalog and repeats without duplicate places or revisions", async () => {
    const owner = await account();
    const first = await importEarthGeography(prisma);
    const second = await importEarthGeography(prisma);

    expect(first).toMatchObject({
      totalRecords: 39,
      results: [
        { provider: "geoboundaries", records: 38, created: 38, updated: 0, skipped: 0 },
        { provider: "geonames", records: 1, created: 1, updated: 0, skipped: 0 },
      ],
      demonstration: {
        kind: "ADMIN1",
        boundaryQuality: "GENERALIZED_BOUNDARY",
      },
    });
    expect(second.results).toEqual([
      expect.objectContaining({ provider: "geoboundaries", created: 0, updated: 0, skipped: 38 }),
      expect.objectContaining({ provider: "geonames", created: 0, updated: 0, skipped: 1 }),
    ]);
    expect(await prisma.earthGeoPlace.count()).toBe(39);
    expect(await prisma.earthGeoPlaceRevision.count()).toBe(39);
    expect(await prisma.earthGeoDatasetVersion.count()).toBe(2);
    expect(await prisma.earthGeoImport.count()).toBe(4);

    const status = await getEarthGeographyCatalogStatus(
      owner.user.id,
      owner.workspaceId,
    );
    expect(status).toMatchObject({
      coordinateReferenceSystem: "EPSG:4326",
      placeCount: 39,
    });
    expect(status.datasets).toHaveLength(2);
    expect(status.datasets.flatMap((dataset) => dataset.versions)
      .every((version) => version.status === "ACTIVE")).toBe(true);
    expect(status.latestImports).toHaveLength(4);
  });

  it("rejects changes to immutable source identity for an existing dataset release", async () => {
    await importedAccount();
    await prisma.earthGeoDataset.update({
      where: {
        providerKey_releaseType: {
          providerKey: "geoboundaries",
          releaseType: "gbOpen",
        },
      },
      data: { attribution: "tampered attribution" },
    });
    await expect(importEarthGeography(prisma)).rejects.toThrow(
      /changed immutable attribution/,
    );
    expect(await prisma.earthGeoPlace.count()).toBe(39);
  });
});

describe("Earth geography navigation and discovery", () => {
  it("navigates Nigeria to its 37 subdivisions and the Lagos point locality", async () => {
    const { owner } = await importedAccount();
    const countries = await listEarthCountries(owner.user.id, owner.workspaceId);
    expect(countries).toMatchObject({ total: 1, limit: 25 });
    const nigeria = countries.items[0]!;
    expect(nigeria).toMatchObject({
      name: "Nigeria",
      kind: "COUNTRY",
      coordinateReferenceSystem: "EPSG:4326",
      boundaryQuality: "GENERALIZED_BOUNDARY",
    });

    const subdivisions = await listEarthSubdivisions(
      owner.user.id,
      owner.workspaceId,
      nigeria.id,
      { limit: 100 },
    );
    expect(subdivisions.total).toBe(37);
    const lagosState = subdivisions.items.find((place) => place.name === "Lagos")!;
    expect(lagosState).toMatchObject({ kind: "ADMIN1", parentId: nigeria.id });

    const localities = await listEarthPlaces(owner.user.id, owner.workspaceId, {
      parentId: lagosState.id,
      kind: "CITY",
      limit: 100,
    });
    expect(localities.items).toHaveLength(1);
    const lagosCity = localities.items[0]!;
    expect(lagosCity).toMatchObject({
      name: "Lagos",
      geometryType: "Point",
      boundaryQuality: "POINT_ONLY",
      parentId: lagosState.id,
    });

    const detail = await getEarthPlace(owner.user.id, owner.workspaceId, lagosState.id);
    expect(detail).toMatchObject({ hasBoundary: true, childCount: 1 });
    expect(detail.hierarchy.map((place) => place.name)).toEqual(["Nigeria", "Lagos"]);
    expect((await getEarthPlaceHierarchy(
      owner.user.id,
      owner.workspaceId,
      lagosCity.id,
    )).items.map((place) => [place.kind, place.name])).toEqual([
      ["COUNTRY", "Nigeria"],
      ["ADMIN1", "Lagos"],
      ["CITY", "Lagos"],
    ]);
  });

  it("searches normalized names and returns actual bounded source geometry", async () => {
    const { owner } = await importedAccount();
    const search = await listEarthPlaces(owner.user.id, owner.workspaceId, {
      q: "  LÁGOS ",
      limit: 10,
    });
    expect(search.total).toBe(2);
    expect(search.items.map((place) => place.kind).sort()).toEqual(["ADMIN1", "CITY"]);

    const state = search.items.find((place) => place.kind === "ADMIN1")!;
    const boundary = await getEarthPlaceBoundary(
      owner.user.id,
      owner.workspaceId,
      state.id,
    );
    expect(boundary.bytes).toBeGreaterThan(0);
    expect(boundary.bytes).toBeLessThanOrEqual(boundary.maxBytes);
    expect(boundary.maxBytes).toBe(EARTH_GEOMETRY_MAX_BYTES);
    expect(["Polygon", "MultiPolygon"]).toContain(boundary.feature.geometry?.type);
    expect(boundary.feature.properties).toMatchObject({
      name: "Lagos",
      coordinateReferenceSystem: "EPSG:4326",
      boundaryQuality: "GENERALIZED_BOUNDARY",
    });
  });

  it("reports point-only boundary gaps and fails safely on invalid or oversized requests", async () => {
    const { owner } = await importedAccount();
    const issues = await listEarthBoundaryIssues(owner.user.id, owner.workspaceId);
    expect(issues.total).toBe(1);
    expect(issues.items[0]).toMatchObject({
      name: "Lagos",
      kind: "CITY",
      boundaryQuality: "POINT_ONLY",
    });
    await expect(listEarthPlaces(owner.user.id, owner.workspaceId, { limit: 101 }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(listEarthPlaces(owner.user.id, owner.workspaceId, { q: "---" }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(getEarthPlace(owner.user.id, owner.workspaceId, "not-a-place"))
      .rejects.toBeInstanceOf(ValidationError);

    const city = await prisma.earthGeoPlace.findFirstOrThrow({
      where: { kind: "CITY" },
      include: { revisions: { where: { isCurrent: true }, take: 1 } },
    });
    await prisma.earthGeoPlaceRevision.update({
      where: { id: city.revisions[0]!.id },
      data: { geometryGeoJson: "x".repeat(EARTH_GEOMETRY_MAX_BYTES + 1) },
    });
    await expect(getEarthPlaceBoundary(owner.user.id, owner.workspaceId, city.publicId))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("requires a real active-workspace membership without leaking workspace existence", async () => {
    const { owner } = await importedAccount();
    const outsider = await account("Earth Outsider");
    await expect(listEarthCountries(owner.user.id, outsider.workspaceId))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(listEarthPlaces(outsider.user.id, owner.workspaceId))
      .rejects.toBeInstanceOf(NotFoundError);
    expect((await listEarthCountries(
      outsider.user.id,
      outsider.workspaceId,
    )).items[0]?.name).toBe("Nigeria");
  });
});
