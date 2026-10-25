import { afterEach, describe, expect, it } from "vitest";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  earthGeometryBounds,
  readEarthGeographyBundle,
  readNigeriaGeographyBundle,
  sha256Text,
  validateEarthGeometry,
} from "./import";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

async function sourceCopy() {
  const root = await mkdtemp(path.join(tmpdir(), "simverse-earth-import-"));
  temporaryRoots.push(root);
  const destination = path.join(root, "data", "earth", "sources");
  await cp(path.join(process.cwd(), "data", "earth", "sources"), destination, {
    recursive: true,
  });
  return { root, destination };
}

describe("Earth geography source bundle", () => {
  it("loads a clearly synthetic second country through the generic manifest pipeline", async () => {
    const bundle = await readEarthGeographyBundle(
      process.cwd(),
      path.join(
        "test",
        "fixtures",
        "earth",
        "synthetic-second-country",
        "manifest.json",
      ),
    );
    expect(bundle.records).toHaveLength(2);
    const country = bundle.records.find((record) => record.kind === "COUNTRY")!;
    const subdivision = bundle.records.find((record) => record.kind === "ADMIN1")!;
    expect(country).toMatchObject({
      name: "Synthetic Canada Test Fixture",
      isoAlpha2: "CA",
      isoAlpha3: "CAN",
      parentCanonicalKey: null,
      boundaryQuality: "APPROXIMATE_BOUNDARY",
      verificationStatus: "PENDING_REVIEW",
      sourceProvider: "synthetic-test-boundaries",
    });
    expect(subdivision).toMatchObject({
      name: "Synthetic Ontario Test Region",
      isoAlpha2: "CA",
      isoAlpha3: "CAN",
      parentCanonicalKey: country.canonicalKey,
      boundaryQuality: "APPROXIMATE_BOUNDARY",
      verificationStatus: "PENDING_REVIEW",
    });
    expect(country.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(subdivision.publicId).toMatch(/^geo_[0-9a-f]{24}$/);
  });

  it("loads the pinned Nigeria hierarchy with deterministic identities and hashes", async () => {
    const first = await readNigeriaGeographyBundle();
    const second = await readNigeriaGeographyBundle();

    expect(first.records).toHaveLength(39);
    expect(first.records.filter((record) => record.kind === "COUNTRY")).toHaveLength(1);
    expect(first.records.filter((record) => record.kind === "ADMIN1")).toHaveLength(37);
    expect(first.records.filter((record) => record.kind === "CITY")).toHaveLength(1);
    expect(new Set(first.records.map((record) => record.publicId)).size).toBe(39);
    expect(first.manifestChecksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(second.records).toEqual(first.records);
    expect(second.manifestChecksum).toBe(first.manifestChecksum);
  });

  it("keeps sourced Lagos State geometry distinct from the point-only Lagos locality", async () => {
    const bundle = await readNigeriaGeographyBundle();
    const lagosState = bundle.records.find(
      (record) => record.kind === "ADMIN1" && record.name === "Lagos",
    );
    const lagosCity = bundle.records.find(
      (record) => record.kind === "CITY" && record.name === "Lagos",
    );

    expect(lagosState).toMatchObject({
      boundaryQuality: "GENERALIZED_BOUNDARY",
      verificationStatus: "VERIFIED_SOURCE",
      coordinateReferenceSystem: "EPSG:4326",
    });
    expect(["Polygon", "MultiPolygon"]).toContain(lagosState?.geometryType);
    expect(lagosCity).toMatchObject({
      geometryType: "Point",
      boundaryQuality: "POINT_ONLY",
      verificationStatus: "VERIFIED_SOURCE",
      coordinateReferenceSystem: "EPSG:4326",
      parentCanonicalKey: lagosState?.canonicalKey,
    });
    expect(JSON.parse(lagosCity?.geometryGeoJson ?? "{}")).toEqual({
      type: "Point",
      coordinates: [3.39467, 6.45407],
    });
  });

  it("validates WGS84 coordinate ranges, closed rings and derived bounds", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [[[2, 4], [5, 4], [5, 9], [2, 4]]],
    };
    validateEarthGeometry(polygon);
    expect(earthGeometryBounds(polygon)).toEqual({
      west: 2,
      south: 4,
      east: 5,
      north: 9,
      label: { longitude: 3.5, latitude: 6.5 },
    });
    expect(() => validateEarthGeometry({ type: "Point", coordinates: [181, 0] }))
      .toThrow(/outside WGS84 bounds/);
    expect(() => validateEarthGeometry({
      type: "Polygon",
      coordinates: [[[2, 4], [5, 4], [5, 9], [2, 5]]],
    })).toThrow(/must be closed/);
  });

  it("rejects a source file whose content no longer matches its manifest checksum", async () => {
    const { root, destination } = await sourceCopy();
    const adm0 = path.join(
      destination,
      "geoboundaries",
      "gbopen-9469f09",
      "NGA",
      "ADM0.geojson",
    );
    await writeFile(adm0, `${await readFile(adm0, "utf8")}\n`, "utf8");
    await expect(readNigeriaGeographyBundle(root)).rejects.toThrow(/Checksum mismatch/);
  });

  it("rejects duplicate administrative identities even when the source checksum is valid", async () => {
    const { root, destination } = await sourceCopy();
    const adm1Path = path.join(
      destination,
      "geoboundaries",
      "gbopen-9469f09",
      "NGA",
      "ADM1.geojson",
    );
    const manifestPath = path.join(destination, "manifest.json");
    const adm1 = JSON.parse(await readFile(adm1Path, "utf8")) as {
      features: Array<Record<string, unknown>>;
    };
    adm1.features.push(structuredClone(adm1.features[0]!));
    const changedAdm1 = JSON.stringify(adm1);
    await writeFile(adm1Path, changedAdm1, "utf8");

    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sources: Array<{ providerKey: string; layers: Array<{
        level: string;
        featureCount: number;
        sha256: string;
      }> }>;
    };
    const layer = manifest.sources.find((source) => source.providerKey === "geoboundaries")
      ?.layers.find((candidate) => candidate.level === "ADM1");
    if (!layer) throw new Error("Test source manifest is missing ADM1.");
    layer.featureCount = adm1.features.length;
    layer.sha256 = sha256Text(changedAdm1);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    await expect(readNigeriaGeographyBundle(root)).rejects.toThrow(
      /Duplicate ADM1 identity NGA:NG-CR/,
    );
  });
});
