import { z } from "zod";
import { EngineExecutionError } from "@/lib/engine/module";
import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";

export const BATTLE_STAT_DEFAULT = 50;
export const BATTLE_STAT_KEYS = ["strength", "defense", "speed", "intelligence", "luck"] as const;
export type BattleStatKey = (typeof BATTLE_STAT_KEYS)[number];

export const battleProfileSchema = z.object({
  strength: z.number().int().min(0).max(100),
  defense: z.number().int().min(0).max(100),
  speed: z.number().int().min(0).max(100),
  intelligence: z.number().int().min(0).max(100),
  luck: z.number().int().min(0).max(100),
}).strict();
export type BattleProfileV1 = z.infer<typeof battleProfileSchema>;

/** Resolve immutable snapshot attribute keys. Missing = 50; numeric values round and clamp to 0–100. */
export function resolveBattleProfile(participant: ParticipantSnapshotV1): BattleProfileV1 {
  const values: Record<BattleStatKey, number> = {
    strength: BATTLE_STAT_DEFAULT, defense: BATTLE_STAT_DEFAULT,
    speed: BATTLE_STAT_DEFAULT, intelligence: BATTLE_STAT_DEFAULT, luck: BATTLE_STAT_DEFAULT,
  };
  const seen = new Set<BattleStatKey>();
  for (const attribute of participant.attributes) {
    const key = attribute.key.trim().toLowerCase() as BattleStatKey;
    if (!BATTLE_STAT_KEYS.includes(key)) continue;
    if (seen.has(key) || attribute.dataType !== "NUMBER" || attribute.value.trim() === "") {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "A Battle participant stat is invalid.");
    }
    const numeric = Number(attribute.value);
    if (!Number.isFinite(numeric)) {
      throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "A Battle participant stat is invalid.");
    }
    values[key] = Math.max(0, Math.min(100, Math.round(numeric)));
    seen.add(key);
  }
  return battleProfileSchema.parse(values);
}
