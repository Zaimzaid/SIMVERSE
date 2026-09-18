import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from "three";
import type { AnimationProfile, AnimationState } from "./types";

const defaults: Record<AnimationState, readonly string[]> = {
  IDLE: ["idle", "breathing"], WALK: ["walk", "walking"], RUN: ["run", "running"],
  ATTACK: ["attack_1", "attack", "strike"], DEFEND: ["defend", "guard", "block"],
  DODGE: ["dodge", "evade"], HIT: ["hit", "damage", "impact"],
  DEFEATED: ["defeated", "death", "fall"], VICTORY: ["victory", "celebrate", "win"],
};
const looping = new Set<AnimationState>(["IDLE", "WALK", "RUN", "DEFEND", "VICTORY"]);

/** Owns only imported clip playback. World-space movement is driven by Viewer cues. */
export class AnimationController {
  private readonly mixer: AnimationMixer;
  private readonly clips = new Map<string, AnimationClip>();
  private current: AnimationAction | null = null;
  private currentState: AnimationState | null = null;
  private lastTimeMs = 0;
  private finished = false;

  constructor(root: Object3D, available: readonly AnimationClip[], private readonly profile: AnimationProfile) {
    this.mixer = new AnimationMixer(root);
    for (const clip of available) this.clips.set(clip.name.toLowerCase(), clip);
    this.mixer.addEventListener("finished", () => { this.finished = true; });
  }

  private find(state: AnimationState) {
    const names = [this.profile[state], ...defaults[state]].filter((name): name is string => Boolean(name));
    return names.map((name) => this.clips.get(name.toLowerCase())).find(Boolean) ?? null;
  }

  hasClip(state: AnimationState) { return Boolean(this.find(state)); }
  get hasCompleted() { return this.finished; }

  update(state: AnimationState, timeMs: number) {
    if (timeMs < this.lastTimeMs) this.reset();
    const elapsed = Math.min(0.12, Math.max(0, (timeMs - this.lastTimeMs) / 1000));
    this.lastTimeMs = timeMs;
    if (state !== this.currentState) {
      this.currentState = state;
      this.finished = false;
      // If the requested clip is absent, use idle underneath the procedural fallback pose.
      const clip = this.find(state) ?? this.find("IDLE");
      const next = clip ? this.mixer.clipAction(clip) : null;
      if (next && next !== this.current) {
        next.reset();
        next.enabled = true;
        next.setEffectiveWeight(1);
        next.setLoop(looping.has(state) ? LoopRepeat : LoopOnce, looping.has(state) ? Infinity : 1);
        next.clampWhenFinished = !looping.has(state);
        if (this.current) next.crossFadeFrom(this.current, 0.2, true);
        else next.fadeIn(0.2);
        next.play();
      }
      this.current = next;
    }
    this.mixer.update(elapsed);
  }

  reset() {
    this.mixer.stopAllAction();
    this.current = null;
    this.currentState = null;
    this.lastTimeMs = 0;
    this.finished = false;
  }

  dispose() { this.reset(); this.mixer.uncacheRoot(this.mixer.getRoot()); }
}
