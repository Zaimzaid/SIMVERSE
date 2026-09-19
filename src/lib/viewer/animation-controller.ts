import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type Object3D } from "three";
import type { AnimationProfile, AnimationState } from "@/lib/visuals/profile";

const defaults: Record<AnimationState, readonly string[]> = {
  IDLE: ["idle", "idle_loop", "breathing"], WALK: ["walk", "walkcycle", "walking"],
  RUN: ["run", "runfast", "running", "sprint", "gallop"], TURN: ["turn", "turn_left", "turn_right"],
  ATTACK_PRIMARY: ["attack_1", "attack", "strike", "bite_01", "punch"],
  ATTACK_SECONDARY: ["attack_2", "secondary_attack", "kick"],
  DEFEND: ["defend", "guard", "block"], DODGE: ["dodge", "evade", "roll"],
  HIT_LIGHT: ["hit", "hit_light", "damage", "impact"], HIT_HEAVY: ["hit_heavy", "heavy_hit", "knockback"],
  DEFEATED: ["defeated", "death", "death_a", "fall"], VICTORY: ["victory", "celebrate", "win", "roar"],
  INTRO: ["intro", "entrance", "spawn"], SPECIAL: ["special"], STUNNED: ["stunned", "stun"],
  JUMP: ["jump"], LAND: ["land"], FLY: ["fly"], SWIM: ["swim"], EMOTE: ["emote", "taunt"],
};

export const LOOPING_ANIMATION_STATES = new Set<AnimationState>(["IDLE", "WALK", "RUN"]);
export const TERMINAL_ANIMATION_STATES = new Set<AnimationState>(["DEFEATED"]);

export function canInterruptAnimation(current: AnimationState | null, next: AnimationState, finished: boolean) {
  if (!current || current === next) return true;
  if (TERMINAL_ANIMATION_STATES.has(current)) return false;
  if (next === "DEFEATED") return true;
  if (finished || LOOPING_ANIMATION_STATES.has(current)) return true;
  // A cue may explicitly replace a one-shot with another action/reaction, but
  // passive IDLE must not cut a strike, dodge, hit, intro or victory in half.
  return next !== "IDLE";
}

function withoutSceneRootMotion(clip: AnimationClip, root: Object3D) {
  const rootPosition = root.name ? `${root.name}.position` : null;
  const tracks = clip.tracks.filter((track) => track.name !== ".position" && track.name !== rootPosition);
  return tracks.length === clip.tracks.length ? clip : new AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/** Owns imported clip playback. Deterministic Viewer cues continue to drive world position. */
export class AnimationController {
  private readonly mixer: AnimationMixer;
  private readonly clips = new Map<string, AnimationClip>();
  private current: AnimationAction | null = null;
  private currentState: AnimationState | null = null;
  private requestedState: AnimationState | null = null;
  private completedRequestedState: AnimationState | null = null;
  private lastTimeMs = 0;
  private finished = false;

  constructor(root: Object3D, available: readonly AnimationClip[], private readonly profile: AnimationProfile) {
    this.mixer = new AnimationMixer(root);
    for (const clip of available) this.clips.set(clip.name.toLowerCase(), withoutSceneRootMotion(clip, root));
    this.mixer.addEventListener("finished", () => {
      this.finished = true;
      if (this.currentState && !TERMINAL_ANIMATION_STATES.has(this.currentState)) {
        this.completedRequestedState = this.requestedState;
      }
    });
  }

  private find(state: AnimationState) {
    const names = [this.profile[state], ...defaults[state]].filter((name): name is string => Boolean(name));
    return names.map((name) => this.clips.get(name.toLowerCase())).find(Boolean) ?? null;
  }

  private transition(state: AnimationState) {
    if (!canInterruptAnimation(this.currentState, state, this.finished)) return;
    const clip = this.find(state) ?? (state === "IDLE" ? null : this.find("IDLE"));
    const next = clip ? this.mixer.clipAction(clip) : null;
    if (next && next !== this.current) {
      next.reset();
      next.enabled = true;
      next.setEffectiveWeight(1);
      const loops = LOOPING_ANIMATION_STATES.has(state);
      next.setLoop(loops ? LoopRepeat : LoopOnce, loops ? Infinity : 1);
      next.clampWhenFinished = !loops;
      if (this.current) next.crossFadeFrom(this.current, 0.22, true);
      else next.fadeIn(0.18);
      next.play();
    }
    this.current = next;
    this.currentState = state;
    this.finished = false;
  }

  hasClip(state: AnimationState) { return Boolean(this.find(state)); }
  get hasCompleted() { return this.finished; }
  get state() { return this.currentState; }

  update(requested: AnimationState, timeMs: number) {
    if (timeMs < this.lastTimeMs) this.reset();
    const elapsed = Math.min(0.12, Math.max(0, (timeMs - this.lastTimeMs) / 1000));
    this.lastTimeMs = timeMs;
    if (requested !== this.requestedState) {
      this.requestedState = requested;
      this.completedRequestedState = null;
    }
    const desired = this.completedRequestedState === requested && !TERMINAL_ANIMATION_STATES.has(requested)
      ? "IDLE" : requested;
    if (desired !== this.currentState) this.transition(desired);
    this.mixer.update(elapsed);
  }

  reset() {
    this.mixer.stopAllAction();
    this.current = null;
    this.currentState = null;
    this.requestedState = null;
    this.completedRequestedState = null;
    this.lastTimeMs = 0;
    this.finished = false;
  }

  dispose() { this.reset(); this.mixer.uncacheRoot(this.mixer.getRoot()); }
}
