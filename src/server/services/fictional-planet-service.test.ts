import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  archiveFictionalCountry,
  createFictionalCountryDraft,
  getPublicFictionalCountry,
  listFictionalCountryDrafts,
  listPublicFictionalCountries,
  publishFictionalCountry,
  updateFictionalCountryDraft,
} from "./fictional-planet-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function owner(label = "Planet Owner") {
  sequence++;
  return registerUser({
    displayName: label, email: `planet-${sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
}
async function authorize(userId: string, canPublish = true) {
  await prisma.fictionalPlanetSteward.create({
    data: { userId, isActive: true, canPublish },
  });
}
function input(name: string, w: number, s: number, e: number, n: number) {
  return {
    name, description: "Original fictional place", color: "#38DCE4",
    geometry: { type: "Polygon", coordinates: [[[w,s],[e,s],[e,n],[w,n],[w,s]]] },
  };
}

describe("Fictional Planet country lifecycle", () => {
  it("is blank by default and never seeds Galex or real countries", async () => {
    expect(await listPublicFictionalCountries()).toEqual({
      planet: { id: "simverse-planet-v1", name: "SIMVERSE Planet", radiusKm: 6000 },
      countries: [],
    });
    expect(await prisma.fictionalCountry.count()).toBe(0);
    expect(await prisma.earthGeoPlace.count()).toBe(0);
  });

  it("requires a separate steward grant even when the account owns its workspace", async () => {
    const user = await owner();
    await expect(createFictionalCountryDraft(
      user.user.id, user.workspaceId, input("Galex",0,0,6,6),
    )).rejects.toBeInstanceOf(AuthorizationError);

    await authorize(user.user.id, false);
    const draft = await createFictionalCountryDraft(
      user.user.id, user.workspaceId, input("Galex",0,0,6,6),
    );
    await expect(publishFictionalCountry(user.user.id, user.workspaceId, draft.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    expect((await listPublicFictionalCountries()).countries).toHaveLength(0);

    const another = await owner("Second owner");
    await expect(listFictionalCountryDrafts(user.user.id, another.workspaceId))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("publishes only after approval and preserves earlier published versions", async () => {
    const user = await owner();
    await authorize(user.user.id);
    const draft = await createFictionalCountryDraft(
      user.user.id, user.workspaceId, input("Galex",0,0,6,6),
    );
    expect(draft.status).toBe("DRAFT");
    expect(draft.draft?.revision).toBe(1);
    expect((await listPublicFictionalCountries()).countries).toHaveLength(0);
    await expect(getPublicFictionalCountry(draft.id)).rejects.toBeInstanceOf(NotFoundError);

    const published = await publishFictionalCountry(user.user.id, user.workspaceId, draft.id);
    expect(published.name).toBe("Galex");
    expect(published.publishedRevision).toBe(1);
    expect(published.areaKm2).toBeGreaterThan(0);
    expect((await listPublicFictionalCountries()).countries).toHaveLength(1);

    const edited = await updateFictionalCountryDraft(
      user.user.id, user.workspaceId, draft.id,
      { name: "Galex Prime", geometry: input("Temporary",0,0,8,8).geometry },
    );
    expect(edited.draft?.revision).toBe(2);
    expect(edited.published?.revision).toBe(1);
    expect((await getPublicFictionalCountry(draft.id)).name).toBe("Galex");
    expect((await getPublicFictionalCountry(draft.id)).areaKm2).toBe(published.areaKm2);

    const next = await publishFictionalCountry(user.user.id, user.workspaceId, draft.id);
    expect(next.publishedRevision).toBe(2);
    expect(next.name).toBe("Galex Prime");
    expect(next.areaKm2).toBeGreaterThan(published.areaKm2);
    expect(await prisma.fictionalCountryVersion.count({ where: { countryId: draft.id } })).toBe(2);
  });

  it("rejects collisions, duplicate country names and overlapping publication", async () => {
    const user = await owner();
    await authorize(user.user.id);
    const galex = await createFictionalCountryDraft(
      user.user.id, user.workspaceId, input("Galex",0,0,8,8),
    );
    await publishFictionalCountry(user.user.id, user.workspaceId, galex.id);
    await expect(createFictionalCountryDraft(user.user.id,user.workspaceId,input("Galex",20,0,25,5)))
      .rejects.toBeInstanceOf(ConflictError);

    const other = await createFictionalCountryDraft(
      user.user.id, user.workspaceId, input("Aurelia",5,5,12,12),
    );
    await expect(publishFictionalCountry(user.user.id, user.workspaceId, other.id))
      .rejects.toBeInstanceOf(ConflictError);
    expect((await listPublicFictionalCountries()).countries).toHaveLength(1);

    await updateFictionalCountryDraft(user.user.id,user.workspaceId,other.id,{geometry:input("Aurelia",10,10,16,16).geometry});
    await publishFictionalCountry(user.user.id, user.workspaceId, other.id);
    expect((await listPublicFictionalCountries()).countries).toHaveLength(2);
    expect((await prisma.auditLog.count({ where: { action: "planet.country.published" } }))).toBe(2);
  });

  it("archives a country without deleting its immutable history", async () => {
    const user = await owner();
    await authorize(user.user.id);
    const draft = await createFictionalCountryDraft(
      user.user.id, user.workspaceId, input("Galex",0,0,6,6),
    );
    await publishFictionalCountry(user.user.id, user.workspaceId, draft.id);
    await archiveFictionalCountry(user.user.id,user.workspaceId,draft.id);
    expect((await listPublicFictionalCountries()).countries).toHaveLength(0);
    expect(await prisma.fictionalCountryVersion.count({ where: { countryId: draft.id } })).toBe(1);
  });
});
