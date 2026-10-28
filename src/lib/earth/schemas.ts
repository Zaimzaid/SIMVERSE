import { z } from "zod";
import {
  EARTH_BOUNDARY_QUALITIES,
  EARTH_GEOGRAPHY_DEFAULT_LIMIT,
  EARTH_GEOGRAPHY_MAX_LIMIT,
  EARTH_PLACE_KINDS,
  EARTH_VERIFICATION_STATUSES,
} from "./constants";

const publicPlaceIdSchema = z.string().trim().regex(
  /^geo_[0-9a-f]{24}$/,
  "Use a valid Earth place identifier.",
);

const boundedLimitSchema = z.coerce.number().int().min(1)
  .max(EARTH_GEOGRAPHY_MAX_LIMIT)
  .default(EARTH_GEOGRAPHY_DEFAULT_LIMIT);

export const earthPlaceListQuerySchema = z.object({
  parentId: publicPlaceIdSchema.optional(),
  kind: z.enum(EARTH_PLACE_KINDS).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  limit: boundedLimitSchema,
}).strict();

export const earthCountryListQuerySchema = z.object({
  limit: boundedLimitSchema,
}).strict();

export const earthIssueListQuerySchema = z.object({
  boundaryQuality: z.enum(EARTH_BOUNDARY_QUALITIES).optional(),
  verificationStatus: z.enum(EARTH_VERIFICATION_STATUSES).optional(),
  limit: boundedLimitSchema,
}).strict();

export const earthPlaceIdSchema = publicPlaceIdSchema;

export type EarthPlaceListQuery = z.infer<typeof earthPlaceListQuerySchema>;
export type EarthIssueListQuery = z.infer<typeof earthIssueListQuerySchema>;
