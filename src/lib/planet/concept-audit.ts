import { CONCEPT_CONTINENTS } from "./concept-geography";
import { CONCEPT_COUNTRY_BOUNDARIES } from "./concept-country-boundaries";
import { FOUNDING_TOTALS } from "./founding-plan";
import { polygonsOverlap, validatePlanetGeometry } from "./geometry";
import { strictlyContainsConceptPolygon } from "./concept-topology";
import { CONCEPT_RESOURCE_SITES } from "./concept-terrain";

export const GEOGRAPHY_AUDIT_STATUS = "REVIEW_ONLY" as const;

export interface DraftCountryAudit {
  readonly slug: string;
  readonly name: string;
  readonly continentId: string;
  readonly draftAreaKm2: number;
  readonly sizeClass: string;
  readonly geometryValid: boolean;
  readonly strictlyWithinContinent: boolean;
  readonly overlapsAnotherCountry: boolean;
  readonly publicationAuthorized: false;
}

export interface DraftContinentAudit {
  readonly id: string;
  readonly name: string;
  readonly draftAreaKm2: number;
  readonly proposedCountryCount: number;
  readonly sumDraftCountryAreaKm2: number;
  /** Nominal unassigned fraction, not a complete geodetic land-cover analysis. */
  readonly nominalUnassignedPercent: number;
}

export function buildConceptGeographyAudit() {
  const countries: DraftCountryAudit[] = CONCEPT_COUNTRY_BOUNDARIES.map((country) => {
    const land = CONCEPT_CONTINENTS.find((continent) => continent.id === country.continentId);
    let valid = false;
    try {
      validatePlanetGeometry(country.geometry);
      valid = true;
    } catch {
      // Audits are non-mutating and report failures rather than publishing.
    }
    return {
      slug: country.slug,
      name: country.name,
      continentId: country.continentId,
      draftAreaKm2: country.areaKm2,
      sizeClass: country.size,
      geometryValid: valid,
      strictlyWithinContinent: Boolean(land
        && strictlyContainsConceptPolygon(land.geometry, country.geometry)),
      overlapsAnotherCountry: CONCEPT_COUNTRY_BOUNDARIES.some((other) =>
        other.slug !== country.slug && polygonsOverlap(country.geometry, other.geometry)),
      publicationAuthorized: false as const,
    };
  });

  const continents: DraftContinentAudit[] = CONCEPT_CONTINENTS.map((continent) => {
    const area = validatePlanetGeometry(continent.geometry).areaKm2;
    const included = countries.filter((country) => country.continentId === continent.id);
    const allocated = included.reduce((sum, country) => sum + country.draftAreaKm2, 0);
    return {
      id: continent.id,
      name: continent.label,
      draftAreaKm2: area,
      proposedCountryCount: included.length,
      sumDraftCountryAreaKm2: allocated,
      nominalUnassignedPercent: Number((100 * Math.max(0, area - allocated) / area).toFixed(1)),
    };
  });

  return {
    status: GEOGRAPHY_AUDIT_STATUS,
    conceptOnly: true,
    noDatabaseChanges: true,
    publishedCountryCount: null, // Only the real published-country API can answer this.
    pendingHumanDesignApproval: true,
    permanentGISApproval: false,
    reviewPassesConceptChecks: countries.every((country) =>
      country.geometryValid && country.strictlyWithinContinent && !country.overlapsAnotherCountry),
    foundingPlan: FOUNDING_TOTALS,
    resourceStudyMarkersUnassigned: CONCEPT_RESOURCE_SITES.length,
    countries,
    continents,
  };
}
