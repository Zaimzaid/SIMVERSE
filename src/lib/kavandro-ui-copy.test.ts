import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guard the visible copy and page titles that slipped through the first rebrand.
// Internal IDs, CSS selectors and interoperability URLs intentionally keep their
// historical machine names; this only checks these UI-specific screens.
const screenPaths = [
  "src/app/(platform)/anything-wars/page.tsx",
  "src/app/(platform)/earth/geography/page.tsx",
  "src/app/(platform)/earth/neighborhood/page.tsx",
  "src/app/(platform)/economy/lab/[labId]/world/page.tsx",
  "src/app/(platform)/marketplace/[listingId]/page.tsx",
  "src/app/(platform)/marketplace/library/page.tsx",
  "src/app/(platform)/profile/avatar/world/page.tsx",
  "src/app/(platform)/profile/civilization/assembly/moderation/page.tsx",
  "src/app/(platform)/profile/civilization/assembly/preview/page.tsx",
  "src/app/(platform)/profile/civilization/development/page.tsx",
  "src/app/(platform)/profile/civilization/development/staff/page.tsx",
  "src/app/(platform)/profile/civilization/land/page.tsx",
  "src/app/(platform)/profile/civilization/reviewer/page.tsx",
  "src/app/(platform)/profile/page.tsx",
  "src/app/(platform)/studio/page.tsx",
  "src/app/(platform)/studio/video/page.tsx",
  "src/app/(platform)/worlds/[worldId]/layout/page.tsx",
  "src/app/planet/planning/audit/page.tsx",
  "src/components/platform/context-rail.tsx",
  "src/components/platform/settings/google-drive-settings.tsx",
  "src/components/platform/settings/profile-settings-form.tsx",
  "src/components/player/player-avatar-preview.tsx",
  "src/components/player/profile-identity-panel.tsx",
  "src/components/social/community-extras.tsx",
  "src/components/social/community-v3.tsx",
  "src/lib/platform-navigation.ts",
];

describe("user-facing KAVANDRO copy", () => {
  it.each(screenPaths)("%s has no remaining uppercase legacy platform name", (path) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    expect(source).not.toMatch(/\bSIMVERSE\b/);
  });
});
