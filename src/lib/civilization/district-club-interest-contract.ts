import { z } from "zod";
export const clubInterestIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);
export const clubInterestCreateSchema = z.strictObject({
  title: z.string().trim().min(4).max(70),
  description: z.string().trim().min(15).max(400),
});
export const clubInterestMembershipSchema = z.strictObject({
  groupId: clubInterestIdSchema,
  action: z.enum(["JOIN", "LEAVE"]),
});
export const clubInterestMessageSchema = z.strictObject({
  groupId: clubInterestIdSchema,
  body: z.string().trim().min(2).max(650),
});
export const clubInterestReportSchema = z.strictObject({
  messageId: clubInterestIdSchema,
  reason: z.string().trim().min(10).max(350),
});
export const clubInterestModerationSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("HIDE"), reportId: clubInterestIdSchema }),
  z.strictObject({ action: z.literal("DISMISS"), reportId: clubInterestIdSchema }),
  z.strictObject({ action: z.literal("CLOSE_GROUP"), groupId: clubInterestIdSchema }),
]);
