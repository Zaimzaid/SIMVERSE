export const ANYTHING_WARS_PRODUCT_ID = "anything-wars";
export const ANYTHING_WARS_PRODUCT_VERSION = 0;

/** Modes backed by a normal Simulation and SimulationRun in Anything Wars v0. */
export const ANYTHING_WARS_EVENT_MODES = ["battle", "race", "survival"] as const;
export type AnythingWarsEventMode = (typeof ANYTHING_WARS_EVENT_MODES)[number];

/** Tournament is composed through the existing Tournament system. */
export const ANYTHING_WARS_MODES = [...ANYTHING_WARS_EVENT_MODES, "tournament"] as const;
export type AnythingWarsMode = (typeof ANYTHING_WARS_MODES)[number];

export const ANYTHING_WARS_FUTURE_MODES = [
  "Economy",
  "Civilization",
  "Sports",
  "Strategy",
  "Random",
] as const;

export interface AnythingWarsMetadata {
  product: typeof ANYTHING_WARS_PRODUCT_ID;
  productVersion: typeof ANYTHING_WARS_PRODUCT_VERSION;
}

export function anythingWarsMetadata(
  source?: Record<string, unknown> | null,
): Record<string, unknown> & AnythingWarsMetadata {
  return {
    ...(source ?? {}),
    product: ANYTHING_WARS_PRODUCT_ID,
    productVersion: ANYTHING_WARS_PRODUCT_VERSION,
  };
}

export function isAnythingWarsMetadata(value: Record<string, unknown> | null): boolean {
  return value?.product === ANYTHING_WARS_PRODUCT_ID &&
    value.productVersion === ANYTHING_WARS_PRODUCT_VERSION;
}

export function isAnythingWarsEventMode(value: string): value is AnythingWarsEventMode {
  return (ANYTHING_WARS_EVENT_MODES as readonly string[]).includes(value);
}
import { battleExecutionIssue } from "@/lib/modules/battle/config";
import { raceExecutionIssue, RACE_MAX_PARTICIPANTS } from "@/lib/modules/race/config";
import { survivalExecutionIssue, SURVIVAL_MAX_PARTICIPANTS } from "@/lib/modules/survival/config";


export function anythingWarsParticipantLimit(mode: string): number | undefined {
  if (mode === "race") return RACE_MAX_PARTICIPANTS;
  if (mode === "survival") return SURVIVAL_MAX_PARTICIPANTS;
  return undefined;
}

/** Mirrors the existing module eligibility checks without adding product mechanics. */
export function anythingWarsExecutionIssue(
  mode: string,
  configuration: Record<string, unknown>,
  participantCount: number,
): string | null {
  if (mode === "battle") return battleExecutionIssue(configuration.format, participantCount);
  if (mode === "race") return raceExecutionIssue(configuration, participantCount);
  if (mode === "survival") return survivalExecutionIssue(configuration, participantCount);
  return "Anything Wars v0 does not support this mode.";
}
