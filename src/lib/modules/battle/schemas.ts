import { z } from "zod";
import { BATTLE_MAX_HEALTH, BATTLE_RESULT_VERSION, BATTLE_STATE_VERSION, battleExecutionConfigSchema } from "./config";
import { battleProfileSchema } from "./stats";

const metric = z.number().int().nonnegative();
export const battleParticipantSchema = z.object({
  runParticipantId: z.string().min(1),
  position: z.number().int().nonnegative(),
  profile: battleProfileSchema,
  health: z.number().int().min(0).max(BATTLE_MAX_HEALTH),
  alive: z.boolean(),
  defending: z.boolean(),
  eliminationTick: z.number().int().positive().nullable(),
  damageDealt: metric,
  damageReceived: metric,
  attacksAttempted: metric,
  attacksLanded: metric,
  criticalHits: metric,
  dodges: metric,
  defends: metric,
}).strict();
export type BattleParticipantStateV1 = z.infer<typeof battleParticipantSchema>;

export const battleStateSchema = z.object({
  version: z.literal(BATTLE_STATE_VERSION),
  config: battleExecutionConfigSchema,
  round: z.number().int().positive(),
  turnQueue: z.array(z.string()),
  participants: z.array(battleParticipantSchema).min(2).max(500),
  eliminationOrder: z.array(z.string()),
  completionReason: z.enum(["KNOCKOUT", "TIME_LIMIT"]).nullable(),
}).strict();
export type BattleStateV1 = z.infer<typeof battleStateSchema>;

export const battleResultSchema = z.object({
  version: z.literal(BATTLE_RESULT_VERSION),
  format: z.enum(["duel", "free_for_all"]),
  completionReason: z.enum(["KNOCKOUT", "TIME_LIMIT"]),
  winnerRunParticipantId: z.string().nullable(),
  tiedParticipantIds: z.array(z.string()),
  ranking: z.array(z.string()),
  eliminationOrder: z.array(z.string()),
  totalTicks: z.number().int().positive(),
  simulatedDurationMs: z.number().int().positive(),
  participantMetrics: z.array(battleParticipantSchema),
}).strict();
export type BattleResultV1 = z.infer<typeof battleResultSchema>;

export const battleActionPayloads = {
  "battle.attack": { version: 1, schema: z.object({ decision: z.literal("attack") }).strict() },
  "battle.defend": { version: 1, schema: z.object({ reason: z.enum(["low_health", "tactical"]) }).strict() },
} as const;

export const battleEventPayloads = {
  "battle.started": { version: 1, schema: z.object({ format: z.enum(["duel", "free_for_all"]), maxTicks: z.number().int().positive(), participantIds: z.array(z.string()) }).strict() },
  "battle.defend": { version: 1, schema: z.object({ health: z.number().int().nonnegative(), duration: z.literal("until_next_action_or_hit") }).strict() },
  "battle.attack": { version: 1, schema: z.object({ baseDamage: z.number().int().nonnegative(), critical: z.boolean(), dodged: z.boolean(), guarded: z.boolean(), finalDamage: z.number().int().nonnegative(), targetHealthBefore: z.number().int().nonnegative(), targetHealthAfter: z.number().int().nonnegative() }).strict() },
  "battle.dodged": { version: 1, schema: z.object({ targetHealth: z.number().int().nonnegative() }).strict() },
  "battle.critical_hit": { version: 1, schema: z.object({ finalDamage: z.number().int().nonnegative() }).strict() },
  "battle.damage": { version: 1, schema: z.object({ amount: z.number().int().nonnegative(), healthBefore: z.number().int().nonnegative(), healthAfter: z.number().int().nonnegative(), guarded: z.boolean() }).strict() },
  "battle.eliminated": { version: 1, schema: z.object({ eliminationTick: z.number().int().positive(), eliminationRank: z.number().int().positive() }).strict() },
  "battle.timeout": { version: 1, schema: z.object({ maxTicks: z.number().int().positive(), survivors: z.number().int().nonnegative() }).strict() },
  "battle.completed": { version: 1, schema: z.object({ completionReason: z.enum(["KNOCKOUT", "TIME_LIMIT"]), winnerRunParticipantId: z.string().nullable(), tiedParticipantIds: z.array(z.string()), ranking: z.array(z.string()) }).strict() },
} as const;

export const battleResultPayloads = {
  "battle.result": { version: 1, schema: battleResultSchema },
} as const;
