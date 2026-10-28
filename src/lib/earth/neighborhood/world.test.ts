import { describe, expect, it } from "vitest";
import { createNeighborhoodWorld, isWalkable, moveWalker } from "./world";

describe("Marina Junction three-dimensional visual proof geometry", () => {
  it("is deterministic and has non-overlapping identities", () => {
    const first = createNeighborhoodWorld();
    const second = createNeighborhoodWorld();
    expect(first).toEqual(second);
    expect(first.buildings).toHaveLength(32);
    expect(first.plots).toHaveLength(32);
    expect(first.roadAxes).toEqual([-84, -28, 28, 84]);
    expect(new Set(first.buildings.map((building) => building.id)).size).toBe(32);
    expect(new Set(first.plots.map((plot) => plot.id)).size).toBe(32);
  });

  it("keeps the V0.2 feature street focused on a safe, reachable plaza path", () => {
    const world = createNeighborhoodWorld();
    expect(isWalkable(world, 18, 8)).toBe(true);
    const frontages = world.buildings.filter((building) =>
      Math.abs(building.x) === 45 && Math.abs(building.z) === 11,
    );
    expect(frontages).toHaveLength(4);
    expect(frontages.every((building) => building.height > 4)).toBe(true);
    // The visual overlay is additive: world IDs, plots and collision footprints
    // are not changed or rewritten by the renderer.
    expect(world.plots.every((plot) => plot.status === "visualization-only")).toBe(true);
  });

  it("has a walkable pedestrian starting position and an accessible plaza", () => {
    const world = createNeighborhoodWorld();
    expect(isWalkable(world, world.spawn.x, world.spawn.z)).toBe(true);
    expect(isWalkable(world, 0, 0)).toBe(true);
    expect(isWalkable(world, world.buildings[0]!.x, world.buildings[0]!.z)).toBe(false);
  });

  it("slides along buildings and respects bounded walk limits", () => {
    const world = createNeighborhoodWorld();
    const first = world.buildings[0]!;
    expect(moveWalker(world, { x: first.x - first.width / 2 - 1.1, z: first.z }, 1.2, 0).x)
      .toBeCloseTo(first.x - first.width / 2 - 1.1);
    expect(isWalkable(world, 117, 0)).toBe(false);
    expect(isWalkable(world, Number.NaN, 0)).toBe(false);
    const outer = moveWalker(world, { x: 115.5, z: 100 }, 5, 0);
    expect(outer.x).toBe(115.5);
  });

  it("never describes visualization-only lots as owned real-world land", () => {
    const world = createNeighborhoodWorld();
    expect(world.plots.every((plot) => plot.status === "visualization-only")).toBe(true);
    expect(world.buildings.every((b) => b.height > 0 && b.width > 0 && b.depth > 0)).toBe(true);
    expect(world.trees.length).toBeGreaterThan(20);
  });
});
