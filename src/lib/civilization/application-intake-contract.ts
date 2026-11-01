import { z } from "zod";

export const FOUNDING_APPLICATION_REVIEW_STATUS = ["PENDING_REVIEW", "DENIED", "WITHDRAWN"] as const;

export const denyFoundingApplicationSchema = z.strictObject({
  applicationId: z.string().regex(/^[a-z0-9]{20,40}$/i),
  reviewNote: z.string().trim().min(8).max(500),
});

export type FoundingApplicationReadiness = {
  stage: "NO_DRAFT" | "NOT_PUBLISHED" | "ACCOUNT_INCOMPLETE" | "INTAKE_CLOSED" | "READY_TO_SUBMIT" | "ALREADY_SUBMITTED";
  countryName: string | null;
  countryId: string | null;
  publishedRevision: number | null;
  checks: Array<{ key: string; label: string; met: boolean }>;
  canSubmit: boolean;
  // No actual citizenship issuance function or grant is present in this phase.
  citizenshipGranted: false;
};
