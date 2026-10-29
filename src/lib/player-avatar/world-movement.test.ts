import { describe, expect, it } from "vitest";
import {
  stepPlayer, isNear, touchesObstacle, PLAYER_SPEED, WORLD_LIMIT,
} from "./world-movement";

const idle = { forward: false, backward: false, left: false, right: false };

describe("player world movement", () => {
  it("does not move without player input", () => {
    expect(stepPlayer({ x: 0, z: 0 }, idle, 0.02)).toEqual({ x: 0, z: 0 });
  });
  it("moves forward and normalizes diagonals", () => {
    const straight = stepPlayer({ x: 0, z: 0 }, { ...idle, forward: true }, 0.02);
    const diagonal = stepPlayer({ x: 0, z: 0 }, { ...idle, forward: true, right: true }, 0.02);
    expect(straight.z).toBeCloseTo(-PLAYER_SPEED * 0.02);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(PLAYER_SPEED * 0.02);
  });
  it("clamps player movement to the playable area", () => {
    expect(stepPlayer({ x: WORLD_LIMIT, z: 0 }, { ...idle, right: true }, 0.05).x).toBe(WORLD_LIMIT);
  });
  it("blocks collision with obstacles", () => {
    const obstacle = [{ x: 0, z: -1, halfWidth: 0.5, halfDepth: 0.5 }];
    const position = { x: 0, z: -0.02 };
    expect(touchesObstacle(0, -0.2, obstacle)).toBe(true);
    expect(stepPlayer(position, { ...idle, forward: true }, 0.05, obstacle)).toEqual(position);
  });
  it("limits elapsed frame time and rejects invalid time", () => {
    const input = { ...idle, right: true };
    expect(stepPlayer({ x: 0, z: 0 }, input, 1).x).toBeCloseTo(PLAYER_SPEED * .05);
    expect(stepPlayer({ x: 0, z: 0 }, input, Number.NaN)).toEqual({ x: 0, z: 0 });
  });
  it("requires actual proximity for collecting an objective", () => {
    expect(isNear({ x: 4, z: 2 }, { x: 4.5, z: 2.2 })).toBe(true);
    expect(isNear({ x: 4, z: 2 }, { x: 0, z: 0 })).toBe(false);
  });
});
