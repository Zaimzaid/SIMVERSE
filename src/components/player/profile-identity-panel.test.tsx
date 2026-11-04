// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EditablePlayerIdentity } from "./player-identity-form";

vi.mock("./player-identity-form", () => ({
  PlayerIdentityForm: ({ hideProfilePreview }: { hideProfilePreview?: boolean }) =>
    <div data-hide-duplicate-profile={String(Boolean(hideProfilePreview))}>Edit fields</div>,
}));

import { ProfileIdentityPanel } from "./profile-identity-panel";
const base: EditablePlayerIdentity = {
  simverseId: "test-identity-001",
  username: null,
  displayName: "Citizen Example",
  email: "citizen@example.test",
  avatarUrl: null,
  bannerUrl: null,
  creatorName: null,
  biography: "",
  profileVisibility: "PRIVATE",
  experienceMode: "PLAYER",
  homeCountryId: null,
  homeCountry: null,
  citizenships: [],
};

describe("single KAVANDRO owner profile", () => {
  it("shows one primary profile preview, and embeds only edit fields for first-time setup", () => {
    const html = renderToStaticMarkup(<ProfileIdentityPanel initial={base} countries={[]} />);
    expect(html).toContain("My KAVANDRO Profile");
    expect(html).not.toContain("My SIMVERSE Profile");
    expect((html.match(/Citizen Example/g) ?? [])).toHaveLength(1);
    expect(html).toContain('data-hide-duplicate-profile="true"');
    expect(html).toContain("Complete your player profile");
  });
  it("does not mount a second profile when already configured and not editing", () => {
    const html = renderToStaticMarkup(<ProfileIdentityPanel
      initial={{ ...base, username: "citizenone" }} countries={[]} />);
    expect(html).toContain("@citizenone");
    expect(html).not.toContain("data-hide-duplicate-profile");
    expect(html).toContain("Edit Profile");
  });
});
