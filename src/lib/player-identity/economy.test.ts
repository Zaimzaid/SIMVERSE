import { describe, expect, it } from "vitest";
import {
  SIMVERSE_PROFESSIONS, businessDraftSchema, getProfession,
  normalizedBusinessName, selectedProfessionSchema,
} from "./economy";

describe("SIMVERSE fictional economy onboarding policy", () => {
  it("uses a small closed profession catalog with noncash positive allocations", () => {
    expect(SIMVERSE_PROFESSIONS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(SIMVERSE_PROFESSIONS.map((p) => p.code)).size).toBe(SIMVERSE_PROFESSIONS.length);
    expect(SIMVERSE_PROFESSIONS.every((p) => Number.isInteger(p.startingCredits)
      && p.startingCredits > 0 && p.startingCredits <= 2000)).toBe(true);
    expect(getProfession("AGRICULTURE")?.startingCredits).toBe(850);
    expect(getProfession("NOT_REAL")).toBeNull();
  });

  it("rejects privilege escalation, arbitrary credit amounts and unknown professions", () => {
    expect(selectedProfessionSchema.safeParse({ professionCode: "AGRICULTURE" }).success).toBe(true);
    expect(selectedProfessionSchema.safeParse({ professionCode: "PRESIDENT" }).success).toBe(false);
    expect(selectedProfessionSchema.safeParse({ professionCode: "COMMERCE", startingCredits: 500000 }).success).toBe(false);
    expect(selectedProfessionSchema.safeParse({ professionCode: "HEALTH", grantsMedicalLicense: true }).success).toBe(false);
  });

  it("accepts simple fictional company names without trusting granted statuses", () => {
    expect(normalizedBusinessName("  Marina   Studios  ")).toBe("marina studios");
    expect(businessDraftSchema.safeParse({ name: "Marina Studios", sector: "CREATIVE" }).success).toBe(true);
    expect(businessDraftSchema.safeParse({
      name: "Marina Studios", sector: "HEALTH", status: "APPROVED",
    }).success).toBe(false);
    expect(businessDraftSchema.safeParse({
      name: "Marina Studios", sector: "INVALID_INDUSTRY",
    }).success).toBe(false);
    expect(businessDraftSchema.safeParse({ name: "<script>", sector: "CREATIVE" }).success).toBe(false);
  });
});
