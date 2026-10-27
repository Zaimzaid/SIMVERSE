import { describe, expect, it } from "vitest";
import { parseGeoNamesSettlementLine, selectGeoNamesSettlements } from "./settlements";

function geonamesLine(id: number, name: string, population: number, latitude = 6.5, code = "PPL") {
  const fields = [
    String(id), name, name, "", String(latitude), "3.4", "P", code, "NG", "", "05",
    "", "", "", String(population), "", "", "Africa/Lagos", "2025-01-01",
  ];
  return fields.join("\t");
}

describe("GeoNames city/town catalog preparation", () => {
  it("parses documented source fields and keeps all geometry point-only", () => {
    const city = parseGeoNamesSettlementLine(geonamesLine(20, "Demo City", 200000))!;
    expect(city).toMatchObject({
      geonameId: "20", name: "Demo City", kind: "CITY",
      longitude: 3.4, latitude: 6.5,
    });
    expect(parseGeoNamesSettlementLine(geonamesLine(21, "Small Town", 1200))?.kind).toBe("TOWN");
    expect(parseGeoNamesSettlementLine(geonamesLine(22, "District", 5, 6.5, "PPLX"))?.kind).toBe("LOCALITY");
  });

  it("accepts only Nigerian populated places", () => {
    const fields = geonamesLine(10, "Lake", 5000).split("\t");
    fields[6] = "H";
    expect(parseGeoNamesSettlementLine(fields.join("\t"))).toBeNull();
    fields[6] = "P"; fields[8] = "GH";
    expect(parseGeoNamesSettlementLine(fields.join("\t"))).toBeNull();
  });

  it("selects only interior source points, sorted deterministically and capped", () => {
    const records = [
      geonamesLine(4, "Outside", 900000, 11.2),
      geonamesLine(2, "Market Town", 1000),
      geonamesLine(1, "Major City", 250000),
    ].join("\n");
    const first = selectGeoNamesSettlements(records, ([, lat]) => lat < 7, 2);
    expect(first.map((item) => item.name)).toEqual(["Major City", "Market Town"]);
    expect(selectGeoNamesSettlements(records, ([, lat]) => lat < 7, 2)).toEqual(first);
  });

  it("rejects invalid and duplicate source identifiers", () => {
    const line = geonamesLine(10, "Valid", 100);
    expect(() => selectGeoNamesSettlements(line + "\n" + line, () => true)).toThrow(/Duplicate/);
    expect(() => parseGeoNamesSettlementLine("broken")).toThrow(/19/);
  });
});
