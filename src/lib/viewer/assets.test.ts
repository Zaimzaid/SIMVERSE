import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { AnimationController } from "./animation-controller";
import { canInterruptAnimation, LOOPING_ANIMATION_STATES } from "./animation-controller";

afterEach(() => { vi.unstubAllGlobals(); });

describe("original SIMVERSE glTF model and animation contract", () => {
  it("loads the shipped model and drives mapped clips independently of the fallback", async () => {
    // Three's FileLoader dispatches a browser ProgressEvent while fetching inline glTF data.
    vi.stubGlobal("ProgressEvent", class extends Event {});
    const text = fs.readFileSync(path.join(process.cwd(), "public/models/simverse-sentinel.gltf"), "utf8");
    const model = await new GLTFLoader().parseAsync(text, "");
    expect(model.scene.getObjectByName("Sentinel")).toBeTruthy();
    expect(model.animations.map((clip) => clip.name)).toEqual(["idle", "attack_1", "victory"]);
    const instance = cloneSkeleton(model.scene);
    const controller = new AnimationController(instance, model.animations, { ATTACK_PRIMARY: "attack_1" });
    expect(controller.hasClip("ATTACK_PRIMARY")).toBe(true);
    expect(controller.hasClip("RUN")).toBe(false);
    controller.update("IDLE", 0);
    controller.update("IDLE", 120);
    controller.update("ATTACK_PRIMARY", 220);
    controller.update("ATTACK_PRIMARY", 340);
    expect(Math.abs(instance.getObjectByName("RightArm")!.rotation.z)).toBeGreaterThan(0);
    controller.reset();
    controller.update("VICTORY", 0);
    controller.update("VICTORY", 120);
    controller.dispose();
  });

  it("rejects a malformed model without affecting the replay data", async () => {
    await expect(new GLTFLoader().parseAsync("not a glTF", "")).rejects.toThrow();
  });

  it("loads the original skinned proxy with standard clips and independent cloned skeletons", async () => {
    vi.stubGlobal("ProgressEvent", class extends Event {});
    const text = fs.readFileSync(path.join(process.cwd(), "public/models/simverse-rigged-proxy.gltf"), "utf8");
    const model = await new GLTFLoader().parseAsync(text, "");
    let skinnedMeshes = 0;
    model.scene.traverse((object) => { if ((object as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinnedMeshes += 1; });
    expect(skinnedMeshes).toBe(1);
    expect(model.animations.map((clip) => clip.name)).toEqual([
      "idle", "run", "attack_primary", "hit_light", "defeated", "victory",
    ]);
    const first = cloneSkeleton(model.scene);
    const second = cloneSkeleton(model.scene);
    expect(first.getObjectByName("UpperBone")).not.toBe(second.getObjectByName("UpperBone"));
    const controller = new AnimationController(first, model.animations, {
      IDLE: "idle", RUN: "run", ATTACK_PRIMARY: "attack_primary", HIT_LIGHT: "hit_light",
      DEFEATED: "defeated", VICTORY: "victory",
    });
    for (const state of ["IDLE", "RUN", "ATTACK_PRIMARY", "HIT_LIGHT", "DEFEATED", "VICTORY"] as const) {
      expect(controller.hasClip(state)).toBe(true);
    }
    controller.dispose();
  });

  it("defines loop, one-shot, interruption and terminal behavior independently of rendered frames", () => {
    expect(LOOPING_ANIMATION_STATES.has("IDLE")).toBe(true);
    expect(LOOPING_ANIMATION_STATES.has("RUN")).toBe(true);
    expect(LOOPING_ANIMATION_STATES.has("ATTACK_PRIMARY")).toBe(false);
    expect(canInterruptAnimation("RUN", "ATTACK_PRIMARY", false)).toBe(true);
    expect(canInterruptAnimation("ATTACK_PRIMARY", "IDLE", false)).toBe(false);
    expect(canInterruptAnimation("ATTACK_PRIMARY", "IDLE", true)).toBe(true);
    expect(canInterruptAnimation("DEFEATED", "IDLE", true)).toBe(false);
    expect(canInterruptAnimation("ATTACK_PRIMARY", "DEFEATED", false)).toBe(true);
  });
});
