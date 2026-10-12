import { z } from "zod";
import { defaultConfigV1, type SimulationConfigV1 } from "@/lib/simulations/config";
import { ANYTHING_WARS_EVENT_MODES, type AnythingWarsEventMode } from "./constants";

export const QUICK_CREATIONS_PROJECT_PURPOSE = "anything-wars-quick";
export const QUICK_CREATIONS_PROJECT_VERSION = 1;

export const quickWarInputSchema = z.object({
  mode: z.enum(ANYTHING_WARS_EVENT_MODES),
  participantIds: z.array(z.string().trim().min(1)).min(2, "Choose at least two competitors.").max(500, "Choose at most 500 competitors."),
}).strict().superRefine((value, context) => {
  if (new Set(value.participantIds).size !== value.participantIds.length) {
    context.addIssue({ code: "custom", path: ["participantIds"], message: "Choose each competitor once." });
  }
});

export type QuickWarInput = z.infer<typeof quickWarInputSchema>;

/** Existing canonical defaults, with a friendly 1v1 Battle choice when exactly two compete. */
export function quickWarConfiguration(mode: AnythingWarsEventMode, participantCount: number): SimulationConfigV1 {
  const configuration = defaultConfigV1(mode);
  if (mode === "battle") {
    configuration.mode = { format: participantCount === 2 ? "duel" : "free_for_all" };
  }
  return configuration;
}

export function quickWarName(mode: AnythingWarsEventMode, participantNames: readonly string[]): string {
  const modeLabel = mode === "battle" ? "Battle" : mode === "race" ? "Race" : "Survival";
  const name = participantNames.length === 2
    ? `${participantNames[0]} vs ${participantNames[1]} — ${modeLabel}`
    : participantNames.length > 2
      ? `${participantNames[0]} + ${participantNames.length - 1} more — ${modeLabel}`
      : `Quick ${modeLabel}`;
  return name.length <= 120 ? name : `${name.slice(0, 119)}…`;
}
