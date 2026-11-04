import { z } from "zod";

export const clubSafetyIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);
export const clubSanctionSchema = z.strictObject({
  targetUserId: clubSafetyIdSchema,
  kind: z.enum(["MUTE", "BAN"]),
  reason: z.string().trim().min(15).max(500),
  durationHours: z.number().int().min(1).max(30 * 24),
});
export const clubSanctionRevokeSchema = z.strictObject({
  sanctionId: clubSafetyIdSchema,
  reason: z.string().trim().min(10).max(350),
});
export const clubAppealSchema = z.strictObject({
  sanctionId: clubSafetyIdSchema,
  reason: z.string().trim().min(20).max(1000),
});
export const clubAppealDecisionSchema = z.strictObject({
  appealId: clubSafetyIdSchema,
  decision: z.enum(["UPHOLD", "OVERTURN"]),
  reason: z.string().trim().min(15).max(500),
});
export const clubGrantSchema = z.strictObject({
  districtId: clubSafetyIdSchema,
  targetUserId: clubSafetyIdSchema,
  active: z.boolean(),
  reason: z.string().trim().min(10).max(350),
});
