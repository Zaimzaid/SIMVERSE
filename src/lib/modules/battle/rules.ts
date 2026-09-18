import type { BattleParticipantStateV1 } from "./schemas";

export interface BattleRandom { nextFloat(): number }

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** One action per tick. Speed leads initiative; seeded 0–10 jitter and position break ties. */
export function initiativeOrder(participants: readonly BattleParticipantStateV1[], rng: BattleRandom): string[] {
  return participants.filter((participant) => participant.alive).map((participant) => ({
    id: participant.runParticipantId,
    position: participant.position,
    score: participant.profile.speed + Math.floor(rng.nextFloat() * 11),
  })).sort((a, b) => b.score - a.score || a.position - b.position).map(({ id }) => id);
}

/** Intelligence improves focus on weakened opponents; seeded jitter avoids fixed first-target bias. */
export function chooseTarget(
  actor: BattleParticipantStateV1, participants: readonly BattleParticipantStateV1[], rng: BattleRandom,
): BattleParticipantStateV1 | null {
  const candidates = participants.filter((target) => target.alive && target.runParticipantId !== actor.runParticipantId);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;
  return candidates.map((target) => ({
    target,
    score: (100 - target.health) * (0.15 + actor.profile.intelligence / 250) +
      target.damageDealt * 0.1 + rng.nextFloat() * 10,
  })).sort((a, b) => b.score - a.score || a.target.position - b.target.position)[0]?.target ?? null;
}

/** A guard costs the action, absorbs one landed hit, or expires at the defender's next action. */
export function shouldDefend(actor: BattleParticipantStateV1, rng: BattleRandom): boolean {
  if (actor.defending) return false;
  const chance = actor.health <= 40
    ? 0.12 + actor.profile.intelligence * 0.002
    : 0.015 + actor.profile.intelligence * 0.0005;
  return rng.nextFloat() < chance;
}

export function dodgeProbability(attacker: BattleParticipantStateV1, defender: BattleParticipantStateV1): number {
  return bounded(
    0.04 + (defender.profile.speed - attacker.profile.speed) * 0.0015 + defender.profile.luck * 0.0004,
    0.02, 0.22,
  );
}

export function criticalProbability(attacker: BattleParticipantStateV1): number {
  return bounded(0.03 + attacker.profile.luck * 0.001 + attacker.profile.intelligence * 0.00025, 0.03, 0.16);
}

export interface AttackOutcome {
  baseDamage: number;
  finalDamage: number;
  dodged: boolean;
  critical: boolean;
  guarded: boolean;
}

/**
 * Base = round(5 + .18×strength + .04×intelligence − .08×defense + jitter[-2,2]).
 * Clamp base to 2–28, critical to 1.5× (at most 40), guard halves a hit.
 * All three seeded rolls are consumed for every attack, including a dodge.
 */
export function resolveAttack(
  attacker: BattleParticipantStateV1, defender: BattleParticipantStateV1, rng: BattleRandom,
): AttackOutcome {
  const dodgeRoll = rng.nextFloat();
  const criticalRoll = rng.nextFloat();
  const variation = rng.nextFloat() * 4 - 2;
  const baseDamage = bounded(Math.round(
    5 + attacker.profile.strength * 0.18 + attacker.profile.intelligence * 0.04 -
    defender.profile.defense * 0.08 + variation,
  ), 2, 28);
  const dodged = dodgeRoll < dodgeProbability(attacker, defender);
  const critical = !dodged && criticalRoll < criticalProbability(attacker);
  const guarded = !dodged && defender.defending;
  const boosted = critical ? Math.min(40, Math.round(baseDamage * 1.5)) : baseDamage;
  const finalDamage = dodged ? 0 : guarded ? Math.max(1, Math.ceil(boosted / 2)) : boosted;
  return { baseDamage, finalDamage, dodged, critical, guarded };
}
