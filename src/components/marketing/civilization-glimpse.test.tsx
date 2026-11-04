// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { CivilizationGlimpse } from "./civilization-glimpse";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Minimal pre-login KAVANDRO preview", () => {
  it("renders a small honest preview with three accessible choices and no fake live activity", () => {
    const html = renderToStaticMarkup(<CivilizationGlimpse />);
    expect(html).toContain("A glimpse of what is coming");
    expect(html).toContain('aria-label="Choose what to discover"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Explore");
    expect(html).toContain("Connect");
    expect(html).toContain("Shape");
    expect(html).toContain("Planet preview available");
    expect(html).toContain("Discover a new world");
    expect(html).not.toContain("Live district elections");
  });

  it("switches between the three brief explanations without navigating or submitting data", async () => {
    await act(async () => root.render(<CivilizationGlimpse />));
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons).toHaveLength(3);

    await act(async () => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(host.textContent).toContain("Find your community");
    expect(host.textContent).toContain("District communities in development");
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      buttons[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(host.textContent).toContain("Help it grow");
    expect(host.textContent).toContain("Citizen-led development is planned");
    expect(buttons[2]?.getAttribute("aria-pressed")).toBe("true");
  });
});
