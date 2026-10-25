import { z } from "zod";
import { earthPlaceIdSchema } from "./schemas";

export const PUBLIC_EARTH_SEARCH_MAX_RESULTS = 10;
export const EARTH_DESTINATION_INTENT_MAX_LENGTH = 512;

export const EARTH_OVERVIEW_V1 = {
  id: "natural-earth-land-110m-v1",
  dataset: "Natural Earth",
  layer: "land",
  scale: "1:110m",
  sourceVersion: "5.1.2",
  sourceRevision: "f1890d9f152c896d250a77557a5751a93d494776",
  sourceUrl: "https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/",
  licenseName: "Public Domain",
  licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
  attribution: "Made with Natural Earth.",
  tileTemplate: "/earth/overview/v1/tiles/{z}/{x}/{y}.pbf",
  minZoom: 0,
  maxZoom: 2,
} as const;

const finiteCoordinateSchema = z.number().finite();
const bboxSchema = z.tuple([
  finiteCoordinateSchema,
  finiteCoordinateSchema,
  finiteCoordinateSchema,
  finiteCoordinateSchema,
]);
const centerSchema = z.tuple([finiteCoordinateSchema, finiteCoordinateSchema]);

export const publicEarthCountrySchema = z.object({
  id: earthPlaceIdSchema,
  name: z.string().min(1).max(160),
  kind: z.literal("COUNTRY"),
  isoAlpha2: z.string().length(2),
  isoAlpha3: z.string().length(3),
  center: centerSchema,
  bbox: bboxSchema,
  coverage: z.literal("SUPPORTED"),
}).strict();

export const publicEarthOverviewSchema = z.object({
  id: z.literal(EARTH_OVERVIEW_V1.id),
  dataset: z.literal(EARTH_OVERVIEW_V1.dataset),
  layer: z.literal(EARTH_OVERVIEW_V1.layer),
  scale: z.literal(EARTH_OVERVIEW_V1.scale),
  sourceVersion: z.literal(EARTH_OVERVIEW_V1.sourceVersion),
  sourceRevision: z.literal(EARTH_OVERVIEW_V1.sourceRevision),
  sourceUrl: z.url(),
  licenseName: z.literal(EARTH_OVERVIEW_V1.licenseName),
  licenseUrl: z.url(),
  attribution: z.literal(EARTH_OVERVIEW_V1.attribution),
  tileTemplate: z.string().startsWith("/earth/overview/v1/tiles/"),
  minZoom: z.literal(EARTH_OVERVIEW_V1.minZoom),
  maxZoom: z.literal(EARTH_OVERVIEW_V1.maxZoom),
  countries: z.array(publicEarthCountrySchema).max(25),
}).strict();

export const publicEarthSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(PUBLIC_EARTH_SEARCH_MAX_RESULTS).default(8),
}).strict();

export const earthDestinationRequestSchema = z.object({
  placeId: earthPlaceIdSchema,
}).strict();

export const earthDestinationIntentTokenSchema = z.string()
  .min(80)
  .max(EARTH_DESTINATION_INTENT_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/, "Invalid Earth destination intent.");

export const earthDestinationIntentResponseSchema = z.object({
  intent: earthDestinationIntentTokenSchema,
  expiresAt: z.iso.datetime(),
  destination: publicEarthCountrySchema,
  loginHref: z.string().startsWith("/login?earthIntent="),
  registerHref: z.string().startsWith("/register?earthIntent="),
}).strict();

export type PublicEarthCountry = z.infer<typeof publicEarthCountrySchema>;
export type PublicEarthOverview = z.infer<typeof publicEarthOverviewSchema>;
export type PublicEarthSearchQuery = z.infer<typeof publicEarthSearchQuerySchema>;
export type EarthDestinationIntentResponse = z.infer<typeof earthDestinationIntentResponseSchema>;
