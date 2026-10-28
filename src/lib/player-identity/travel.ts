import { z } from "zod";
import { documentDisplayStatus } from "./documents";

/**
 * Simulation-only country policy. No legal claims, real migration data,
 * real-life travel permission, or automatic cross-border movement.
 */
export const TRAVEL_ROUTE_MODES = ["CLOSED", "VISA_REQUIRED", "VISA_WAIVER"] as const;
export const virtualTravelQuerySchema = z.strictObject({
  originCountryId: z.string().cuid(),
  destinationCountryId: z.string().cuid(),
});
export const virtualVisaApplicationSchema = virtualTravelQuerySchema.extend({
  purpose: z.string().trim().max(500).default(""),
});
export const virtualVisaDecisionSchema = z.strictObject({
  decision: z.enum(["APPROVE", "DENY"]),
  note: z.string().trim().min(10).max(500),
});
export type TravelMode = typeof TRAVEL_ROUTE_MODES[number];

export interface TravelEvidence {
  domestic: boolean;
  routeEnabled: boolean;
  mode: TravelMode | null;
  activeOriginCitizenship: boolean;
  activeDestinationCitizenship: boolean;
  activeDestinationResidence: boolean;
  validPassport: boolean;
  validVisa: boolean;
}
export interface TravelCheck {
  code: string;
  label: string;
  met: boolean;
}
export interface TravelVerdict {
  status: "ELIGIBLE" | "MISSING_REQUIREMENTS" | "UNAVAILABLE";
  checks: TravelCheck[];
  notice: string;
}

export const VIRTUAL_TRAVEL_NOTICE =
  "SIMVERSE virtual travel simulation only. These rules do not authorize real travel, nationality, entry, immigration or border crossing.";

/** All cross-country travel fails closed until a route is explicitly configured. */
export function evaluateVirtualTravel(input: TravelEvidence): TravelVerdict {
  const checks: TravelCheck[] = [];
  if (input.domestic) {
    checks.push({
      code: "domestic_residency",
      label: "Active virtual citizenship or valid residency for this domestic destination",
      met: input.activeDestinationCitizenship || input.activeDestinationResidence,
    });
    return {
      status: checks.every((c) => c.met) ? "ELIGIBLE" : "MISSING_REQUIREMENTS",
      checks, notice: VIRTUAL_TRAVEL_NOTICE,
    };
  }
  if (!input.routeEnabled || !input.mode || input.mode === "CLOSED") {
    return {
      status: "UNAVAILABLE",
      checks: [{ code: "route", label: "A reviewed SIMVERSE travel route must be active", met: false }],
      notice: VIRTUAL_TRAVEL_NOTICE,
    };
  }
  checks.push({
    code: "citizenship",
    label: "Active virtual citizenship in your travel origin country",
    met: input.activeOriginCitizenship,
  });
  checks.push({
    code: "passport",
    label: "Valid, issued SIMVERSE passport required by the route",
    met: input.validPassport,
  });
  if (input.mode === "VISA_REQUIRED") {
    checks.push({
      code: "visa",
      label: "Approved, unexpired SIMVERSE virtual entry visa for the destination",
      met: input.validVisa,
    });
  }
  return {
    status: checks.every((c) => c.met) ? "ELIGIBLE" : "MISSING_REQUIREMENTS",
    checks, notice: VIRTUAL_TRAVEL_NOTICE,
  };
}

export function isVirtualCredentialValid(
  document: { status: string; expiresAt: Date } | null,
  now: Date = new Date(),
): boolean {
  return document !== null && documentDisplayStatus(document, now) === "VALID";
}

/** Pilot entry visa lasts 90 days; not based on real-world government rules. */
export function pilotVisaExpiry(issued: Date): Date {
  return new Date(issued.getTime() + 90 * 24 * 60 * 60 * 1000);
}
