import { describe, expect, it } from "vitest";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION, BRAND_PREVIEW_NOTICE } from "./brand";

describe("KAVANDRO citizen-first public brand", () => {
  it("uses the approved master brand and product promise", () => {
    expect(BRAND_NAME).toBe("KAVANDRO");
    expect(BRAND_TAGLINE).toBe("Build Your Civilization");
    expect(BRAND_DESCRIPTION).toMatch(/fictional world/);
  });

  it("does not advertise unauthorized citizenship, money or live districts", () => {
    expect(BRAND_PREVIEW_NOTICE).toMatch(/not automatically active/);
    expect(BRAND_PREVIEW_NOTICE).toMatch(/independent approval/);
  });
});
