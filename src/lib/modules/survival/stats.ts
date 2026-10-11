import { z } from "zod";
import { EngineExecutionError } from "@/lib/engine/module";
import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import { SURVIVAL_STAT_NAMES, type SurvivalConfigV1, type SurvivalStatName } from "./config";

export const SURVIVAL_STAT_DEFAULT = 50;

export const survivalProfileSchema = z.object({
  endurance: z.number().int().min(0).max(100),
  resilience: z.number().int().min(0).max(100),
  resourceEfficiency: z.number().int().min(0).max(100),
  adaptability: z.number().int().min(0).max(100),
  awareness: z.number().int().min(0).max(100),
  luck: z.number().int().min(0).max(100),
}).strict();
export type SurvivalProfileV1 = z.infer<typeof survivalProfileSchema>;

/** Resolve generic NUMBER attributes exactly once from the immutable Run snapshot. */
export function resolveSurvivalProfile(
  participant: ParticipantSnapshotV1,
  mapping: SurvivalConfigV1["statMapping"],
): SurvivalProfileV1 {
  const values = Object.fromEntries(
    SURVIVAL_STAT_NAMES.map((name) => [name, SURVIVAL_STAT_DEFAULT]),
  ) as Record<SurvivalStatName, number>;
  for (const stat of SURVIVAL_STAT_NAMES) {
    const key = mapping[stat];
    const matches = participant.attributes.filter((attribute) => attribute.key.trim().toLowerCase() === key);
    if (matches.length === 0) continue;
    const attribute = matches[0]!;
    if (matches.length !== 1 || attribute.dataType !== "NUMBER" || attribute.value.trim() === "") {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "A Survival participant stat is invalid.");
    }
    const numeric = Number(attribute.value);
    if (!Number.isFinite(numeric)) {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "A Survival participant stat is invalid.");
    }
    values[stat] = Math.max(0, Math.min(100, Math.round(numeric)));
  }
  return survivalProfileSchema.parse(values);
}
