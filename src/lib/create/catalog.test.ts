import { describe, expect, it } from "vitest";
import {
  CREATE_DESTINATIONS,
  canOpenCreateDestination,
  createDestinationById,
} from "./catalog";

describe("beginner Create destination catalog", () => {
  it("keeps every live creator on a real implemented route", () => {
    expect(createDestinationById("entity")).toMatchObject({ status: "LIVE", href: "/entities/new" });
    expect(createDestinationById("world")).toMatchObject({ status: "LIVE", href: "/worlds/new" });
    expect(createDestinationById("simulation")).toMatchObject({ status: "LIVE", href: "/simulations/new" });
    expect(createDestinationById("project")).toMatchObject({ status: "LIVE", href: "/projects/new" });
    expect(createDestinationById("anything-wars")).toMatchObject({ status: "LIVE", href: "/anything-wars/quick" });
    expect(CREATE_DESTINATIONS.filter((destination) => destination.status === "LIVE").every((destination) => destination.href)).toBe(true);
  });

  it("keeps future creators visibly non-interactive", () => {
    expect(createDestinationById("animation")).toMatchObject({ status: "COMING_LATER", href: null });
  });

  it("requires the real server-side permission set before exposing a live link", () => {
    const anythingWars = createDestinationById("anything-wars");
    expect(canOpenCreateDestination(anythingWars, ["simulation.create", "simulation.run"])).toBe(true);
    expect(canOpenCreateDestination(anythingWars, ["simulation.create"])).toBe(false);

    const world = createDestinationById("world");
    expect(canOpenCreateDestination(world, ["world.manage"])).toBe(true);
    expect(canOpenCreateDestination(world, ["world.view"])).toBe(false);
    expect(canOpenCreateDestination(createDestinationById("animation"), ["content.edit"])).toBe(false);
  });
});
