/**
 * SIMVERSE founding geography — proposed, unlocated planning slots only.
 *
 * This module is NOT the sovereign fictional country catalog, a player
 * citizenship authority or a source of published geographic boundaries.
 * It contains no invented coordinates and never writes to the database.
 * Actual countries require steward-reviewed published geometry using
 * FictionalCountry and FictionalCountryVersion.
 */

export const FOUNDING_PLAN_STATUS = "PROPOSAL_ONLY" as const;
export const PLANNED_CITIES_PER_STATE = 2;
export const PLANNED_DISTRICTS_PER_CITY = 3;

export type PlannedCountrySize = "SMALL" | "MEDIUM" | "LARGE";
export type PlannedDistrictStatus = "PILOT_CANDIDATE" | "EXPANSION_CANDIDATE" | "FUTURE_SLOT";

export interface FoundingCountryPlan {
  readonly slug: string;
  readonly name: string;
  readonly size: PlannedCountrySize;
  readonly plannedStates: number;
  /** Capital's name is agreed; state/city-slot placement has NOT been agreed. */
  readonly capital?: string;
  /** Team management is a proposal; this is not a country governance grant. */
  readonly proposedTeamManaged?: boolean;
}

export const FOUNDING_COUNTRIES: readonly FoundingCountryPlan[] = [
  { slug: "valdora", name: "Valdora", size: "MEDIUM", plannedStates: 4, capital: "Aven", proposedTeamManaged: true },
  { slug: "arandia", name: "Arandia", size: "LARGE", plannedStates: 5 },
  { slug: "novara", name: "Novara", size: "SMALL", plannedStates: 2 },
  { slug: "dravonia", name: "Dravonia", size: "LARGE", plannedStates: 6 },
  { slug: "marovia", name: "Marovia", size: "SMALL", plannedStates: 2 },
  { slug: "solandia", name: "Solandia", size: "MEDIUM", plannedStates: 4 },
  { slug: "vestria", name: "Vestria", size: "MEDIUM", plannedStates: 3 },
  { slug: "altavia", name: "Altavia", size: "MEDIUM", plannedStates: 4 },
  { slug: "eldoria", name: "Eldoria", size: "SMALL", plannedStates: 2 },
  { slug: "terranova", name: "Terranova", size: "LARGE", plannedStates: 6 },
] as const;

export interface PlannedDistrictSlot {
  readonly key: string;
  readonly label: string;
  readonly status: PlannedDistrictStatus;
}

export interface PlannedCitySlot {
  readonly key: string;
  readonly label: string;
  readonly districts: readonly PlannedDistrictSlot[];
}

export interface PlannedStateSlot {
  readonly key: string;
  readonly label: string;
  readonly cities: readonly PlannedCitySlot[];
}

/**
 * Planning keys do not confer jurisdiction, parcel rights or final stable
 * geographic IDs; a later reviewed migration must map them to real place IDs.
 */
export function getFoundingCountry(slug: string): FoundingCountryPlan | undefined {
  return FOUNDING_COUNTRIES.find((country) => country.slug === slug);
}

export function plannedCityCount(country: FoundingCountryPlan): number {
  return country.plannedStates * PLANNED_CITIES_PER_STATE;
}

export function plannedDistrictCount(country: FoundingCountryPlan): number {
  return plannedCityCount(country) * PLANNED_DISTRICTS_PER_CITY;
}

export function plannedDistrictStatus(
  countrySlug: string,
  stateNumber: number,
  cityNumber: number,
  districtNumber: number,
): PlannedDistrictStatus {
  // A proposed first pilot in Arandia followed by two expansion candidates.
  // Neither is an active district or a promise of actual placement.
  if (countrySlug === "arandia" && stateNumber === 1 && cityNumber === 1) {
    if (districtNumber === 1) return "PILOT_CANDIDATE";
    if (districtNumber === 2 || districtNumber === 3) return "EXPANSION_CANDIDATE";
  }
  return "FUTURE_SLOT";
}

export function plannedStateSlots(country: FoundingCountryPlan): PlannedStateSlot[] {
  return Array.from({ length: country.plannedStates }, (_, stateIndex) => {
    const stateNumber = stateIndex + 1;
    const stateKey = `${country.slug}-state-${String(stateNumber).padStart(2, "0")}`;
    return {
      key: stateKey,
      label: `State ${stateNumber} (name to be decided)`,
      cities: Array.from({ length: PLANNED_CITIES_PER_STATE }, (_, cityIndex) => {
        const cityNumber = cityIndex + 1;
        const cityKey = `${stateKey}-city-${String(cityNumber).padStart(2, "0")}`;
        return {
          key: cityKey,
          label: `City / town ${cityNumber} (name to be decided)`,
          districts: Array.from({ length: PLANNED_DISTRICTS_PER_CITY }, (_, districtIndex) => {
            const districtNumber = districtIndex + 1;
            return {
              key: `${cityKey}-district-${String(districtNumber).padStart(2, "0")}`,
              label: `District ${districtNumber}`,
              status: plannedDistrictStatus(country.slug, stateNumber, cityNumber, districtNumber),
            };
          }),
        };
      }),
    };
  });
}

export const FOUNDING_TOTALS = Object.freeze({
  continentsProposed: 5,
  countries: FOUNDING_COUNTRIES.length,
  states: FOUNDING_COUNTRIES.reduce((total, country) => total + country.plannedStates, 0),
  cities: FOUNDING_COUNTRIES.reduce((total, country) => total + plannedCityCount(country), 0),
  districts: FOUNDING_COUNTRIES.reduce((total, country) => total + plannedDistrictCount(country), 0),
});

/** Explicitly separates the design target from published planetary geography. */
export function foundingPlanPublicSummary() {
  return {
    status: FOUNDING_PLAN_STATUS,
    purpose: "Planning blueprint, not published fictional geography",
    totals: FOUNDING_TOTALS,
    countries: FOUNDING_COUNTRIES.map((country) => ({
      slug: country.slug,
      name: country.name,
      size: country.size,
      capital: country.capital ?? null,
      proposedTeamManaged: country.proposedTeamManaged === true,
      states: country.plannedStates,
      cities: plannedCityCount(country),
      districts: plannedDistrictCount(country),
    })),
  };
}
