import { z } from "zod";

/** SIMVERSE-only policy. These values never describe real immigration law. */
export const citizenshipPolicyProposalSchema = z.strictObject({
  countryPlaceId: z.string().cuid(),
  allowsDualCitizenship: z.boolean(),
  minResidenceDays: z.number().int().min(0).max(365),
});
export const treatyProposalSchema = z.strictObject({
  originCountryId: z.string().cuid(),
  destinationCountryId: z.string().cuid(),
}).refine((x) => x.originCountryId !== x.destinationCountryId, {
  message: "A virtual treaty must connect different countries.",
});
export const treatyApprovalSchema = z.strictObject({
  countryPlaceId: z.string().cuid(),
});

/** A rejection is not a public accusation; return neutral qualification checks. */
export interface DualCitizenshipAssessment {
  eligible: boolean;
  path: "FIRST_HOME" | "SECOND_CITIZENSHIP" | "ALREADY_CITIZEN" | "NOT_ELIGIBLE";
  checks: Array<{ code: string; label: string; met: boolean }>;
}
