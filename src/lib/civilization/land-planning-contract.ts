import { z } from "zod";

export const LAND_GRID = 10000 as const;
export const landDistrictIdSchema = z.string().regex(/^[a-z0-9_-]{8,64}$/i);

export const landPlanInput = z.object({
  districtId: landDistrictIdSchema,
}).strict();

export const landAreaInput = z.object({
  districtId: landDistrictIdSchema,
  name: z.string().trim().min(3).max(80),
  kind: z.enum(["PROTECTED", "PUBLIC_RESERVE", "DEVELOPMENT"]),
  zone: z.enum(["ECOLOGICAL", "CORRIDOR", "CIVIC", "RESIDENTIAL", "COMMERCIAL", "MIXED_USE"]),
  x: z.number().int().min(0).max(LAND_GRID - 1),
  y: z.number().int().min(0).max(LAND_GRID - 1),
  width: z.number().int().min(100).max(LAND_GRID),
  height: z.number().int().min(100).max(LAND_GRID),
}).strict().superRefine((v, ctx) => {
  if (v.x + v.width > LAND_GRID || v.y + v.height > LAND_GRID)
    ctx.addIssue({ code: "custom", message: "The planning area must fit inside the schematic board." });
  if (v.kind === "PROTECTED" && !["ECOLOGICAL", "CORRIDOR"].includes(v.zone))
    ctx.addIssue({ code: "custom", message: "Protected land must be an ecological area or protected corridor." });
  if (v.kind === "PUBLIC_RESERVE" && v.zone !== "CIVIC")
    ctx.addIssue({ code: "custom", message: "Public reserves must use the civic designation." });
  if (v.kind === "DEVELOPMENT" && !["RESIDENTIAL", "COMMERCIAL", "MIXED_USE"].includes(v.zone))
    ctx.addIssue({ code: "custom", message: "Development zones must use residential, commercial or mixed-use designation." });
});

export type LandRectangle = { x: number; y: number; width: number; height: number };
export function overlap(a: LandRectangle, b: LandRectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

export const LAND_PLANNING_NOTICE =
  "Schematic planning only: coordinates are diagram units, not real geographic boundaries, legal parcels, ownership, construction authorization or project funding. Phase 2-approved versioned district boundaries are required before real land allocation.";
