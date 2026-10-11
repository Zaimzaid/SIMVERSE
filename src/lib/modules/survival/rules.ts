import {
  SURVIVAL_CONDITION_MAX, type SurvivalConfigV1, type SurvivalHazardCategory,
} from "./config";
import type { SurvivalProfileV1 } from "./stats";

export interface SurvivalRandom { nextUint32(): number }

export interface ResourceDrainResult {
  energyDrain: number;
  suppliesDrain: number;
  efficiencyBasisPoints: number;
  variabilityBasisPoints: number;
}

export interface ConditionDrainResult {
  baselineLoss: number;
  resourceDepletionLoss: number;
  totalLoss: number;
  enduranceBasisPoints: number;
}

export interface HazardImpactResult {
  conditionLoss: number;
  energyLoss: number;
  suppliesLoss: number;
  exposureBasisPoints: number;
  resilienceBasisPoints: number;
  adaptabilityBasisPoints: number;
  variabilityBasisPoints: number;
}

export interface RecoveryResult {
  conditionRecovered: number;
  energyCost: number;
  suppliesCost: number;
  adaptabilityBasisPoints: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function scaled(value: number, basisPoints: number): number {
  return Math.floor(value * basisPoints / 10_000);
}

/**
 * Resource drain formula for one fixed tick:
 *   efficiency BP = 10,000 - RESOURCE_EFFICIENCY * 50 (50% reduction at 100)
 *   seeded variance = [-1,000, 1,000] BP * configured variability
 *   LUCK shifts variance favorably by at most +/-100 BP; final variance stays +/-1,000 BP
 *   drain = floor(floor(base * efficiency BP) * variance BP), minimum 1
 *
 * One roll is shared by ENERGY and SUPPLIES. With variability 0 no RNG is used.
 */
export function survivalResourceDrain(
  profile: SurvivalProfileV1,
  resources: SurvivalConfigV1["resources"],
  variability: number,
  rng: SurvivalRandom,
): ResourceDrainResult {
  const efficiencyBasisPoints = 10_000 - profile.resourceEfficiency * 50;
  let variabilityBasisPoints = 0;
  if (variability > 0) {
    const raw = (rng.nextUint32() % 2_001) - 1_000;
    const randomPart = Math.trunc(raw * variability / 100);
    const luckBias = Math.trunc((50 - profile.luck) * 2 * variability / 100);
    variabilityBasisPoints = clamp(randomPart + luckBias, -1_000, 1_000);
  }
  const drain = (base: number) => Math.max(
    1,
    scaled(scaled(base, efficiencyBasisPoints), 10_000 + variabilityBasisPoints),
  );
  return {
    energyDrain: drain(resources.baseEnergyDrain),
    suppliesDrain: drain(resources.baseSuppliesDrain),
    efficiencyBasisPoints,
    variabilityBasisPoints,
  };
}

/** Baseline condition challenge plus an explicit penalty for each exhausted resource. */
export function survivalConditionDrain(
  profile: SurvivalProfileV1,
  baseConditionDrain: number,
  depletionConditionPenalty: number,
  energy: number,
  supplies: number,
): ConditionDrainResult {
  const enduranceBasisPoints = 10_000 - profile.endurance * 50;
  const baselineLoss = scaled(baseConditionDrain, enduranceBasisPoints);
  const resourceDepletionLoss = (energy === 0 ? depletionConditionPenalty : 0) +
    (supplies === 0 ? depletionConditionPenalty : 0);
  return {
    baselineLoss,
    resourceDepletionLoss,
    totalLoss: baselineLoss + resourceDepletionLoss,
    enduranceBasisPoints,
  };
}

const ADAPTABLE_HAZARDS = new Set<SurvivalHazardCategory>([
  "ENVIRONMENT", "EXTREME_CONDITION", "CUSTOM",
]);

/**
 * Hazard order is exposure -> resilience -> applicable adaptability -> variance.
 * AWARENESS removes at most 40%, RESILIENCE removes at most 50%, and
 * ADAPTABILITY removes at most 25% for environment/extreme/custom hazards.
 * Hazard variance is +/-5%; LUCK shifts it favorably by at most +/-0.5%.
 */
export function survivalHazardImpact(
  category: SurvivalHazardCategory,
  intensity: number,
  profile: SurvivalProfileV1,
  variability: number,
  rng: SurvivalRandom,
): HazardImpactResult {
  const exposureBasisPoints = 10_000 - profile.awareness * 40;
  const resilienceBasisPoints = 10_000 - profile.resilience * 50;
  const adaptabilityBasisPoints = ADAPTABLE_HAZARDS.has(category)
    ? 10_000 - profile.adaptability * 25
    : 10_000;
  let variabilityBasisPoints = 0;
  if (variability > 0) {
    const raw = (rng.nextUint32() % 1_001) - 500;
    const randomPart = Math.trunc(raw * variability / 100);
    const luckBias = Math.trunc((50 - profile.luck) * variability / 100);
    variabilityBasisPoints = clamp(randomPart + luckBias, -500, 500);
  }

  const conditionBase = intensity * 80;
  const energyBase = category === "RESOURCE_SHORTAGE" ? intensity * 80
    : category === "FATIGUE" ? intensity * 40
      : category === "EXTREME_CONDITION" ? intensity * 20 : 0;
  const suppliesBase = category === "RESOURCE_SHORTAGE" ? intensity * 100 : 0;
  const efficiencyBasisPoints = 10_000 - profile.resourceEfficiency * 50;
  const varianceBasisPoints = 10_000 + variabilityBasisPoints;
  const conditionLoss = intensity === 0 ? 0 : Math.max(1, scaled(
    scaled(scaled(scaled(conditionBase, exposureBasisPoints), resilienceBasisPoints), adaptabilityBasisPoints),
    varianceBasisPoints,
  ));
  const resourceLoss = (base: number) => base === 0 ? 0 : Math.max(1, scaled(
    scaled(scaled(scaled(base, exposureBasisPoints), efficiencyBasisPoints), adaptabilityBasisPoints),
    varianceBasisPoints,
  ));
  return {
    conditionLoss,
    energyLoss: resourceLoss(energyBase),
    suppliesLoss: resourceLoss(suppliesBase),
    exposureBasisPoints,
    resilienceBasisPoints,
    adaptabilityBasisPoints,
    variabilityBasisPoints,
  };
}

/** Recovery consumes configured resources and restores bounded condition. */
export function survivalRecovery(
  tick: number,
  condition: number,
  energy: number,
  supplies: number,
  eliminationThreshold: number,
  profile: SurvivalProfileV1,
  recovery: SurvivalConfigV1["recovery"],
): RecoveryResult {
  const adaptabilityBasisPoints = 7_500 + profile.adaptability * 25;
  const eligible = recovery.amount > 0 && tick % recovery.intervalTicks === 0 &&
    condition > eliminationThreshold && condition < SURVIVAL_CONDITION_MAX &&
    energy >= recovery.energyCost && supplies >= recovery.suppliesCost;
  if (!eligible) {
    return { conditionRecovered: 0, energyCost: 0, suppliesCost: 0, adaptabilityBasisPoints };
  }
  const conditionRecovered = Math.min(
    SURVIVAL_CONDITION_MAX - condition,
    scaled(recovery.amount, adaptabilityBasisPoints),
  );
  if (conditionRecovered < 1) {
    return { conditionRecovered: 0, energyCost: 0, suppliesCost: 0, adaptabilityBasisPoints };
  }
  return {
    conditionRecovered,
    energyCost: recovery.energyCost,
    suppliesCost: recovery.suppliesCost,
    adaptabilityBasisPoints,
  };
}
