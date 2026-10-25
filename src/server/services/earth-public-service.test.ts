import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { publicEarthOverviewSchema } from "@/lib/earth/public";
import { prisma } from "@/server/db/client";
import { verifyEarthDestinationIntent } from "@/server/earth/destination-intent";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { resolveEarthDestinationIntent } from "./earth-destination-service";
import { importEarthGeography } from "./earth-geography-import-service";
import {
  createPublicEarthDestination,
  getPublicEarthOverview,
  searchPublicEarthCountries,
} from "./earth-public-service";

beforeEach(async () => { await resetDb(); });

let sequence = 0;
async function account(label: string) {
  sequence += 1;
  return registerUser({
    displayName: `${label} ${sequence}`,
    email: `earth-public-${sequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

describe("public Earth projection and protected continuation", () => {
  it("returns an exact country-only public allowlist over the versioned overview", async () => {
    await importEarthGeography(prisma);
    const overview = await getPublicEarthOverview();
    expect(publicEarthOverviewSchema.parse(overview)).toEqual(overview);
    expect(overview.countries).toHaveLength(1);
    expect(overview.countries[0]).toMatchObject({
      name: "Nigeria",
      kind: "COUNTRY",
      isoAlpha2: "NG",
      isoAlpha3: "NGA",
      coverage: "SUPPORTED",
    });
    expect(Object.keys(overview.countries[0]!).sort()).toEqual([
      "bbox",
      "center",
      "coverage",
      "id",
      "isoAlpha2",
      "isoAlpha3",
      "kind",
      "name",
    ]);
    expect(JSON.stringify(overview)).not.toMatch(/contentHash|workspace|geometry|sourceFeature/i);
  });

  it("searches supported countries only and rejects invalid public queries", async () => {
    await importEarthGeography(prisma);
    expect((await searchPublicEarthCountries({ q: "nig", limit: 5 })).items)
      .toEqual([expect.objectContaining({ name: "Nigeria" })]);
    expect((await searchPublicEarthCountries({ q: "Lagos", limit: 5 })).items)
      .toEqual([]);
    await expect(searchPublicEarthCountries({ q: "---" }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(searchPublicEarthCountries({ q: "Nigeria", limit: 11 }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("signs only a supported country and reauthorizes it after login", async () => {
    const owner = await account("Earth Owner");
    const outsider = await account("Earth Outsider");
    await importEarthGeography(prisma);
    const overview = await getPublicEarthOverview();
    const nigeria = overview.countries[0]!;
    const created = await createPublicEarthDestination({ placeId: nigeria.id });
    expect(verifyEarthDestinationIntent(created.intent).placeId).toBe(nigeria.id);

    const resolved = await resolveEarthDestinationIntent(
      owner.user.id,
      owner.workspaceId,
      created.intent,
    );
    expect(resolved.place).toMatchObject({ name: "Nigeria", kind: "COUNTRY" });
    await expect(resolveEarthDestinationIntent(
      owner.user.id,
      outsider.workspaceId,
      created.intent,
    )).rejects.toBeInstanceOf(NotFoundError);

    const lagos = await prisma.earthGeoPlace.findFirstOrThrow({ where: { kind: "CITY" } });
    await expect(createPublicEarthDestination({ placeId: lagos.publicId }))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(createPublicEarthDestination({ placeId: "geo_ffffffffffffffffffffffff" }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
