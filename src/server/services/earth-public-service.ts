import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { normalizeEarthPlaceName } from "@/lib/earth/import";
import {
  EARTH_OVERVIEW_V1,
  earthDestinationIntentResponseSchema,
  earthDestinationRequestSchema,
  publicEarthCountrySchema,
  publicEarthOverviewSchema,
  publicEarthSearchQuerySchema,
  type EarthDestinationIntentResponse,
  type PublicEarthCountry,
  type PublicEarthOverview,
} from "@/lib/earth/public";
import { parseOrThrow } from "@/lib/validation";
import { createEarthDestinationIntent, earthAuthHref } from "@/server/earth/destination-intent";
import { prisma } from "@/server/db/client";

const publicCountryInclude = {
  revisions: {
    where: { isCurrent: true, datasetVersion: { status: "ACTIVE" } },
    orderBy: { revision: "desc" as const },
    take: 1,
    select: {
      bboxWest: true,
      bboxSouth: true,
      bboxEast: true,
      bboxNorth: true,
      labelLongitude: true,
      labelLatitude: true,
    },
  },
} satisfies Prisma.EarthGeoPlaceInclude;

type PublicCountryRecord = Prisma.EarthGeoPlaceGetPayload<{ include: typeof publicCountryInclude }>;

const publicCountryWhere: Prisma.EarthGeoPlaceWhereInput = {
  kind: "COUNTRY",
  revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
};

function projectCountry(place: PublicCountryRecord): PublicEarthCountry {
  const revision = place.revisions[0];
  if (!revision || !place.isoAlpha2 || !place.isoAlpha3
    || revision.bboxWest === null || revision.bboxSouth === null
    || revision.bboxEast === null || revision.bboxNorth === null) {
    throw new NotFoundError("Supported Earth destination is unavailable.");
  }
  const bbox: [number, number, number, number] = [
    revision.bboxWest,
    revision.bboxSouth,
    revision.bboxEast,
    revision.bboxNorth,
  ];
  const center: [number, number] = revision.labelLongitude !== null
    && revision.labelLatitude !== null
    ? [revision.labelLongitude, revision.labelLatitude]
    : [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  return publicEarthCountrySchema.parse({
    id: place.publicId,
    name: place.name,
    kind: "COUNTRY",
    isoAlpha2: place.isoAlpha2,
    isoAlpha3: place.isoAlpha3,
    center,
    bbox,
    coverage: "SUPPORTED",
  });
}

export async function listPublicEarthCountries(): Promise<PublicEarthCountry[]> {
  const places = await prisma.earthGeoPlace.findMany({
    where: publicCountryWhere,
    include: publicCountryInclude,
    orderBy: { name: "asc" },
    take: 25,
  });
  return places.map(projectCountry);
}

export async function getPublicEarthOverview(): Promise<PublicEarthOverview> {
  return publicEarthOverviewSchema.parse({
    ...EARTH_OVERVIEW_V1,
    countries: await listPublicEarthCountries(),
  });
}

export async function searchPublicEarthCountries(input: unknown) {
  const query = parseOrThrow(publicEarthSearchQuerySchema, input, "Invalid public Earth search.");
  const normalized = normalizeEarthPlaceName(query.q);
  if (!normalized) throw new ValidationError("Search must contain letters or numbers.");
  const places = await prisma.earthGeoPlace.findMany({
    where: {
      AND: [publicCountryWhere, { normalizedName: { contains: normalized } }],
    },
    include: publicCountryInclude,
    orderBy: { name: "asc" },
    take: query.limit,
  });
  return { items: places.map(projectCountry), limit: query.limit };
}

export async function getPublicEarthCountry(placeId: string): Promise<PublicEarthCountry> {
  const parsed = earthDestinationRequestSchema.safeParse({ placeId });
  if (!parsed.success) throw new NotFoundError("Supported Earth destination not found.");
  const place = await prisma.earthGeoPlace.findFirst({
    where: { ...publicCountryWhere, publicId: parsed.data.placeId },
    include: publicCountryInclude,
  });
  if (!place) throw new NotFoundError("Supported Earth destination not found.");
  return projectCountry(place);
}

export async function createPublicEarthDestination(
  input: unknown,
  now = Date.now(),
): Promise<EarthDestinationIntentResponse> {
  const request = parseOrThrow(
    earthDestinationRequestSchema,
    input,
    "Invalid Earth destination request.",
  );
  const destination = await getPublicEarthCountry(request.placeId);
  const signed = createEarthDestinationIntent(destination.id, now);
  return earthDestinationIntentResponseSchema.parse({
    intent: signed.token,
    expiresAt: signed.expiresAt.toISOString(),
    destination,
    loginHref: earthAuthHref("/login", signed.token),
    registerHref: earthAuthHref("/register", signed.token),
  });
}
