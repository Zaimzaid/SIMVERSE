import { z } from "zod";
import { foundingNationSlugs, foundingNationName } from "./phase3-contract";

/**
 * Prepares a private request for possible future citizenship. No submission,
 * reviewer action, citizenship credential, residence or legal rights exist.
 */
export const foundingApplicationDraftSchema = z.strictObject({
  targetNationSlug: z.enum(foundingNationSlugs),
  motivation: z.string().trim().max(750).default(""),
});

export const FOUNDING_APPLICATION_STAGE = "DRAFT_ONLY" as const;

export function describeFoundingApplicationDraft(nationSlug: string, motivation: string, updatedAt: Date) {
  return {
    status: FOUNDING_APPLICATION_STAGE,
    targetNationSlug: nationSlug,
    targetNationName: foundingNationName(nationSlug),
    motivation,
    updatedAt,
    submitted: false,
    approved: false,
    reviewerAssigned: false,
    citizenshipGranted: false,
    statement: "A private preparation draft. Official applications and reviews are not open.",
  };
}
