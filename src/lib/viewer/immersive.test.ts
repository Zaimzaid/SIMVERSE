import { describe, expect, it } from "vitest";
import { isImmersiveViewerPath } from "./immersive";

describe("immersive Watch routing", () => {
  it("removes dashboard chrome only for a run Watch route", () => {
    expect(isImmersiveViewerPath("/simulations/s1/runs/r1/watch")).toBe(true);
    expect(isImmersiveViewerPath("/simulations/s1/runs/r1/watch/")).toBe(true);
    expect(isImmersiveViewerPath("/simulations/s1/runs/r1")).toBe(false);
    expect(isImmersiveViewerPath("/simulations/s1")).toBe(false);
  });
});
