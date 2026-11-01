import { z } from "zod";

export const districtIdSchema = z.string().regex(/^[a-z0-9_-]{8,64}$/i);
export const assemblyIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);
export const proposalInputSchema = z.strictObject({
  districtId: districtIdSchema,
  title: z.string().trim().min(8).max(110),
  description: z.string().trim().min(35).max(2500),
  category: z.enum(["INFRASTRUCTURE", "ENVIRONMENT", "RECREATION", "SERVICES", "CULTURE"]),
});
export const commentInputSchema = z.strictObject({
  proposalId: assemblyIdSchema,
  body: z.string().trim().min(3).max(800),
});
export const voteInputSchema = z.strictObject({
  proposalId: assemblyIdSchema,
  choice: z.enum(["SUPPORT", "OPPOSE"]),
});
export const reviewProposalSchema = z.strictObject({
  proposalId: assemblyIdSchema,
  action: z.enum(["OPEN", "REJECT", "SHORTLIST"]),
  reason: z.string().trim().max(350).default(""),
});
export const reviewCommentSchema = z.strictObject({
  commentId: assemblyIdSchema,
  action: z.enum(["SHOW", "HIDE"]),
});
export const noticeInputSchema = z.strictObject({
  districtId: districtIdSchema,
  kind: z.enum(["ANNOUNCEMENT", "MEETING"]),
  title: z.string().trim().min(5).max(110),
  body: z.string().trim().min(10).max(1500),
  scheduledFor: z.string().datetime().nullable().default(null),
});
export const reportInputSchema = z.strictObject({
  proposalId: assemblyIdSchema,
  commentId: assemblyIdSchema.nullable().default(null),
  reason: z.string().trim().min(8).max(350),
});

export const assemblyPolicy = {
  proposalsPer24Hours: 3,
  commentsPerHour: 10,
  reportsPerHour: 5,
  minimumSupportForShortlist: 3,
  minimumVotingResidenceDays: 14,
  staffBuildAuthority: false,
} as const;

export const reviewReportSchema = z.strictObject({
  reportId: assemblyIdSchema,
  action: z.enum(["RESOLVE", "HIDE_COMMENT", "HIDE_PROPOSAL"]),
});
