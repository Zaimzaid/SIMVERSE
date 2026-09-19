import type { AnimationState, ViewerCue, ViewerFrame, VisualEntityInstance } from "./types";

export interface EntityPose {
  x: number;
  y: number;
  z: number;
  heading: number;
  tilt: number;
  scale: number;
  animation: AnimationState;
  guard: number;
  impact: number;
  critical: number;
  dodge: number;
  elimination: number;
  victory: number;
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }
function smooth(value: number) { const t = clamp01(value); return t * t * (3 - 2 * t); }
function pulse(at: number, start: number, attackMs: number, decayMs: number) {
  return smooth((at - start) / attackMs) * (1 - smooth((at - start - attackMs) / decayMs));
}
function cueFor(cues: ViewerCue[], kind: ViewerCue["kind"], id: string, field: "actorId" | "targetId") {
  return cues.find((cue) => cue.kind === kind && cue[field] === id);
}

/** Presentation only. All outcomes and health come from the saved event stream. */
export function deriveEntityPose(entity: VisualEntityInstance, frame: ViewerFrame, scene: VisualEntityInstance[]): EntityPose {
  const cues = frame.activeMoment?.cues ?? [];
  const at = frame.timeMs;
  const attack = cueFor(cues, "ATTACK", entity.id, "actorId");
  const dodge = cueFor(cues, "DODGE", entity.id, "targetId");
  const damage = cueFor(cues, "DAMAGE", entity.id, "targetId");
  const critical = cueFor(cues, "CRITICAL", entity.id, "targetId");
  const eliminate = cueFor(cues, "ELIMINATE", entity.id, "targetId");
  const target = scene.find((other) => other.id === attack?.targetId);
  const aggressor = scene.find((other) => other.id === damage?.actorId || other.id === dodge?.actorId);
  const pose: EntityPose = {
    x: entity.x, y: 0, z: entity.z, heading: entity.facing > 0 ? Math.PI / 2 : -Math.PI / 2,
    tilt: 0, scale: 1, animation: "IDLE", guard: 0, impact: 0, critical: 0, dodge: 0, elimination: 0, victory: 0,
  };
  const status = frame.participants[entity.id];
  if (target && attack) {
    const dx = target.x - entity.x;
    const dz = target.z - entity.z;
    const distance = Math.hypot(dx, dz) || 1;
    const approach = smooth((at - attack.startMs) / 350);
    const retreat = smooth((at - attack.startMs - 590) / 340);
    const travel = (approach - retreat) * Math.min(0.67, Math.max(0, (distance - 1.8) / distance));
    pose.x += dx * travel;
    pose.z += dz * travel;
    pose.heading = Math.atan2(dx, dz);
    if (at >= attack.startMs && at < attack.startMs + 350) pose.animation = "RUN";
    else if (at < attack.startMs + 730) {
      pose.animation = entity.profile.animationProfile.ATTACK_SECONDARY && attack.sequence % 2 === 0
        ? "ATTACK_SECONDARY" : "ATTACK_PRIMARY";
      const strike = pulse(at, attack.startMs + 350, 90, 290);
      pose.scale = 1 + (frame.reducedMotion ? 0.025 : 0.095) * strike;
      pose.tilt = frame.reducedMotion ? 0 : -entity.facing * strike * 0.21;
    }
    else if (at < attack.startMs + 960) pose.animation = "WALK";
    pose.y = frame.reducedMotion ? 0 : Math.sin(Math.PI * Math.max(0, travel)) * 0.13;
  }
  if (dodge) {
    const outward = pulse(at, dodge.startMs - 110, 150, 320);
    const dx = aggressor ? entity.x - aggressor.x : entity.facing;
    const dz = aggressor ? entity.z - aggressor.z : 0;
    const length = Math.hypot(dx, dz) || 1;
    const displacement = frame.reducedMotion ? 0.2 : entity.profile.animationProfile.DODGE ? 0.62 : 1.15;
    pose.x += (-dz / length) * outward * displacement;
    pose.z += (dx / length) * outward * displacement;
    pose.dodge = outward;
    if (at >= dodge.startMs - 110 && at < dodge.startMs + 380) pose.animation = "DODGE";
    pose.tilt = frame.reducedMotion ? 0 : outward * 0.19;
  }
  if (damage && at >= damage.startMs) {
    const impact = pulse(at, damage.startMs, 60, 320);
    const dx = aggressor ? entity.x - aggressor.x : entity.facing;
    const dz = aggressor ? entity.z - aggressor.z : 0;
    const length = Math.hypot(dx, dz) || 1;
    pose.x += dx / length * impact * (frame.reducedMotion ? 0.07 : 0.32);
    pose.z += dz / length * impact * (frame.reducedMotion ? 0.07 : 0.32);
    pose.impact = impact;
    pose.critical = critical ? impact : 0;
    if (at < damage.startMs + 380) pose.animation = critical ? "HIT_HEAVY" : "HIT_LIGHT";
    pose.tilt = frame.reducedMotion ? 0 : -impact * 0.12;
  }
  if (status?.defending) { pose.guard = 1; if (!attack) pose.animation = "DEFEND"; }
  if (status?.eliminated) {
    const fall = eliminate ? smooth((at - eliminate.startMs) / 560) : 1;
    pose.elimination = fall;
    pose.tilt = frame.reducedMotion ? 0 : fall * 0.95 * entity.facing;
    pose.y = -fall * 0.25;
    pose.animation = "DEFEATED";
  } else if (frame.completed && frame.winnerId === entity.id) {
    pose.victory = 1;
    pose.animation = "VICTORY";
    pose.y = frame.reducedMotion ? 0 : 0.1 + Math.sin(at * 0.004) * 0.06;
  } else if (pose.animation === "IDLE" && !frame.reducedMotion) {
    pose.y = Math.sin(at * 0.0027 + entity.x) * 0.045;
  }
  return pose;
}
