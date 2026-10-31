import type { PlanetGeometry, PlanetPoint } from "./geometry";
import { FOUNDING_COUNTRIES } from "./founding-plan";

/**
 * ORIGINAL fictional geography concept for visual discussion only.
 *
 * Neither country polygons nor continent shapes are official/published land.
 * All coordinates refer to the SIMVERSE planet-local system, not WGS84/Earth
 * or any physical location. Do not seed/create/publish countries from this.
 */
export const CONCEPT_MAP_STATUS = "UNAPPROVED_VISUAL_CONCEPT" as const;
export const CONCEPT_MAP_VERSION = "phase2b-landforms-v1" as const;

function closedRing(...points: PlanetPoint[]): PlanetPoint[] {
  return [...points, points[0]!];
}

export interface ConceptContinent {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly geometry: PlanetGeometry;
}

export const CONCEPT_CONTINENTS: readonly ConceptContinent[] = [
  {
    id: "continent-01", label: "Continent I", color: "#559f9d",
    geometry: { type: "Polygon", coordinates: [closedRing(
      [-160, 29], [-166, 43], [-153, 59], [-136, 66], [-120, 61],
      [-109, 70], [-86, 61], [-84, 44], [-94, 33], [-89, 23],
      [-112, 12], [-130, 19], [-150, 15],
    )] },
  },
  {
    id: "continent-02", label: "Continent II", color: "#c0a36e",
    geometry: { type: "Polygon", coordinates: [closedRing(
      [-137, -19], [-129, -7], [-103, -15], [-84, -22], [-65, -18],
      [-51, -30], [-70, -45], [-91, -55], [-111, -64],
      [-126, -49], [-123, -34],
    )] },
  },
  {
    id: "continent-03", label: "Continent III", color: "#8297c6",
    geometry: { type: "Polygon", coordinates: [closedRing(
      [-39, 28], [-45, 51], [-31, 67], [-12, 57], [7, 64],
      [30, 51], [37, 36], [23, 16], [13, 8], [-9, 19], [-29, 10],
    )] },
  },
  {
    id: "continent-04", label: "Continent IV", color: "#8fba85",
    geometry: { type: "Polygon", coordinates: [closedRing(
      [46, -15], [39, -5], [56, 7], [73, 0], [93, 6],
      [113, -8], [131, -25], [112, -34], [97, -55],
      [79, -47], [65, -62], [51, -47],
    )] },
  },
  {
    id: "continent-05", label: "Continent V", color: "#b89ac6",
    geometry: { type: "Polygon", coordinates: [closedRing(
      [103, 24], [112, 42], [127, 61], [147, 72], [171, 59],
      [163, 44], [171, 25], [152, 17], [136, 22], [120, 14],
    )] },
  },
];

export interface ConceptCountrySite {
  readonly slug: string;
  readonly continentId: string;
  readonly center: PlanetPoint;
}

/**
 * Markers are exploratory siting suggestions, never sovereign borders or
 * an approved capital/district location. Exactly one marker per country.
 */
export const CONCEPT_COUNTRY_SITES: readonly ConceptCountrySite[] = [
  { slug: "valdora", continentId: "continent-01", center: [-130, 43] },
  { slug: "arandia", continentId: "continent-01", center: [-106, 35] },
  { slug: "novara", continentId: "continent-02", center: [-112, -33] },
  { slug: "dravonia", continentId: "continent-02", center: [-88, -37] },
  { slug: "marovia", continentId: "continent-03", center: [-23, 41] },
  { slug: "solandia", continentId: "continent-03", center: [13, 39] },
  { slug: "vestria", continentId: "continent-04", center: [69, -30] },
  { slug: "altavia", continentId: "continent-04", center: [104, -22] },
  { slug: "eldoria", continentId: "continent-05", center: [125, 43] },
  { slug: "terranova", continentId: "continent-05", center: [151, 49] },
];

/** Only for concept display; does not query the published country catalog. */
export function conceptSiteName(site: ConceptCountrySite): string {
  return FOUNDING_COUNTRIES.find((country) => country.slug === site.slug)?.name ?? site.slug;
}

/** Planet-local longitude/latitude -> equirectangular SVG coordinates. */
export function conceptMapPoint(point: PlanetPoint): [number, number] {
  return [(point[0] + 180) / 360 * 1000, (90 - point[1]) / 180 * 500];
}

/** Each prototype continent is a single shell with no antimeridian crossing. */
export function conceptContinentPath(continent: ConceptContinent): string {
  if (continent.geometry.type !== "Polygon") throw new Error("Concept continent must be a polygon");
  return continent.geometry.coordinates[0]!
    .map((point, index) => {
      const [x, y] = conceptMapPoint(point);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

export function conceptPointInContinent(point: PlanetPoint, continent: ConceptContinent): boolean {
  if (continent.geometry.type !== "Polygon") return false;
  const ring = continent.geometry.coordinates[0]!;
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a[1] > point[1]) !== (b[1] > point[1])) {
      const x = (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0];
      if (point[0] < x) inside = !inside;
    }
  }
  return inside;
}
