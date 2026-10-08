import { z } from "zod";
import { SEED_REGEX } from "@/lib/simulations/seed";
import {
  TOURNAMENT_FORMATS, TOURNAMENT_RESULT_SNAPSHOT_VERSION, TOURNAMENT_SEEDING_METHODS,
  TOURNAMENT_SNAPSHOT_VERSION, TOURNAMENT_TIEBREAKERS, TOURNAMENT_TIE_POLICIES,
} from "./constants";

const optionalText = (max: number) => z.union([z.literal(""), z.string().trim().max(max)]).optional()
  .transform((value) => value || undefined);
const optionalId = z.union([z.literal(""), z.string().trim().min(1).max(200)]).optional()
  .transform((value) => value || undefined);
const dateInput = z.union([z.string().datetime({ offset: true }), z.date()]).optional()
  .transform((value) => value ? new Date(value) : undefined);

export const tournamentParticipantInputSchema = z.object({
  entityId: z.string().trim().min(1).max(200),
  seed: z.number().int().positive().optional(),
  teamMetadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const tournamentShape = {
  name: z.string().trim().min(1, "Name is required.").max(160),
  description: optionalText(4000),
  projectId: optionalId,
  simulationTemplateId: z.string().trim().min(1).max(200),
  format: z.enum(TOURNAMENT_FORMATS),
  participants: z.array(tournamentParticipantInputSchema).min(2).max(128),
  seedingMethod: z.enum(TOURNAMENT_SEEDING_METHODS).default("MANUAL"),
  randomSeed: z.string().trim().toUpperCase().regex(SEED_REGEX).optional(),
  tiePolicy: z.enum(TOURNAMENT_TIE_POLICIES).default("NO_TIES_ALLOWED"),
  winPoints: z.number().int().min(-1000).max(1000).default(3),
  tiePoints: z.number().int().min(-1000).max(1000).default(1),
  lossPoints: z.number().int().min(-1000).max(1000).default(0),
  tiebreakers: z.array(z.enum(TOURNAMENT_TIEBREAKERS)).min(1).max(3).default(["POINTS", "WINS", "HEAD_TO_HEAD"]),
  scheduledStartAt: dateInput,
  worldId: optionalId,
  worldVersion: z.number().int().positive().optional(),
  experienceProfileId: optionalId,
  experienceProfileVersion: z.number().int().positive().optional(),
};

export const createTournamentSchema = z.object(tournamentShape).strict().superRefine(validateTournamentInput);
export const updateTournamentSchema = z.object(tournamentShape).partial().strict();

const nullableDateInput = z.union([z.string().datetime({ offset: true }), z.date(), z.null()])
  .transform((value) => value ? new Date(value) : null);
export const tournamentScheduleSchema = z.object({
  scheduledStartAt: nullableDateInput.optional(),
  rounds: z.array(z.object({ roundId: z.string().min(1).max(200), startsAt: nullableDateInput }).strict()).max(64).default([]),
  matches: z.array(z.object({ matchId: z.string().min(1).max(200), scheduledAt: nullableDateInput }).strict()).max(1000).default([]),
}).strict();

function validateTournamentInput(value: z.infer<z.ZodObject<typeof tournamentShape>>, context: z.RefinementCtx) {
  const ids = new Set<string>();
  const seeds = new Set<number>();
  value.participants.forEach((participant, index) => {
    if (ids.has(participant.entityId)) context.addIssue({ code: "custom", path: ["participants", index, "entityId"], message: "Participants must be unique." });
    ids.add(participant.entityId);
    if (value.seedingMethod === "MANUAL") {
      const seed = participant.seed ?? index + 1;
      if (seeds.has(seed)) context.addIssue({ code: "custom", path: ["participants", index, "seed"], message: "Manual seeds must be unique." });
      seeds.add(seed);
    }
  });
  if ((value.worldId && !value.worldVersion) || (!value.worldId && value.worldVersion)) context.addIssue({ code: "custom", path: ["worldId"], message: "Choose both a World and version." });
  if ((value.experienceProfileId && !value.experienceProfileVersion) || (!value.experienceProfileId && value.experienceProfileVersion)) context.addIssue({ code: "custom", path: ["experienceProfileId"], message: "Choose both an Experience Profile and version." });
}

export const tournamentSimulationSnapshotSchema = z.object({
  snapshotVersion: z.literal(TOURNAMENT_SNAPSHOT_VERSION),
  sourceSimulationId: z.string().min(1),
  sourceSimulationName: z.string().min(1),
  projectId: z.string().min(1),
  mode: z.string().min(1),
  seed: z.string().regex(SEED_REGEX),
  configVersion: z.number().int().positive(),
  configuration: z.record(z.string(), z.unknown()),
  presentation: z.record(z.string(), z.unknown()),
  worldId: z.string().nullable(),
  worldVersion: z.number().int().positive().nullable(),
  experienceProfileId: z.string().nullable(),
  experienceProfileVersion: z.number().int().positive().nullable(),
}).strict();
export type TournamentSimulationSnapshot = z.infer<typeof tournamentSimulationSnapshotSchema>;

export const competitionMatchResultSchema = z.object({
  snapshotVersion: z.literal(TOURNAMENT_RESULT_SNAPSHOT_VERSION),
  winnerTournamentParticipantId: z.string().nullable(),
  tiedTournamentParticipantIds: z.array(z.string()),
  ranking: z.array(z.string()),
  completed: z.literal(true),
  sourceRunId: z.string().min(1),
  sourceModule: z.string().min(1),
  sourceModuleVersion: z.string().min(1),
  completionReason: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
}).strict();
export type CompetitionMatchResult = z.infer<typeof competitionMatchResultSchema>;

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
