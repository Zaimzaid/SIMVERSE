import { z } from "zod";
import { EngineExecutionError } from "@/lib/engine/module";
import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import { RACE_STAT_NAMES, type RaceConfigV1, type RaceStatName } from "./config";

export const RACE_STAT_DEFAULT = 50;

export const raceProfileSchema = z.object({
  speed: z.number().int().min(0).max(100),
  acceleration: z.number().int().min(0).max(100),
  handling: z.number().int().min(0).max(100),
  stamina: z.number().int().min(0).max(100),
  luck: z.number().int().min(0).max(100),
}).strict();
export type RaceProfileV1 = z.infer<typeof raceProfileSchema>;

/**
 * Resolve configured Entity NUMBER attributes once from the immutable Run snapshot.
 * Missing values default to 50. Present values are rounded and clamped to 0..100.
 */
export function resolveRaceProfile(
  participant: ParticipantSnapshotV1,
  mapping: RaceConfigV1["statMapping"],
): RaceProfileV1 {
  const values = Object.fromEntries(RACE_STAT_NAMES.map((name) => [name, RACE_STAT_DEFAULT])) as Record<RaceStatName, number>;
  for (const stat of RACE_STAT_NAMES) {
    const key = mapping[stat];
    const matches = participant.attributes.filter((attribute) => attribute.key.trim().toLowerCase() === key);
    if (matches.length === 0) continue;
    const attribute = matches[0]!;
    if (matches.length !== 1 || attribute.dataType !== "NUMBER" || attribute.value.trim() === "") {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "A Race participant stat is invalid.");
    }
    const numeric = Number(attribute.value);
    if (!Number.isFinite(numeric)) {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "A Race participant stat is invalid.");
    }
    values[stat] = Math.max(0, Math.min(100, Math.round(numeric)));
  }
  return raceProfileSchema.parse(values);
}
