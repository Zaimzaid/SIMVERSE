import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/nav";
import type { Permission } from "@/lib/permissions";
import {
  PLATFORM_AREAS, areaForPath, canSeeNavItem, navLabelForPath,
  visibleAreaItems, visibleAreas,
} from "./platform-navigation";

const full = Array.from(new Set(
  NAV_ITEMS.flatMap((item) => item.permission ? [item.permission] : []),
)) as Permission[];

describe("SIMVERSE workspace navigation redesign", () => {
  it("assigns every original navigation link to one top-level area", () => {
    const routes = PLATFORM_AREAS.flatMap((area) => [...area.routes]);
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
    for (const item of NAV_ITEMS) {
      expect(unique.has(item.href)).toBe(true);
    }
    expect(visibleAreas(full).length).toBe(6);
  });

  it("shows only permitted links, never by itself changes server authorization", () => {
    const publicLinks = visibleAreas([]);
    expect(publicLinks.some((area) => area.id === "identity")).toBe(true);
    expect(publicLinks.flatMap((area) => area.items).some((item) => item.href === "/create")).toBe(false);
    expect(publicLinks.flatMap((area) => area.items).some((item) => item.href === "/projects")).toBe(false);
    expect(canSeeNavItem(NAV_ITEMS.find((item) => item.href === "/create")!, [])).toBe(false);
    expect(visibleAreaItems(PLATFORM_AREAS.find((area) => area.id === "build")!, full)
      .map((item) => item.href)).toContain("/create");
  });

  it("resolves nested player and economy pages correctly rather than dumping them into Home", () => {
    expect(areaForPath("/dashboard").id).toBe("home");
    expect(areaForPath("/profile").id).toBe("identity");
    expect(areaForPath("/profile/documents/review").id).toBe("identity");
    expect(areaForPath("/profile/work").id).toBe("economy");
    expect(areaForPath("/profile/work/review").id).toBe("economy");
    expect(areaForPath("/profile/career").id).toBe("economy");
    expect(areaForPath("/economy/lab/abc/world").id).toBe("economy");
    expect(areaForPath("/anything-wars/events/abc").id).toBe("simulations");
    expect(areaForPath("/earth/geography").id).toBe("discover");
    expect(areaForPath("/assets/new").id).toBe("build");
    expect(navLabelForPath("/profile/documents/review")).toBe("My Documents");
  });
});
