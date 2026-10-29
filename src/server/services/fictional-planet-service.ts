import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  PLANET_ID, createFictionalCountrySchema, editFictionalCountrySchema,
  fictionalCountryIdSchema, fictionalCountrySlug, planetGeometryInputSchema,
} from "@/lib/planet/contracts";
import { PLANET_RADIUS_KM, polygonsOverlap, validatePlanetGeometry, type PlanetGeometry } from "@/lib/planet/geometry";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { requireMembership } from "./workspace-service";
import { recordAudit } from "./audit-service";

const countryInclude = { versions: true } as const;
type CountryWithVersions = Prisma.FictionalCountryGetPayload<{ include: typeof countryInclude }>;

function safeGeometry(value: unknown): ReturnType<typeof validatePlanetGeometry> {
  if (JSON.stringify(value ?? null).length > 160_000) {
    throw new ValidationError("Territory geometry exceeds the 160 KB request limit.");
  }
  const result = planetGeometryInputSchema.safeParse(value);
  if (!result.success) throw new ValidationError("Invalid territory polygon coordinates.");
  return validatePlanetGeometry(result.data);
}

function draftRevision(country: CountryWithVersions) {
  return country.versions.find((v) => v.id === country.draftVersionId);
}
function publishedRevision(country: CountryWithVersions) {
  return country.versions.find((v) => v.id === country.publishedVersionId);
}

function publicProjection(country: CountryWithVersions) {
  const v = publishedRevision(country);
  if (country.status !== "PUBLISHED" || !v) throw new NotFoundError("Country not found.");
  return {
    id: country.id,
    planetId: country.planetId,
    name: v.name,
    slug: v.slug,
    description: v.description,
    color: v.color,
    status: "PUBLISHED" as const,
    publishedRevision: v.revision,
    areaKm2: v.areaKm2,
    label: [v.labelLongitude, v.labelLatitude] as [number,number],
    geometry: JSON.parse(v.geometryJson) as PlanetGeometry,
  };
}
function editorProjection(country: CountryWithVersions) {
  const draft = draftRevision(country);
  const published = publishedRevision(country);
  return {
    id: country.id,
    name: country.name,
    slug: country.slug,
    description: country.description,
    color: country.color,
    status: country.status,
    updatedAt: country.updatedAt.toISOString(),
    draft: draft ? {
      id: draft.id, revision: draft.revision, areaKm2: draft.areaKm2,
      label: [draft.labelLongitude, draft.labelLatitude] as [number, number],
      geometry: JSON.parse(draft.geometryJson) as PlanetGeometry,
    } : null,
    published: published ? {
      id: published.id, revision: published.revision, areaKm2: published.areaKm2,
      label: [published.labelLongitude, published.labelLatitude] as [number, number],
      geometry: JSON.parse(published.geometryJson) as PlanetGeometry,
    } : null,
  };
}

/**
 * Workspace role is NOT a planet publishing grant. We require BOTH privileged
 * workspace membership and explicit FictionalPlanetSteward enrollment.
 */
async function requirePlanetSteward(userId: string, workspaceId: string, publishing = false) {
  const membership = await requireMembership(userId, workspaceId, "workspace.view");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new AuthorizationError("Planet administration requires an owner or admin role.");
  }
  const grant = await prisma.fictionalPlanetSteward.findUnique({ where: { userId } });
  if (!grant?.isActive || (publishing && !grant.canPublish)) {
    throw new AuthorizationError("An active planet steward grant is required.");
  }
}

export async function listPublicFictionalCountries() {
  const countries = await prisma.fictionalCountry.findMany({
    where: { planetId: PLANET_ID, status: "PUBLISHED", publishedVersionId: { not: null } },
    include: countryInclude, orderBy: { name: "asc" }, take: 100,
  });
  return {
    planet: { id: PLANET_ID, name: "SIMVERSE Planet", radiusKm: PLANET_RADIUS_KM },
    countries: countries.map(publicProjection),
  };
}

export async function getPublicFictionalCountry(id: string) {
  const countryId = parseOrThrow(fictionalCountryIdSchema, id);
  const country = await prisma.fictionalCountry.findUnique({
    where: { id: countryId }, include: countryInclude,
  });
  if (!country || country.planetId !== PLANET_ID) throw new NotFoundError("Country not found.");
  return publicProjection(country);
}

export async function listFictionalCountryDrafts(userId: string, workspaceId: string) {
  await requirePlanetSteward(userId, workspaceId);
  const records = await prisma.fictionalCountry.findMany({
    where: { planetId: PLANET_ID }, include: countryInclude,
    orderBy: { updatedAt: "desc" }, take: 100,
  });
  return { countries: records.map(editorProjection) };
}

export async function createFictionalCountryDraft(userId: string, workspaceId: string, raw: unknown) {
  await requirePlanetSteward(userId, workspaceId);
  const input = parseOrThrow(createFictionalCountrySchema, raw);
  const geometry = safeGeometry(input.geometry);
  const slug = fictionalCountrySlug(input.name);
  if (slug.length < 2) throw new ValidationError("Country name must contain at least two letters or numbers.");

  return prisma.$transaction(async (tx) => {
    const collision = await tx.fictionalCountry.findUnique({ where: { planetId_slug: { planetId: PLANET_ID, slug } } });
    if (collision) throw new ConflictError("A country with this name already exists.");
    await tx.fictionalPlanet.upsert({
      where: { id: PLANET_ID },
      create: { id: PLANET_ID, name: "SIMVERSE Planet", radiusKm: PLANET_RADIUS_KM },
      update: {},
    });
    const country = await tx.fictionalCountry.create({
      data: {
        planetId: PLANET_ID, name: input.name, slug,
        description: input.description, color: input.color,
        createdByUserId: userId, status: "DRAFT",
      },
    });
    const version = await tx.fictionalCountryVersion.create({
      data: {
        countryId: country.id, revision: 1,
        name: input.name, slug, description: input.description, color: input.color,
        geometryJson: JSON.stringify(geometry.geometry),
        geometryHash: createHash("sha256").update(JSON.stringify(geometry.geometry)).digest("hex"),
        areaKm2: geometry.areaKm2, labelLongitude: geometry.label[0],
        labelLatitude: geometry.label[1], createdByUserId: userId,
      },
    });
    await tx.fictionalCountry.update({
      where: { id: country.id }, data: { draftVersionId: version.id },
    });
    await recordAudit({
      action: "planet.country.draft_created", actorUserId: userId,
      workspaceId, entityType: "FictionalCountry", entityId: country.id,
      metadata: { slug, revision: 1 },
    }, tx);
    const updated = await tx.fictionalCountry.findUniqueOrThrow({
      where: { id: country.id }, include: countryInclude,
    });
    return editorProjection(updated);
  });
}

export async function updateFictionalCountryDraft(
  userId: string, workspaceId: string, id: string, raw: unknown,
) {
  await requirePlanetSteward(userId, workspaceId);
  const countryId = parseOrThrow(fictionalCountryIdSchema, id);
  const input = parseOrThrow(editFictionalCountrySchema, raw);
  const candidate = input.geometry === undefined ? null : safeGeometry(input.geometry);
  return prisma.$transaction(async (tx) => {
    const country = await tx.fictionalCountry.findUnique({
      where: { id: countryId }, include: countryInclude,
    });
    if (!country || country.planetId !== PLANET_ID || country.status === "ARCHIVED") {
      throw new NotFoundError("Editable country not found.");
    }
    const newName = input.name ?? country.name;
    const newSlug = fictionalCountrySlug(newName);
    if (newSlug.length < 2) throw new ValidationError("Country name must contain letters or numbers.");
    if (newSlug !== country.slug) {
      const collision = await tx.fictionalCountry.findUnique({
        where: { planetId_slug: { planetId: PLANET_ID, slug: newSlug } },
      });
      if (collision) throw new ConflictError("A country with this name already exists.");
    }
    const currentDraft = draftRevision(country);
    if (!currentDraft) throw new ConflictError("This country has no editable territory.");
    const revision = Math.max(0, ...country.versions.map((v) => v.revision)) + 1;
    const geometryJson = candidate ? JSON.stringify(candidate.geometry) : currentDraft.geometryJson;
    const version = await tx.fictionalCountryVersion.create({
      data: {
        countryId, revision, geometryJson, name: newName, slug: newSlug,
        description: input.description ?? country.description,
        color: input.color ?? country.color,
        geometryHash: createHash("sha256").update(geometryJson).digest("hex"),
        areaKm2: candidate?.areaKm2 ?? currentDraft.areaKm2,
        labelLongitude: candidate?.label[0] ?? currentDraft.labelLongitude,
        labelLatitude: candidate?.label[1] ?? currentDraft.labelLatitude,
        createdByUserId: userId,
      },
    });
    const draftVersionId = version.id;
    await tx.fictionalCountry.update({
      where: { id: countryId },
      data: {
        name: newName, slug: newSlug,
        description: input.description ?? country.description,
        color: input.color ?? country.color,
        draftVersionId,
      },
    });
    await recordAudit({
      action: "planet.country.draft_updated", actorUserId: userId,
      workspaceId, entityType: "FictionalCountry", entityId: countryId,
      metadata: { revision, metadataOnly: !candidate },
    }, tx);
    const updated = await tx.fictionalCountry.findUniqueOrThrow({
      where: { id: countryId }, include: countryInclude,
    });
    return editorProjection(updated);
  });
}

export async function publishFictionalCountry(
  userId: string, workspaceId: string, id: string,
) {
  await requirePlanetSteward(userId, workspaceId, true);
  const countryId = parseOrThrow(fictionalCountryIdSchema, id);
  return prisma.$transaction(async (tx) => {
    const country = await tx.fictionalCountry.findUnique({
      where: { id: countryId }, include: countryInclude,
    });
    if (!country || country.planetId !== PLANET_ID || country.status === "ARCHIVED") {
      throw new NotFoundError("Publishable country not found.");
    }
    const draft = draftRevision(country);
    if (!draft) throw new ConflictError("Create a valid territory draft before publishing.");
    const candidate = safeGeometry(JSON.parse(draft.geometryJson));
    const published = await tx.fictionalCountry.findMany({
      where: {
        planetId: PLANET_ID, status: "PUBLISHED",
        publishedVersionId: { not: null }, id: { not: countryId },
      },
      include: countryInclude,
    });
    for (const item of published) {
      const version = publishedRevision(item);
      if (version && polygonsOverlap(candidate.geometry, JSON.parse(version.geometryJson) as PlanetGeometry)) {
        throw new ConflictError(`Territory overlaps published country: ${item.name}.`);
      }
    }
    await tx.fictionalCountry.update({
      where: { id: countryId }, data: { publishedVersionId: draft.id, status: "PUBLISHED" },
    });
    await recordAudit({
      action: "planet.country.published", actorUserId: userId,
      workspaceId, entityType: "FictionalCountry", entityId: countryId,
      metadata: { revision: draft.revision, areaKm2: draft.areaKm2 },
    }, tx);
    const updated = await tx.fictionalCountry.findUniqueOrThrow({
      where: { id: countryId }, include: countryInclude,
    });
    return publicProjection(updated);
  });
}

export async function archiveFictionalCountry(
  userId: string, workspaceId: string, id: string,
) {
  await requirePlanetSteward(userId, workspaceId, true);
  const countryId = parseOrThrow(fictionalCountryIdSchema, id);
  return prisma.$transaction(async (tx) => {
    const country = await tx.fictionalCountry.findUnique({ where: { id: countryId } });
    if (!country || country.planetId !== PLANET_ID) throw new NotFoundError("Country not found.");
    await tx.fictionalCountry.update({ where: { id: countryId }, data: { status: "ARCHIVED" } });
    await recordAudit({
      action: "planet.country.archived", actorUserId: userId, workspaceId,
      entityType: "FictionalCountry", entityId: countryId,
    }, tx);
    return { id: countryId, status: "ARCHIVED" as const };
  });
}
