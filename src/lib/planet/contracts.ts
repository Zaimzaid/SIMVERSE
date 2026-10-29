import { z } from "zod";

export const PLANET_ID = "simverse-planet-v1";
export const PLANET_COLOR_DEFAULT = "#38DCE4";
export const fictionalCountryIdSchema = z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/);

export const createFictionalCountrySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1200).optional().default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hexadecimal color.").default(PLANET_COLOR_DEFAULT),
  geometry: z.unknown(),
}).strict();

export const editFictionalCountrySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(1200).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  geometry: z.unknown().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "At least one field must be provided.");

export function fictionalCountrySlug(name: string): string {
  return name.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
