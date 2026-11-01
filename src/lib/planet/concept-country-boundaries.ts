import { FOUNDING_COUNTRIES, type PlannedCountrySize } from "./founding-plan";
import { CONCEPT_CONTINENTS, CONCEPT_COUNTRY_SITES, conceptMapPoint } from "./concept-geography";
import { validatePlanetGeometry, type PlanetGeometry, type PlanetPoint } from "./geometry";
import { strictlyContainsConceptPolygon } from "./concept-topology";

/**
 * Unpublished, completely reversible national boundary sketches.
 * This is NOT the FictionalCountry database or a seed/publish operation.
 * A steward must independently review and validate any country publication.
 */
export const COUNTRY_BOUNDARY_SKETCH_STATUS = "UNAPPROVED_BOUNDARY_SKETCH" as const;

export interface ConceptCountryBoundary {
  readonly slug: string;
  readonly name: string;
  readonly continentId: string;
  readonly size: PlannedCountrySize;
  readonly color: string;
  readonly geometry: PlanetGeometry;
  readonly areaKm2: number;
  readonly center: PlanetPoint;
}

const COLORS = [
  "#37b5bc", "#f5ad7a", "#ebce78", "#b57ad9", "#a6d391",
  "#86afe5", "#f0a4b8", "#f4cb69", "#95d0c4", "#ba9bec",
] as const;

function radii(size: PlannedCountrySize): [number, number] {
  if (size === "LARGE") return [8.7, 8.1];
  if (size === "MEDIUM") return [7, 6.7];
  return [5.2, 5];
}

/**
 * Hand-tuned bounded deterministic first drafts around exploratory sites.
 * Ten different outlines are formed with polar perturbations. This is not
 * a simulated geology model or official administrative demarcation.
 */
function originalOutline(center: PlanetPoint, size: PlannedCountrySize, seed: number): PlanetGeometry {
  const [radiusLongitude, radiusLatitude] = radii(size);
  const phase = 0.17 + seed * 0.13;
  const points: PlanetPoint[] = Array.from({ length: 12 }, (_, index) => {
    const theta = (2 * Math.PI * index / 12) + phase;
    const variation = 0.88
      + 0.12 * Math.sin(index * 1.92 + seed * 0.6)
      + 0.05 * Math.cos(index * 2.8 + seed);
    return [
      Number((center[0] + radiusLongitude * variation * Math.cos(theta)).toFixed(6)),
      Number((center[1] + radiusLatitude * variation * Math.sin(theta)).toFixed(6)),
    ];
  });
  return { type: "Polygon", coordinates: [[...points, points[0]!] ] };
}

export const CONCEPT_COUNTRY_BOUNDARIES: readonly ConceptCountryBoundary[] =
  CONCEPT_COUNTRY_SITES.map((site, index) => {
    const plan = FOUNDING_COUNTRIES.find((country) => country.slug === site.slug);
    if (!plan) throw new Error(`No founding plan for ${site.slug}`);
    const geometry = originalOutline(site.center, plan.size, index);
    const { areaKm2 } = validatePlanetGeometry(geometry);
    return {
      slug: site.slug,
      name: plan.name,
      continentId: site.continentId,
      size: plan.size,
      color: COLORS[index]!,
      geometry,
      areaKm2,
      center: site.center,
    };
  });

export function countryBoundaryPath(country: ConceptCountryBoundary): string {
  if (country.geometry.type !== "Polygon") throw new Error("The draft country is not a polygon");
  return country.geometry.coordinates[0]!
    .map((point, index) => {
      const [x, y] = conceptMapPoint(point);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

/**
 * Full edge/vertex check for our non-wrapping, hole-free concept polygons.
 * Still NOT formal spherical containment or sovereign publication approval.
 */
export function conceptBoundaryWithinContinent(country: ConceptCountryBoundary): boolean {
  const continent = CONCEPT_CONTINENTS.find((land) => land.id === country.continentId);
  return continent
    ? strictlyContainsConceptPolygon(continent.geometry, country.geometry)
    : false;
}
