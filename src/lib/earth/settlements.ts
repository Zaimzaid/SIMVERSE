/**
 * GeoNames NG.txt records are UTF-8, tab-separated, with documented 19 fields.
 * They are geographic name *points*; never treat them as surveyed city limits.
 *
 * Column reference: https://download.geonames.org/export/dump/readme.txt
 */
export type SettlementKind = "CITY" | "TOWN" | "LOCALITY";

export interface GeoNamesSettlement {
  geonameId: string;
  name: string;
  latitude: number;
  longitude: number;
  featureCode: string;
  population: number;
  admin1Code: string;
  modifiedDate: string;
  kind: SettlementKind;
}

const ELIGIBLE_CODES = new Set([
  "PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC", "PPLX",
]);

export function parseGeoNamesSettlementLine(line: string): GeoNamesSettlement | null {
  const parts = line.split("\t");
  if (parts.length < 19) throw new Error("Invalid GeoNames record: 19 tab-separated fields required.");
  const [id, name, , , latitudeText, longitudeText, featureClass, featureCode,
    country, , admin1, , , , populationText, , , , modifiedDate] = parts;
  if (country !== "NG" || featureClass !== "P" || !ELIGIBLE_CODES.has(featureCode)) {
    return null;
  }
  if (!/^\d+$/.test(id) || !name?.trim()
    || !/^\d{4}-\d{2}-\d{2}$/.test(modifiedDate)) {
    throw new Error("Invalid GeoNames settlement identity or modification date.");
  }
  const latitude = Number(latitudeText), longitude = Number(longitudeText);
  const population = populationText === "" ? 0 : Number(populationText);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || !Number.isSafeInteger(population) || population < 0) {
    throw new Error("Invalid GeoNames settlement coordinates or population.");
  }
  const kind: SettlementKind = featureCode === "PPLX" ? "LOCALITY"
    : featureCode === "PPLC" || featureCode === "PPLA" || population >= 100_000
      ? "CITY" : "TOWN";
  return {
    geonameId: id, name: name.trim(), latitude, longitude, featureCode,
    population, admin1Code: admin1 ?? "", modifiedDate, kind,
  };
}

/**
 * Deterministic pilot selection by population, then name and stable identity.
 * Only source-defined points; classification is an internal display heuristic.
 */
export function selectGeoNamesSettlements(
  content: string,
  containsStatePoint: (point: [number, number]) => boolean,
  limit = 80,
): GeoNamesSettlement[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Settlement pilot limit must be from 1 to 100.");
  }
  const selected = new Map<string, GeoNamesSettlement>();
  for (const line of content.split(/\r?\n/)) {
    if (!line) continue;
    const item = parseGeoNamesSettlementLine(line);
    if (!item || !containsStatePoint([item.longitude, item.latitude])) continue;
    if (selected.has(item.geonameId)) throw new Error("Duplicate GeoNames settlement identifier.");
    selected.set(item.geonameId, item);
  }
  return [...selected.values()].sort((a, b) =>
    b.population - a.population || a.name.localeCompare(b.name, "en")
    || a.geonameId.localeCompare(b.geonameId)).slice(0, limit);
}
