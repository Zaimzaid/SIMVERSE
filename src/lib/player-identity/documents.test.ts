import { describe, expect, it } from "vitest";
import {
  documentApplicationSchema, documentReviewSchema, documentDisplayStatus,
  pilotDocumentExpiry, qualificationChecklist,
} from "./documents";

describe("virtual SIMVERSE document rules (not real-world nationality law)", () => {
  it("refuses unsupported types, citizenship grants and other privileged fields", () => {
    expect(documentApplicationSchema.safeParse({
      kind: "INTERNATIONAL_PASSPORT", countryPlaceId: "c0123456789abcdef01234567", status: "APPROVED",
    }).success).toBe(false);
    expect(documentApplicationSchema.safeParse({
      kind: "REAL_NIGERIAN_PASSPORT", countryPlaceId: "c0123456789abcdef01234567",
    }).success).toBe(false);
    expect(documentReviewSchema.safeParse({ decision: "APPROVE", note: "short" }).success).toBe(false);
  });

  it("requires approved virtual citizenship before either passport application", () => {
    const input = { kind: "INTERNATIONAL_PASSPORT" as const, hasUsername: true,
      homeCountryMatches: false, hasActiveVirtualCitizenship: false };
    expect(qualificationChecklist(input).some((x) => !x.satisfied)).toBe(true);
    expect(qualificationChecklist({ ...input, hasActiveVirtualCitizenship: true }).every((x) => x.satisfied))
      .toBe(true);
  });

  it("requires explicitly chosen home country for virtual citizenship, not residency", () => {
    const input = { hasUsername: true, homeCountryMatches: false, hasActiveVirtualCitizenship: false };
    expect(qualificationChecklist({ ...input, kind: "CITIZENSHIP" }).some((x) => !x.satisfied)).toBe(true);
    expect(qualificationChecklist({ ...input, kind: "RESIDENCY" }).every((x) => x.satisfied)).toBe(true);
  });

  it("derives expiration from dates rather than a stale stored status", () => {
    const issued = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = pilotDocumentExpiry(issued);
    expect(expiresAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(documentDisplayStatus({ status: "ISSUED", expiresAt }, issued)).toBe("VALID");
    expect(documentDisplayStatus({ status: "ISSUED", expiresAt }, expiresAt)).toBe("EXPIRED");
    expect(documentDisplayStatus({ status: "REVOKED", expiresAt }, issued)).toBe("REVOKED");
  });
});
