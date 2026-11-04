// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Logo, BrandMark } from "./logo";
import { BrandSplash } from "./brand-splash";
import { SiteHeader } from "@/components/marketing/site-header";
import manifest from "@/app/manifest";

describe("Official KAVANDRO UI identity", () => {
  it("uses approved geometric logo assets on light and dark themes instead of the legacy orbital mark", () => {
    const html = renderToStaticMarkup(<Logo asStatic size="lg" />);
    expect(html).toContain('aria-label="KAVANDRO"');
    expect(html).toContain("/brand/kavandro-logo-dark.svg");
    expect(html).toContain("/brand/kavandro-logo-light.svg");
    expect(html).not.toContain("<ellipse");
    const lightSvg = readFileSync(join(process.cwd(), "public/brand/kavandro-logo-light.svg"), "utf8");
    const darkSvg = readFileSync(join(process.cwd(), "public/brand/kavandro-logo-dark.svg"), "utf8");
    for (const svg of [lightSvg, darkSvg]) {
      expect(svg).toContain('viewBox="0 0 1800 320"');
      expect(svg).toContain('id="swoosh"');
      expect(svg).toContain('aria-label="KAVANDRO official logo"');
    }
  });

  it("retains an accessible home link and shows the real logo in public navigation", () => {
    const html = renderToStaticMarkup(<SiteHeader authed={false} simple />);
    expect(html).toContain('aria-label="KAVANDRO home"');
    expect(html).toContain("/brand/kavandro-logo-light.svg");
    expect(html).toContain("Log in");
    expect(html).toContain("Join now");
    expect(html).not.toContain('aria-label="SIMVERSE home"');
  });

  it("renders a real K emblem with accessible loading text and no fabricated progress percentage", () => {
    const html = renderToStaticMarkup(<BrandSplash label="Opening your civilization…" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Opening your civilization');
    expect(html).toContain("Build Your Civilization");
    expect(html).toContain("/brand/kavandro-mark-light.svg");
    expect(html).toContain("kavandro-splash-orbit");
    expect(html).not.toContain("100%");
    const compact = renderToStaticMarkup(<BrandMark className="size-8" animated />);
    expect(compact).toContain("kavandro-mark-float");
  });

  it("advertises the KAVANDRO name and emblem in installable metadata", () => {
    const data = manifest();
    expect(data.short_name).toBe("KAVANDRO");
    expect(data.name).toContain("Build Your Civilization");
    expect(data.icons?.[0]?.src).toBe("/icon.svg");
    const icon = readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8");
    expect(icon).toContain('aria-label="KAVANDRO"');
    expect(icon).not.toContain("<ellipse");
  });
});
