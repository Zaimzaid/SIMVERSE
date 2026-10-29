import { describe, expect, it } from "vitest";
import {
  clampTrim, editedDuration, formatVideoTime, initialVideoSettings, OUTPUT_SIZES, videoPlacement,
} from "@/lib/video-studio/editor";

describe("Video Studio editor helpers", () => {
  it("starts with non-destructive defaults and the full imported duration", () => {
    const settings = initialVideoSettings(95);
    expect(settings.trimStart).toBe(0);
    expect(settings.trimEnd).toBe(95);
    expect(settings.speed).toBe(1);
    expect(settings.brightness).toBe(100);
    expect(settings.text).toBe("");
  });

  it("enforces clip boundaries and minimum usable segment", () => {
    expect(clampTrim(-8, 999, 15)).toEqual({ start: 0, end: 15 });
    expect(clampTrim(12, 3, 15)).toEqual({ start: 12, end: 12.1 });
    expect(clampTrim(20, 21, 15)).toEqual({ start: 14.9, end: 15 });
  });

  it("calculates shorter or longer exports from playback speed", () => {
    const settings = initialVideoSettings(20);
    settings.trimStart = 2;
    settings.trimEnd = 14;
    settings.speed = 2;
    expect(editedDuration(settings)).toBe(6);
    settings.speed = 0.5;
    expect(editedDuration(settings)).toBe(24);
  });

  it("uses the correct social output dimensions", () => {
    expect(OUTPUT_SIZES["16:9"]).toMatchObject({ width: 1280, height: 720 });
    expect(OUTPUT_SIZES["9:16"]).toMatchObject({ width: 720, height: 1280 });
    expect(OUTPUT_SIZES["1:1"]).toMatchObject({ width: 1080, height: 1080 });
  });

  it("keeps full footage visible or crops to fill without distortion", () => {
    expect(videoPlacement(1920, 1080, 720, 1280, "contain"))
      .toEqual({ x: 0, y: 437.5, width: 720, height: 405 });
    const cover = videoPlacement(1920, 1080, 720, 1280, "cover");
    expect(cover.height).toBe(1280);
    expect(cover.width).toBeCloseTo(2275.55556, 4);
    expect(cover.x).toBeLessThan(0);
  });

  it("formats timestamps safely", () => {
    expect(formatVideoTime(65)).toBe("01:05");
    expect(formatVideoTime(-1)).toBe("00:00");
    expect(formatVideoTime(Number.NaN)).toBe("00:00");
  });
});
