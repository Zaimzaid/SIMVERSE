import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EARTH_OVERVIEW_V1 } from "@/lib/earth/public";

function hash(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function filesBelow(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return files.flat();
}

describe("Earth global overview artifact", () => {
  it("pins source provenance and ships bounded checksummed MVT tiles", async () => {
    const sourceRoot = path.join(process.cwd(), "data", "earth", "overview", "v1");
    const publicRoot = path.join(process.cwd(), "public", "earth", "overview", "v1");
    const sourceManifest = JSON.parse(await readFile(path.join(sourceRoot, "manifest.json"), "utf8"));
    const outputManifest = JSON.parse(await readFile(path.join(publicRoot, "manifest.json"), "utf8"));
    const source = await readFile(path.join(sourceRoot, sourceManifest.sourceFile));
    expect(hash(source)).toBe(sourceManifest.sourceSha256);
    expect(outputManifest).toMatchObject({
      id: EARTH_OVERVIEW_V1.id,
      sourceVersion: EARTH_OVERVIEW_V1.sourceVersion,
      sourceRevision: EARTH_OVERVIEW_V1.sourceRevision,
      tileTemplate: EARTH_OVERVIEW_V1.tileTemplate,
      minZoom: 0,
      maxZoom: 2,
      tileCount: 21,
      layer: "land",
    });

    let totalBytes = 0;
    for (const tile of outputManifest.tiles as Array<{ path: string; bytes: number; sha256: string }>) {
      expect(tile.path).toMatch(/^tiles\/[0-2]\/\d+\/\d+\.pbf$/);
      const bytes = await readFile(path.join(publicRoot, ...tile.path.split("/")));
      const info = await stat(path.join(publicRoot, ...tile.path.split("/")));
      expect(info.size).toBe(tile.bytes);
      expect(tile.bytes).toBeGreaterThan(0);
      expect(tile.bytes).toBeLessThan(100_000);
      expect(hash(bytes)).toBe(tile.sha256);
      totalBytes += tile.bytes;
    }
    expect(totalBytes).toBe(outputManifest.totalBytes);
    expect(totalBytes).toBeLessThan(100_000);
    expect((await filesBelow(publicRoot)).some((file) => file.endsWith(".geojson"))).toBe(false);
  });
});
