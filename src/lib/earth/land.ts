import { z } from "zod";
import {
  EARTH_DEFAULT_PARCEL_METERS,
  EARTH_PARCEL_VIEWPORT_DEFAULT_RESULTS,
  EARTH_PARCEL_VIEWPORT_MAX_RESULTS,
  EARTH_PARCEL_VIEWPORT_MIN_ZOOM,
  type EarthAreaGeometry,
  type EarthPosition,
  type EarthZoneExclusion,
} from "./parcels";
import { earthPlaceIdSchema } from "./schemas";

export const EARTH_ZONE_STATUSES = ["DRAFT", "REVIEW", "ACTIVE", "RETIRED"] as const;
export type EarthZoneStatus = (typeof EARTH_ZONE_STATUSES)[number];

export const earthZoneIdSchema = z.string().trim().regex(
  /^zone_[0-9a-f]{24}$/,
  "Use a valid Earth development-zone identifier.",
);
export const earthZoneVersionIdSchema = z.string().trim().regex(
  /^zonev_[0-9a-f]{24}$/,
  "Use a valid Earth development-zone version identifier.",
);
export const earthParcelIdSchema = z.string().trim().regex(
  /^parcel_[0-9a-f]{32}$/,
  "Use a valid virtual parcel identifier.",
);

const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const ringSchema = z.array(coordinateSchema).min(4).max(2_000);
const polygonCoordinatesSchema = z.array(ringSchema).min(1).max(25);

export const earthAreaGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Polygon"),
    coordinates: polygonCoordinatesSchema,
  }).strict(),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(polygonCoordinatesSchema).min(1).max(25),
  }).strict(),
]);

const exclusionSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(500),
  geometry: earthAreaGeometrySchema,
}).strict();

export const earthZoneRestrictionsSchema = z.object({
  zoningCode: z.string().trim().min(1).max(40),
  zoningLabel: z.string().trim().min(1).max(120),
  allowedUses: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  maximumHeightMeters: z.number().finite().positive().max(1_000).nullable().default(null),
  minimumSetbackMeters: z.number().finite().nonnegative().max(500).default(0),
  notes: z.string().trim().max(2_000).default(""),
}).strict();

export const earthZoneProvenanceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2_000),
  sourceUrl: z.url().nullable().default(null),
  licenseName: z.string().trim().min(1).max(120),
  reviewedContext: z.string().trim().min(1).max(500),
  isSynthetic: z.boolean(),
}).strict();

export const earthZoneVersionDefinitionSchema = z.object({
  geometry: earthAreaGeometrySchema,
  exclusions: z.array(exclusionSchema).max(50).default([]),
  projectionSrid: z.number().int().min(32601).max(32760),
  gridOrigin: coordinateSchema,
  gridBearingDegrees: z.number().finite().min(-180).max(180).default(0),
  cellWidthMeters: z.number().finite().min(10).max(1_000).default(EARTH_DEFAULT_PARCEL_METERS),
  cellHeightMeters: z.number().finite().min(10).max(1_000).default(EARTH_DEFAULT_PARCEL_METERS),
  edgePolicy: z.literal("FULL_CELL").default("FULL_CELL"),
  restrictions: earthZoneRestrictionsSchema,
  provenance: earthZoneProvenanceSchema,
  reviewNote: z.string().trim().max(2_000).nullable().default(null),
}).strict();

export const createEarthZoneSchema = z.object({
  key: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(160),
  placeId: earthPlaceIdSchema,
  isDemonstration: z.boolean().default(false),
  definition: earthZoneVersionDefinitionSchema,
}).strict().superRefine((input, context) => {
  if (input.isDemonstration && !input.definition.provenance.isSynthetic) {
    context.addIssue({
      code: "custom",
      path: ["definition", "provenance", "isSynthetic"],
      message: "Demonstration zones must identify their synthetic geometry.",
    });
  }
});

export const createEarthZoneVersionSchema = z.object({
  definition: earthZoneVersionDefinitionSchema,
}).strict();

export const earthZoneLifecycleActionSchema = z.object({
  action: z.enum(["SUBMIT_FOR_REVIEW", "ACTIVATE", "ROLLBACK"]),
}).strict();

export const earthZoneListQuerySchema = z.object({
  placeId: earthPlaceIdSchema.optional(),
  includeDemonstration: z.union([
    z.boolean(),
    z.enum(["true", "false"]).transform((value) => value === "true"),
  ]).default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

const bboxQuerySchema = z.string().trim().transform((value, context) => {
  const parts = value.split(",").map((entry) => Number(entry));
  if (parts.length !== 4 || parts.some((entry) => !Number.isFinite(entry))) {
    context.addIssue({ code: "custom", message: "bbox must be west,south,east,north." });
    return z.NEVER;
  }
  const [west, south, east, north] = parts as [number, number, number, number];
  if (west < -180 || east > 180 || south < -90 || north > 90
    || west >= east || south >= north || east - west > 180) {
    context.addIssue({ code: "custom", message: "bbox must be a bounded WGS84 box." });
    return z.NEVER;
  }
  return [west, south, east, north] as [number, number, number, number];
});

export const earthParcelViewportQuerySchema = z.object({
  bbox: bboxQuerySchema,
  zoom: z.coerce.number().finite().min(EARTH_PARCEL_VIEWPORT_MIN_ZOOM).max(24),
  limit: z.coerce.number().int().min(1).max(EARTH_PARCEL_VIEWPORT_MAX_RESULTS)
    .default(EARTH_PARCEL_VIEWPORT_DEFAULT_RESULTS),
  cursor: z.string().trim().min(3).max(80).optional(),
}).strict();

export const earthParcelGridQuerySchema = z.object({
  row: z.coerce.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  column: z.coerce.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
}).strict();

export interface EarthZoneRestrictions {
  zoningCode: string;
  zoningLabel: string;
  allowedUses: string[];
  maximumHeightMeters: number | null;
  minimumSetbackMeters: number;
  notes: string;
}
export interface EarthZoneProvenance {
  title: string;
  description: string;
  sourceUrl: string | null;
  licenseName: string;
  reviewedContext: string;
  isSynthetic: boolean;
}

export interface EarthZoneVersionDefinition {
  geometry: EarthAreaGeometry;
  exclusions: EarthZoneExclusion[];
  projectionSrid: number;
  gridOrigin: EarthPosition;
  gridBearingDegrees: number;
  cellWidthMeters: number;
  cellHeightMeters: number;
  edgePolicy: "FULL_CELL";
  restrictions: EarthZoneRestrictions;
  provenance: EarthZoneProvenance;
  reviewNote: string | null;
}

export interface EarthZoneSummary {
  id: string;
  name: string;
  status: EarthZoneStatus;
  placeId: string;
  placeName: string;
  isDemonstration: boolean;
  activeVersion: number;
  activeVersionId: string;
  bbox: [number, number, number, number];
  zoningLabel: string;
  cellSizeMeters: [number, number];
  virtualOnlyNotice: string;
}

export interface EarthZoneDetail extends EarthZoneSummary {
  geometry: EarthAreaGeometry;
  exclusions: EarthZoneExclusion[];
  projection: {
    code: string;
    srid: number;
    definition: string;
  };
  grid: {
    origin: EarthPosition;
    bearingDegrees: number;
    algorithmVersion: string;
    edgePolicy: "FULL_CELL";
  };
  restrictions: EarthZoneRestrictions;
  provenance: EarthZoneProvenance;
  contentHash: string;
  activatedAt: string | null;
}

export interface EarthParcelView {
  id: string;
  zoneId: string;
  zoneVersionId: string;
  geometry: EarthAreaGeometry;
  centroid: EarthPosition;
  areaSquareMeters: number;
  dimensionsMeters: [number, number];
  grid: { column: number; row: number };
  zoningCode: string;
  zoningLabel: string;
  status: "DISCOVERABLE";
  virtualOnlyNotice: string;
}

export function encodeEarthParcelCursor(value: { row: number; column: number }): string {
  return Buffer.from(`${value.row}:${value.column}`, "utf8").toString("base64url");
}

export function decodeEarthParcelCursor(value?: string): { row: number; column: number } | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (!/^-?\d+:-?\d+$/.test(decoded)) return null;
    const [row, column] = decoded.split(":").map(Number);
    if (!Number.isSafeInteger(row) || !Number.isSafeInteger(column)) return null;
    return { row: row!, column: column! };
  } catch {
    return null;
  }
}
