import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { AnimationController } from "./animation-controller";

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
    const controller = new AnimationController(instance, model.animations, { ATTACK: "attack_1" });
    expect(controller.hasClip("ATTACK")).toBe(true);
    expect(controller.hasClip("RUN")).toBe(false);
    controller.update("IDLE", 0);
    controller.update("IDLE", 120);
    controller.update("ATTACK", 220);
    controller.update("ATTACK", 340);
    expect(Math.abs(instance.getObjectByName("RightArm")!.rotation.z)).toBeGreaterThan(0);
    controller.reset();
    controller.update("VICTORY", 0);
    controller.update("VICTORY", 120);
    controller.dispose();
  });

  it("rejects a malformed model without affecting the replay data", async () => {
    await expect(new GLTFLoader().parseAsync("not a glTF", "")).rejects.toThrow();
  });
});
