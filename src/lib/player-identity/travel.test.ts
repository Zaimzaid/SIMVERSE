import { describe, expect, it } from "vitest";
import {
  evaluateVirtualTravel, isVirtualCredentialValid, pilotVisaExpiry,
  virtualTravelQuerySchema, virtualVisaApplicationSchema,
} from "./travel";

const base = {
  domestic: false, routeEnabled: false, mode: null,
  activeOriginCitizenship: true, activeDestinationCitizenship: false,
  activeDestinationResidence: false, validPassport: true, validVisa: true,
} as const;
describe("fictional SIMVERSE entry eligibility rules", () => {
  it("fails closed without a configured active route", () => {
    expect(evaluateVirtualTravel(base).status).toBe("UNAVAILABLE");
    expect(evaluateVirtualTravel({ ...base, routeEnabled: true, mode: "CLOSED" }).status)
      .toBe("UNAVAILABLE");
  });
  it("requires both a citizenship-backed passport and visa when policy requires one", () => {
    const input = { ...base, routeEnabled: true, mode: "VISA_REQUIRED" as const };
    expect(evaluateVirtualTravel(input).status).toBe("ELIGIBLE");
    expect(evaluateVirtualTravel({ ...input, validPassport: false }).status).toBe("MISSING_REQUIREMENTS");
    expect(evaluateVirtualTravel({ ...input, validVisa: false }).status).toBe("MISSING_REQUIREMENTS");
    expect(evaluateVirtualTravel({ ...input, activeOriginCitizenship: false }).status)
      .toBe("MISSING_REQUIREMENTS");
  });
  it("waives only the fictional visa, not origin citizenship or passport", () => {
    const input = { ...base, routeEnabled: true, mode: "VISA_WAIVER" as const, validVisa: false };
    const evaluation = evaluateVirtualTravel(input);
    expect(evaluation.status).toBe("ELIGIBLE");
    expect(evaluation.checks.some((item) => item.code === "visa")).toBe(false);
    expect(evaluateVirtualTravel({ ...input, validPassport: false }).status).toBe("MISSING_REQUIREMENTS");
  });
  it("domestic movement requires citizenship or a valid residence credential", () => {
    expect(evaluateVirtualTravel({ ...base, domestic: true, validPassport: false,
      activeOriginCitizenship: false, activeDestinationCitizenship: false, validVisa: false,
    }).status).toBe("MISSING_REQUIREMENTS");
    expect(evaluateVirtualTravel({ ...base, domestic: true, routeEnabled: false,
      activeDestinationCitizenship: true, validPassport: false, validVisa: false,
    }).status).toBe("ELIGIBLE");
    expect(evaluateVirtualTravel({ ...base, domestic: true, routeEnabled: false,
      activeDestinationResidence: true, activeOriginCitizenship: false,
      validPassport: false, validVisa: false,
    }).status).toBe("ELIGIBLE");
  });
  it("derives visa expiry and rejects invalid request inputs", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    const expiry = pilotVisaExpiry(now);
    expect((expiry.getTime() - now.getTime()) / 86400000).toBe(90);
    expect(isVirtualCredentialValid({ status: "ISSUED", expiresAt: expiry }, now)).toBe(true);
    expect(isVirtualCredentialValid({ status: "REVOKED", expiresAt: expiry }, now)).toBe(false);
    expect(isVirtualCredentialValid({ status: "ISSUED", expiresAt: now }, now)).toBe(false);
    expect(virtualTravelQuerySchema.safeParse({
      originCountryId: "hello", destinationCountryId: "fake",
    }).success).toBe(false);
    expect(virtualVisaApplicationSchema.safeParse({
      originCountryId: "c0123456789abcdef01234567", destinationCountryId: "c0123456789abcdef01234567",
      isApproved: true,
    }).success).toBe(false);
  });
});
