import type { RaceProfileV1 } from "./stats";

export interface RaceRandom { nextUint32(): number }

export interface RaceDeltaInput {
  profile: RaceProfileV1;
  tick: number;
  progressMilli: number;
  totalDistanceMilli: number;
  variability: number;
}

export interface RaceDelta {
  progressDeltaMilli: number;
  basePaceMilli: number;
  accelerationBasisPoints: number;
  fatigueBasisPoints: number;
  variabilityBasisPoints: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Integer Race v1 progress formula, per 100 ms Core tick:
 *
 * base pace       = 4,000 + SPEED * 80 milli-distance units
 * acceleration BP = min(10,000, 3,500 + tick * (150 + ACCELERATION * 5))
 * fatigue starts at 60% distance and removes at most (100 - STAMINA) * 25 BP
 * seeded variance = up to +/-10%; HANDLING halves only the negative side at 100
 * LUCK shifts the bounded variance by at most +/-1% and never affects base pace
 *
 * Each multiplication floors to an integer, and every active participant advances
 * at least one milli-unit. With variability 0 no RNG value is consumed, allowing
 * equal profiles to produce an exact authoritative tie.
 */
export function raceProgressDelta(input: RaceDeltaInput, rng: RaceRandom): RaceDelta {
  const basePaceMilli = 4_000 + input.profile.speed * 80;
  const accelerationBasisPoints = Math.min(10_000, 3_500 + input.tick * (150 + input.profile.acceleration * 5));
  const progressBasisPoints = Math.floor(input.progressMilli * 10_000 / input.totalDistanceMilli);
  const fatigueWindow = clamp(progressBasisPoints - 6_000, 0, 4_000);
  const maximumFatigue = (100 - input.profile.stamina) * 25;
  const fatigueBasisPoints = 10_000 - Math.floor(maximumFatigue * fatigueWindow / 4_000);

  let variabilityBasisPoints = 0;
  if (input.variability > 0) {
    const raw = (rng.nextUint32() % 2_001) - 1_000;
    const scaled = Math.trunc(raw * input.variability / 100);
    const handled = scaled < 0
      ? Math.trunc(scaled * (200 - input.profile.handling) / 200)
      : scaled;
    const luckBias = Math.trunc((input.profile.luck - 50) * 2 * input.variability / 100);
    variabilityBasisPoints = clamp(handled + luckBias, -1_000, 1_000);
  }

  const accelerated = Math.floor(basePaceMilli * accelerationBasisPoints / 10_000);
  const sustained = Math.floor(accelerated * fatigueBasisPoints / 10_000);
  const varied = Math.floor(sustained * (10_000 + variabilityBasisPoints) / 10_000);
  return {
    progressDeltaMilli: Math.max(1, varied),
    basePaceMilli,
    accelerationBasisPoints,
    fatigueBasisPoints,
    variabilityBasisPoints,
  };
}

/** Precise deterministic finish time within the crossing tick, rounded up to a microsecond. */
export function finishTimeMicros(
  tick: number,
  fixedStepMs: number,
  previousProgressMilli: number,
  progressDeltaMilli: number,
  totalDistanceMilli: number,
): number {
  const remaining = Math.max(0, totalDistanceMilli - previousProgressMilli);
  const tickStartMicros = (tick - 1) * fixedStepMs * 1_000;
  const withinTickMicros = Math.ceil(remaining * fixedStepMs * 1_000 / progressDeltaMilli);
  return tickStartMicros + clamp(withinTickMicros, 0, fixedStepMs * 1_000);
}
