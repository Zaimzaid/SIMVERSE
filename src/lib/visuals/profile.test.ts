import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_PROFILE,
  suggestAnimationMappings,
  visualProfileInputSchema,
  visualValidationStatus,
} from "./profile";

describe("Entity Visual Profile vocabulary and validation", () => {
  it("accepts every production archetype without category inference", () => {
    for (const archetype of ["HUMANOID", "QUADRUPED", "ROBOT", "VEHICLE_GROUND", "ABSTRACT", "CUSTOM"] as const) {
      expect(visualProfileInputSchema.parse({ ...DEFAULT_VISUAL_PROFILE, archetype }).archetype).toBe(archetype);
    }
  });

  it("requires safe GLTF/GLB references for model sources", () => {
    expect(visualProfileInputSchema.safeParse({ ...DEFAULT_VISUAL_PROFILE, sourceType: "MODEL_3D" }).success).toBe(false);
    expect(visualProfileInputSchema.safeParse({
      ...DEFAULT_VISUAL_PROFILE, sourceType: "MODEL_3D", modelUrl: "javascript:alert(1).glb",
    }).success).toBe(false);
    expect(visualProfileInputSchema.parse({
      ...DEFAULT_VISUAL_PROFILE, sourceType: "MODEL_3D", modelUrl: "/models/simverse-sentinel.gltf",
    }).modelUrl).toBe("/models/simverse-sentinel.gltf");
  });

  it("suggests raw clip mappings without mutating or requiring exact names", () => {
    const suggestions = suggestAnimationMappings(["Idle_Loop", "RunFast", "Bite_01", "Death_A", "VictoryRoar"]);
    expect(suggestions).toMatchObject({
      IDLE: "Idle_Loop", RUN: "RunFast", ATTACK_PRIMARY: "Bite_01", DEFEATED: "Death_A", VICTORY: "VictoryRoar",
    });
    const duplicate = visualProfileInputSchema.parse({
      ...DEFAULT_VISUAL_PROFILE,
      animationProfile: { WALK: "Locomotion", RUN: "Locomotion" },
    });
    expect(duplicate.animationProfile.WALK).toBe(duplicate.animationProfile.RUN);
  });

  it("classifies fallback, invalid, partial and ready asset states", () => {
    expect(visualValidationStatus(DEFAULT_VISUAL_PROFILE, null)).toBe("FALLBACK REQUIRED");
    const profile = {
      ...DEFAULT_VISUAL_PROFILE,
      sourceType: "MODEL_3D" as const,
      modelUrl: "/models/test.glb",
      animationProfile: { IDLE: "Idle" },
    };
    expect(visualValidationStatus(profile, null)).toBe("PARTIAL");
    expect(visualValidationStatus(profile, {
      loaded: false, animationNames: [], sceneCount: 0, meshCount: 0, skinnedMeshCount: 0,
      skeletonDetected: false, dimensions: null, byteSize: null, error: "broken",
    })).toBe("INVALID");
    const loaded = {
      loaded: true, animationNames: ["Idle"], sceneCount: 1, meshCount: 1, skinnedMeshCount: 0,
      skeletonDetected: false, dimensions: { x: 1, y: 2, z: 1 }, byteSize: 1234, error: null,
    };
    expect(visualValidationStatus(profile, loaded)).toBe("PARTIAL");
    const completeProfile = { ...profile, animationProfile: {
      IDLE: "Idle", RUN: "Run", ATTACK_PRIMARY: "Attack", DODGE: "Dodge",
      HIT_LIGHT: "Hit", DEFEATED: "Defeat", VICTORY: "Victory",
    } };
    expect(visualValidationStatus(completeProfile, {
      ...loaded, animationNames: ["Idle", "Run", "Attack", "Dodge", "Hit", "Defeat", "Victory"],
    })).toBe("READY");
  });
});
