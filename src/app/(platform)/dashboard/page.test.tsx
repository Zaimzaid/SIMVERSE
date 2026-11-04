// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/server/context", () => ({
  requirePlatformContext: async () => ({
    user: { id: "test", displayName: "A Citizen" },
    permissions: [] as string[],
  }),
}));

import DashboardPage from "./page";

describe("KAVANDRO citizen dashboard", () => {
  it("links to implemented features instead of marking them all Planned", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Welcome to KAVANDRO");
    expect(html).toContain("Civilization tools you can open");
    expect(html).toContain('href="/profile/civilization/assembly"');
    expect(html).toContain('href="/profile/civilization/vascoin"');
    expect(html).toContain('href="/profile/civilization/club"');
    expect(html).toContain('href="/profile/civilization/development"');
    expect(html).toContain('href="/profile/civilization/land"');
    expect(html).toContain('href="/profile/civilization/challenge"');
    expect(html).toContain("Built · District required");
    expect(html).toContain("Playable now");
    expect(html).not.toContain(">Planned<");
  });
});
