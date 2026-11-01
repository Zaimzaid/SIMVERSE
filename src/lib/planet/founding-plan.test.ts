import { describe, expect, it } from "vitest";
import {
  FOUNDING_COUNTRIES, FOUNDING_PLAN_STATUS, FOUNDING_TOTALS,
  foundingPlanPublicSummary, getFoundingCountry,
  plannedCityCount, plannedDistrictCount, plannedStateSlots,
} from "./founding-plan";

describe("SIMVERSE founding geography proposal", () => {
  it("preserves the agreed ten founding names and provisional 38/76/228 structure", () => {
    expect(FOUNDING_COUNTRIES.map((c) => c.name)).toEqual([
      "Valdora", "Arandia", "Novara", "Dravonia", "Marovia",
      "Solandia", "Vestria", "Altavia", "Eldoria", "Terranova",
    ]);
    expect(FOUNDING_TOTALS).toEqual({
      continentsProposed: 5,
      countries: 10,
      states: 38,
      cities: 76,
      districts: 228,
    });
    expect(getFoundingCountry("valdora")?.capital).toBe("Aven");
    expect(getFoundingCountry("not-a-country")).toBeUndefined();
  });

  it("expands each state into two cities and each city into three planned districts", () => {
    const keys = new Set<string>();
    let districtCount = 0;
    for (const country of FOUNDING_COUNTRIES) {
      const states = plannedStateSlots(country);
      expect(states).toHaveLength(country.plannedStates);
      expect(plannedCityCount(country)).toBe(country.plannedStates * 2);
      expect(plannedDistrictCount(country)).toBe(country.plannedStates * 6);
      for (const state of states) {
        expect(state.cities).toHaveLength(2);
        for (const city of state.cities) {
          expect(city.districts).toHaveLength(3);
          for (const district of city.districts) {
            expect(keys.has(district.key)).toBe(false);
            keys.add(district.key);
            districtCount += 1;
          }
        }
      }
    }
    expect(districtCount).toBe(228);
  });

  it("marks one pilot and two expansion candidates without claiming active districts", () => {
    const statuses = FOUNDING_COUNTRIES.flatMap((country) =>
      plannedStateSlots(country).flatMap((state) =>
        state.cities.flatMap((city) => city.districts.map((district) => district.status)),
      ),
    );
    expect(statuses.filter((status) => status === "PILOT_CANDIDATE")).toHaveLength(1);
    expect(statuses.filter((status) => status === "EXPANSION_CANDIDATE")).toHaveLength(2);
    expect(statuses.filter((status) => status === "FUTURE_SLOT")).toHaveLength(225);
    expect(statuses).not.toContain("ACTIVE");
  });

  it("discloses that the blueprint is not published geography or property rights", () => {
    const publicPlan = foundingPlanPublicSummary();
    expect(FOUNDING_PLAN_STATUS).toBe("PROPOSAL_ONLY");
    expect(publicPlan.status).toBe("PROPOSAL_ONLY");
    expect(publicPlan.purpose).toContain("not published");
    expect(publicPlan.countries).toHaveLength(10);
    for (const country of publicPlan.countries) {
      expect(country).not.toHaveProperty("geometry");
      expect(country).not.toHaveProperty("ownerId");
    }
  });
});
