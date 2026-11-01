import { z } from "zod";

export const developmentIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);
export const developmentDistrictSchema = z.string().regex(/^[a-z0-9_-]{8,64}$/i);

export const startFeasibilitySchema = z.object({
  proposalId: developmentIdSchema,
}).strict();

export const recordFeasibilitySchema = z.object({
  caseId: developmentIdSchema,
  decision: z.enum(["FEASIBLE_CONCEPT", "NEEDS_REVISION", "DECLINED"]),
  summary: z.string().trim().min(30).max(1800),
  indicativeCostVC: z.number().int().min(0).max(100_000_000).nullable(),
}).strict();

export const candidateAreaSchema = z.object({
  caseId: developmentIdSchema,
  areaId: developmentIdSchema,
}).strict();

export const publishPlanningUpdateSchema = z.object({
  caseId: developmentIdSchema,
  kind: z.enum(["REVIEW", "COMMUNITY_CONSULTATION", "GEO_DEPENDENCY", "HOLD"]),
  summary: z.string().trim().min(15).max(800),
}).strict();

export const developmentDisclaimer =
  "Community support and staff feasibility do not approve construction, allocate land, " +
  "spend Vascoin or promise project delivery. All location candidates use non-geographic " +
  "Phase 7 schematics. Real sites and implementation remain blocked until authoritative " +
  "Phase 2 geography, budgets and separate owner/staff approvals are available.";

export const DEVELOPMENT_MAX_PUBLIC_UPDATES_PER_DAY = 5;
