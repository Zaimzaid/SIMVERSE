import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EarthPlaceSummary } from "@/lib/earth/types";
import { EarthQuickNavigation } from "./earth-quick-navigation";

const country = {
  id: "geo_0123456789abcdef01234567",
  kind: "COUNTRY",
  name: "Nigeria",
} as EarthPlaceSummary;

function render(countries: EarthPlaceSummary[]) {
  return renderToStaticMarkup(
    <EarthQuickNavigation
      countries={countries}
      hierarchy={[]}
      selected={null}
      states={[]}
      lgas={[]}
      cities={[]}
      zones={[]}
      busy={false}
      onChoosePlace={() => undefined}
      onChooseZone={() => undefined}
      onOpenDetails={() => undefined}
    />,
  );
}

describe("Earth map quick navigation", () => {
  it("starts collapsed and identifies the sole supported country", () => {
    const markup = render([country]);
    expect(markup).toContain("My Country");
    expect(markup).toContain("Nigeria");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('data-earth-quick-menu="expanded"');
  });

  it("does not assign a nationality when the catalog has multiple countries", () => {
    const markup = render([country, { ...country, id: "geo_111111111111111111111111", name: "Ghana" }]);
    expect(markup).toContain("Choose country");
    expect(markup).not.toContain("Nigeria");
  });

  it("does not make land ownership or purchasing claims in map mode", () => {
    const markup = render([country]);
    expect(markup).not.toContain("Owned plots");
    expect(markup).not.toContain("Buy now");
  });
});
