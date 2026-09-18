import { z } from "zod";
import { EngineExecutionError } from "@/lib/engine/module";
import type { InputSnapshotV1 } from "@/lib/engine/schemas";

export const BATTLE_MODULE_ID = "battle";
export const BATTLE_MODULE_VERSION = "battle-v1";
export const BATTLE_CONFIG_VERSION = 1;
export const BATTLE_STATE_VERSION = 1;
export const BATTLE_RESULT_VERSION = 1;
export const DEFAULT_BATTLE_MAX_TICKS = 120;
export const MAX_BATTLE_TICKS = 160;
export const BATTLE_MAX_HEALTH = 100;

export const executableBattleFormatSchema = z.enum(["duel", "free_for_all"]);
export type ExecutableBattleFormat = z.infer<typeof executableBattleFormatSchema>;

export const battleExecutionConfigSchema = z.object({
  version: z.literal(BATTLE_CONFIG_VERSION),
  format: executableBattleFormatSchema,
  maxTicks: z.number().int().min(1).max(MAX_BATTLE_TICKS),
  allowTies: z.boolean(),
}).strict();
export type BattleExecutionConfigV1 = z.infer<typeof battleExecutionConfigSchema>;

/** READY remains configuration readiness; this reports Battle v1 execution eligibility. */
export function battleExecutionIssue(format: unknown, participantCount: number): string | null {
  if (format === "team") return "Team Battle execution is not supported yet.";
  if (!executableBattleFormatSchema.safeParse(format).success) return "Battle configuration is invalid.";
  if (format === "duel" && participantCount !== 2) return "A duel requires exactly two participants.";
  if (format === "free_for_all" && participantCount < 2) return "Free-for-all requires at least two participants.";
  return null;
}

/** Existing Phase 2 format and roundLimit values are interpreted without migration. */
export function resolveBattleExecutionConfig(input: InputSnapshotV1): BattleExecutionConfigV1 {
  const format = input.configuration.mode.format;
  const issue = battleExecutionIssue(format, input.participants.length);
  if (issue) throw new EngineExecutionError("INVALID_EXECUTION_INPUT", issue);
  const result = battleExecutionConfigSchema.safeParse({
    version: BATTLE_CONFIG_VERSION,
    format,
    maxTicks: Math.min(input.configuration.general.roundLimit ?? DEFAULT_BATTLE_MAX_TICKS, MAX_BATTLE_TICKS),
    allowTies: input.configuration.general.allowTies,
  });
  if (!result.success) throw new EngineExecutionError("INVALID_EXECUTION_INPUT", "Battle configuration is invalid.");
  return result.data;
}
