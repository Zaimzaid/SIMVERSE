import { beforeEach, describe, expect, it } from "vitest";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { phase4DevelopmentZoneInput } from "../../../test/fixtures/earth/phase4-development-zone";
import { registerUser } from "./auth-service";
import { importEarthGeography } from "./earth-geography-import-service";
import {
  activateEarthZoneVersion,
  createEarthDevelopmentZone,
  createEarthDevelopmentZoneVersion,
  getEarthDevelopmentZone,
  getEarthParcel,
  getEarthZoneEligibility,
  getEarthZoneRules,
  listEarthDevelopmentZones,
  listEarthDevelopmentZoneVersions,
  listEarthParcels,
  retireEarthZone,
  rollbackEarthZoneVersion,
  submitEarthZoneVersionForReview,
} from "./earth-zone-service";

beforeEach(async () => { await resetDb(); });

let accountSequence = 0;

async function account(label = "Earth Zone User") {
  accountSequence += 1;
  return registerUser({
    displayName: `${label} ${accountSequence}`,
    email: `earth-zone-${accountSequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

async function earthContext(options: { canActivate?: boolean } = {}) {
  const owner = await account();
  await importEarthGeography(prisma);
  const lagosState = await prisma.earthGeoPlace.findFirstOrThrow({
    where: { name: "Lagos", kind: "ADMIN1" },
  });
  const lagosCity = await prisma.earthGeoPlace.findFirstOrThrow({
    where: { name: "Lagos", kind: "CITY" },
  });
  await prisma.earthSteward.create({
    data: {
      userId: owner.user.id,
      role: "EARTH_STEWARD",
      canActivate: options.canActivate ?? true,
    },
  });
  return { owner, lagosState, lagosCity };
}

async function createReviewedActiveZone() {
  const context = await earthContext();
  const created = await createEarthDevelopmentZone(
    context.owner.user.id,
    context.owner.workspaceId,
    phase4DevelopmentZoneInput(context.lagosState.publicId),
  );
  await submitEarthZoneVersionForReview(
    context.owner.user.id,
    context.owner.workspaceId,
    created.zone.id,
    created.version.id,
  );
  await activateEarthZoneVersion(
    context.owner.user.id,
    context.owner.workspaceId,
    created.zone.id,
    created.version.id,
  );
  return { ...context, created };
}

describe("Earth development-zone authority and validation", () => {
  it("keeps an empty catalog truthful and does not turn workspace ownership into stewardship", async () => {
    const owner = await account();
    await importEarthGeography(prisma);
    const lagos = await prisma.earthGeoPlace.findFirstOrThrow({ where: { name: "Lagos", kind: "ADMIN1" } });

    await expect(listEarthDevelopmentZones(owner.user.id, owner.workspaceId))
      .resolves.toEqual({ items: [], limit: 50 });
    await expect(createEarthDevelopmentZone(
      owner.user.id,
      owner.workspaceId,
      phase4DevelopmentZoneInput(lagos.publicId),
    )).rejects.toBeInstanceOf(AuthorizationError);

    const foreign = await account("Foreign workspace owner");
    await expect(listEarthDevelopmentZones(owner.user.id, foreign.workspaceId))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("requires an activation grant in addition to stewardship", async () => {
    const { owner, lagosState } = await earthContext({ canActivate: false });
    const created = await createEarthDevelopmentZone(
      owner.user.id,
      owner.workspaceId,
      phase4DevelopmentZoneInput(lagosState.publicId),
    );
    await submitEarthZoneVersionForReview(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      created.version.id,
    );
    await expect(activateEarthZoneVersion(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      created.version.id,
    )).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects point-only localities, invalid projections and geometry outside its reviewed parent", async () => {
    const { owner, lagosState, lagosCity } = await earthContext();
    await expect(createEarthDevelopmentZone(
      owner.user.id,
      owner.workspaceId,
      phase4DevelopmentZoneInput(lagosCity.publicId),
    )).rejects.toThrow(/point-only locality/);

    const invalidProjection = phase4DevelopmentZoneInput(lagosState.publicId);
    invalidProjection.definition.projectionSrid = 32632;
    await expect(createEarthDevelopmentZone(owner.user.id, owner.workspaceId, invalidProjection))
      .rejects.toThrow(/UTM zone/);

    const outside = phase4DevelopmentZoneInput(lagosState.publicId);
    outside.key = "outside-reviewed-parent";
    outside.definition.geometry.coordinates[0] = [
      [3.3998, 7.9], [3.4032, 7.9], [3.4032, 7.9032], [3.3998, 7.9032], [3.3998, 7.9],
    ];
    outside.definition.gridOrigin = [3.4, 7.9];
    await expect(createEarthDevelopmentZone(owner.user.id, owner.workspaceId, outside))
      .rejects.toThrow(/contained by its reviewed parent/);
  });
});

describe("Earth development-zone immutable versions and lifecycle", () => {
  it("creates version one, rejects duplicate content and activates versioned changes", async () => {
    const { owner, lagosState } = await earthContext();
    const input = phase4DevelopmentZoneInput(lagosState.publicId);
    const created = await createEarthDevelopmentZone(owner.user.id, owner.workspaceId, input);
    expect(created).toMatchObject({
      zone: { status: "DRAFT" },
      version: { version: 1, status: "DRAFT" },
    });
    await expect(createEarthDevelopmentZoneVersion(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      { definition: input.definition },
    )).rejects.toBeInstanceOf(ConflictError);

    await submitEarthZoneVersionForReview(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      created.version.id,
    );
    await activateEarthZoneVersion(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      created.version.id,
    );

    const changed = structuredClone(input.definition);
    changed.restrictions.notes = "Immutable second-version policy text.";
    const second = await createEarthDevelopmentZoneVersion(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      { definition: changed },
    );
    expect(second).toMatchObject({ version: 2, status: "DRAFT" });
    await submitEarthZoneVersionForReview(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      second.id,
    );
    await activateEarthZoneVersion(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      second.id,
    );

    const versions = await listEarthDevelopmentZoneVersions(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
    );
    expect(versions.items.map((version) => [version.version, version.status]))
      .toEqual([[2, "ACTIVE"], [1, "RETIRED"]]);
    expect(new Set(versions.items.map((version) => version.contentHash)).size).toBe(2);
    expect((await getEarthDevelopmentZone(owner.user.id, owner.workspaceId, created.zone.id))
      .restrictions.notes).toBe("Immutable second-version policy text.");
  });

  it("retires and rolls back without mutating immutable version content", async () => {
    const { owner, created } = await createReviewedActiveZone();
    const before = await prisma.earthDevelopmentZoneVersion.findUniqueOrThrow({
      where: { publicId: created.version.id },
    });
    await retireEarthZone(owner.user.id, owner.workspaceId, created.zone.id);
    await expect(getEarthDevelopmentZone(owner.user.id, owner.workspaceId, created.zone.id))
      .rejects.toBeInstanceOf(NotFoundError);
    await rollbackEarthZoneVersion(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      created.version.id,
    );
    const after = await prisma.earthDevelopmentZoneVersion.findUniqueOrThrow({
      where: { publicId: created.version.id },
    });
    expect({
      geometryGeoJson: after.geometryGeoJson,
      exclusionsJson: after.exclusionsJson,
      contentHash: after.contentHash,
      version: after.version,
      sourcePlaceRevisionId: after.sourcePlaceRevisionId,
    }).toEqual({
      geometryGeoJson: before.geometryGeoJson,
      exclusionsJson: before.exclusionsJson,
      contentHash: before.contentHash,
      version: before.version,
      sourcePlaceRevisionId: before.sourcePlaceRevisionId,
    });
    expect(await prisma.earthDevelopmentZoneLifecycleEvent.count()).toBe(5);
    expect(await prisma.earthDevelopmentZoneLifecycleEvent.findMany({
      orderBy: { createdAt: "asc" },
      select: { action: true },
    })).toEqual([
      { action: "CREATED" },
      { action: "SUBMITTED_FOR_REVIEW" },
      { action: "ACTIVATED" },
      { action: "RETIRED" },
      { action: "ROLLED_BACK" },
    ]);
  });
});

describe("Earth virtual parcel discovery", () => {
  it("generates bounded full cells on demand with synchronized detail and policy data", async () => {
    const { owner, created } = await createReviewedActiveZone();
    const zone = await getEarthDevelopmentZone(owner.user.id, owner.workspaceId, created.zone.id);
    expect(zone).toMatchObject({
      isDemonstration: true,
      provenance: { isSynthetic: true },
      cellSizeMeters: [25, 25],
      virtualOnlyNotice: expect.stringContaining("virtual only"),
    });

    const first = await listEarthParcels(owner.user.id, owner.workspaceId, created.zone.id, {
      bbox: zone.bbox.join(","),
      zoom: 18,
      limit: 7,
    });
    expect(first.items).toHaveLength(7);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.scannedCandidates).toBeLessThanOrEqual(4_096);
    expect(first.items.every((parcel) => parcel.areaSquareMeters === 625)).toBe(true);
    expect(new Set(first.items.map((parcel) => parcel.id)).size).toBe(first.items.length);

    const selected = first.items[0]!;
    await expect(getEarthParcel(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      selected.id,
      selected.grid,
    )).resolves.toEqual(selected);
    await expect(getEarthParcel(
      owner.user.id,
      owner.workspaceId,
      created.zone.id,
      "parcel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      selected.grid,
    )).rejects.toBeInstanceOf(NotFoundError);

    await expect(getEarthZoneRules(owner.user.id, owner.workspaceId, created.zone.id))
      .resolves.toMatchObject({ edgePolicy: "FULL_CELL", cellSizeMeters: [25, 25] });
    await expect(getEarthZoneEligibility(owner.user.id, owner.workspaceId, created.zone.id))
      .resolves.toMatchObject({ onlyFullCells: true, minimumZoom: 16, maximumResults: 500 });

    const modelNames = Object.keys(prisma).map((name) => name.toLowerCase());
    expect(modelNames.some((name) => name === "earthparcel" || name === "parcelclaim"
      || name === "landownership")).toBe(false);
  });

  it("enforces zoom, result and viewport limits without global generation", async () => {
    const { owner, created } = await createReviewedActiveZone();
    const zone = await getEarthDevelopmentZone(owner.user.id, owner.workspaceId, created.zone.id);
    await expect(listEarthParcels(owner.user.id, owner.workspaceId, created.zone.id, {
      bbox: zone.bbox.join(","), zoom: 15, limit: 10,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(listEarthParcels(owner.user.id, owner.workspaceId, created.zone.id, {
      bbox: "-180,-80,180,80", zoom: 18, limit: 10,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(listEarthParcels(owner.user.id, owner.workspaceId, created.zone.id, {
      bbox: zone.bbox.join(","), zoom: 18, limit: 501,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(listEarthParcels(owner.user.id, owner.workspaceId, created.zone.id, {
      bbox: "4,7,4.01,7.01", zoom: 18, limit: 10,
    })).resolves.toEqual({ items: [], nextCursor: null, limit: 10, scannedCandidates: 0 });
  });

  it("makes active global inventory readable only through a valid workspace session", async () => {
    const { owner, created } = await createReviewedActiveZone();
    const other = await account("Other authenticated owner");
    await expect(listEarthDevelopmentZones(other.user.id, other.workspaceId, {
      includeDemonstration: "false",
    })).resolves.toEqual({ items: [], limit: 50 });
    const visible = await listEarthDevelopmentZones(other.user.id, other.workspaceId, {
      includeDemonstration: "true",
    });
    expect(visible.items.map((zone) => zone.id)).toEqual([created.zone.id]);
    await expect(listEarthDevelopmentZoneVersions(
      other.user.id,
      other.workspaceId,
      created.zone.id,
    )).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listEarthDevelopmentZones("missing-user", owner.workspaceId))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
