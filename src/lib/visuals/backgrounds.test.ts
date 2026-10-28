import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const art = [
  "simverse-city-night.svg",
  "simverse-city-day.svg",
  "simverse-world-atlas.svg",
  "simverse-creator-grid.svg",
  "simverse-identity-cards.svg",
] as const;

describe("SIMVERSE illustrated backgrounds", () => {
  it.each(art)("%s is a local, valid SVG-shaped resource without external fetches", (filename) => {
    const path = join(process.cwd(), "public", "backgrounds", filename);
    const image = readFileSync(path, "utf8");
    expect(image).toMatch(/^<svg\s/);
    expect(image).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(image).toContain('viewBox="0 0 1920 1080"');
    expect(image.trimEnd().endsWith("</svg>")).toBe(true);
    expect(image).not.toMatch(/<script|<foreignObject|href="https?:|url\(https?:|data:application/i);
    // Lightweight enough to remain useful for a low-performance laptop.
    expect(statSync(path).size).toBeLessThan(100_000);
  });
  it("applies separate day and night images and keeps page scene artwork local", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    for (const filename of art) expect(css).toContain(filename);
    expect(css).toContain('[data-theme="light"] .simverse-home-hero');
    expect(css).toContain('.simverse-page-scene');
    expect(css).toContain('.simverse-scene-backdrop');
  });
});
