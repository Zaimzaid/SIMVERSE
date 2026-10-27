import { z } from "zod";

export const DOCUMENT_KINDS = [
  "CITIZENSHIP", "NATIONAL_PASSPORT", "INTERNATIONAL_PASSPORT", "RESIDENCY",
] as const;
export const DOCUMENT_REVIEW_DECISIONS = ["APPROVE", "DENY"] as const;
export type VirtualDocumentKind = typeof DOCUMENT_KINDS[number];

export const documentApplicationSchema = z.strictObject({
  kind: z.enum(DOCUMENT_KINDS),
  countryPlaceId: z.string().cuid(),
  statement: z.string().trim().max(500).default(""),
});
export const documentReviewSchema = z.strictObject({
  decision: z.enum(DOCUMENT_REVIEW_DECISIONS),
  note: z.string().trim().min(10).max(500),
});

/** Document type requirements in the SIMVERSE fictional pilot policy.
 * These are NOT real immigration laws and do not purport to reflect a
 * government's passport/visa/nationality eligibility requirements.
 */
export function qualificationChecklist(input: {
  kind: VirtualDocumentKind;
  hasUsername: boolean;
  homeCountryMatches: boolean;
  hasActiveVirtualCitizenship: boolean;
}): Array<{ id: string; description: string; satisfied: boolean }> {
  const checks = [
    { id: "identity", description: "Registered SIMVERSE username", satisfied: input.hasUsername },
  ];
  if (input.kind === "CITIZENSHIP") {
    checks.push({
      id: "home",
      description: "Chosen SIMVERSE home country matches the application country",
      satisfied: input.homeCountryMatches,
    });
  }
  if (input.kind === "NATIONAL_PASSPORT" || input.kind === "INTERNATIONAL_PASSPORT") {
    checks.push({
      id: "citizenship",
      description: "Approved active SIMVERSE virtual citizenship in the application country",
      satisfied: input.hasActiveVirtualCitizenship,
    });
  }
  return checks;
}

/** A simple fictional pilot validity; not based on any actual national law. */
export function pilotDocumentExpiry(issuedAt: Date): Date {
  const expiry = new Date(issuedAt);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return expiry;
}

export function documentDisplayStatus(
  doc: { status: string; expiresAt: Date }, now: Date = new Date(),
): "VALID" | "EXPIRED" | "REVOKED" {
  if (doc.status === "REVOKED") return "REVOKED";
  return doc.expiresAt.getTime() > now.getTime() ? "VALID" : "EXPIRED";
}
