import { describe, expect, it } from "vitest";
import { buildConceptGeographyAudit, GEOGRAPHY_AUDIT_STATUS } from "./concept-audit";

describe("read-only founding country geometry readiness", () => {
  it("reports ten proposed countries, five landmasses and the founding hierarchy", () => {
    const audit = buildConceptGeographyAudit();
    expect(GEOGRAPHY_AUDIT_STATUS).toBe("REVIEW_ONLY");
    expect(audit.countries).toHaveLength(10);
    expect(audit.continents).toHaveLength(5);
    expect(audit.foundingPlan).toEqual({
      continentsProposed: 5, countries: 10, states: 38, cities: 76, districts: 228,
    });
    expect(audit.resourceStudyMarkersUnassigned).toBe(10);
    expect(audit.continents.reduce((sum, continent) => sum + continent.proposedCountryCount, 0)).toBe(10);
  });

  it("records geometry validity, actual strict coastline containment and no national overlaps", () => {
    const audit = buildConceptGeographyAudit();
    expect(audit.reviewPassesConceptChecks).toBe(true);
    for (const country of audit.countries) {
      expect(country.geometryValid).toBe(true);
      expect(country.strictlyWithinContinent).toBe(true);
      expect(country.overlapsAnotherCountry).toBe(false);
      expect(country.draftAreaKm2).toBeGreaterThan(0);
    }
    for (const continent of audit.continents) {
      expect(continent.draftAreaKm2).toBeGreaterThan(continent.sumDraftCountryAreaKm2);
      expect(continent.nominalUnassignedPercent).toBeGreaterThan(0);
      expect(continent.nominalUnassignedPercent).toBeLessThan(100);
    }
  });

  it("never asserts publication, GIS readiness, administrative rights or resource allocation", () => {
    const audit = buildConceptGeographyAudit();
    expect(audit.status).toBe("REVIEW_ONLY");
    expect(audit.conceptOnly).toBe(true);
    expect(audit.publishedCountryCount).toBeNull();
    expect(audit.pendingHumanDesignApproval).toBe(true);
    expect(audit.permanentGISApproval).toBe(false);
    expect(audit.countries.every((country) => !country.publicationAuthorized)).toBe(true);
  });
});
