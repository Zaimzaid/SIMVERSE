import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { SeededRng } from "@/lib/engine/rng";
import { productionEngineRegistry } from "@/lib/engine/registry";
import { raceExecutionIssue } from "@/lib/modules/race/config";
import { parseStoredConfig, parseStoredPresentation } from "@/lib/simulations/config";
import { generateSeed } from "@/lib/simulations/seed";
import {
  TOURNAMENT_MAX_PAGE_SIZE, TOURNAMENT_PAGE_SIZE, TOURNAMENT_SNAPSHOT_VERSION,
  isTournamentMatchState, isTournamentRoundState, isTournamentStatus,
  type TournamentFormat, type TournamentMatchState, type TournamentRoundState,
  type TournamentSort, type TournamentStatus, type TournamentStatusFilter, type TournamentTiebreaker,
} from "@/lib/tournaments/constants";
import { resultAdapterFor } from "@/lib/tournaments/result-adapter";
import {
  competitionMatchResultSchema, createTournamentSchema, tournamentScheduleSchema, tournamentSimulationSnapshotSchema,
  updateTournamentSchema, type CompetitionMatchResult, type CreateTournamentInput,
  type TournamentSimulationSnapshot,
} from "@/lib/tournaments/schemas";
import { parseOrThrow } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import {
  createSimulationRun, executeUntilComplete, getSimulationRun, startSimulationRun,
} from "./simulation-run-service";
import { requireMembership } from "./workspace-service";

const tournamentInclude = {
  createdBy: { select: { displayName: true } },
  project: { select: { name: true } },
  simulationTemplate: { select: { name: true, mode: true, status: true } },
  world: { select: { name: true } },
  experienceProfile: { select: { name: true } },
  participants: { include: { entity: { select: { name: true, category: true, status: true } } }, orderBy: { seed: "asc" as const } },
  rounds: { orderBy: { number: "asc" as const } },
  matches: {
    include: { simulationRun: { select: { status: true } } },
    orderBy: { matchNumber: "asc" as const },
  },
} satisfies Prisma.TournamentInclude;
type TournamentRow = Prisma.TournamentGetPayload<{ include: typeof tournamentInclude }>;

export interface TournamentStanding {
  rank: number;
  tournamentParticipantId: string;
  entityId: string;
  displayName: string;
  seed: number;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
}

export interface TournamentView {
  id: string; workspaceId: string; projectId: string | null; projectName: string | null;
  simulationTemplateId: string; simulationTemplateName: string; name: string; slug: string;
  description: string | null; status: TournamentStatus; archivedFromStatus: TournamentStatus | null;
  format: TournamentFormat; participantType: "ENTITY"; moduleKey: string;
  seedingMethod: "MANUAL" | "RANDOM"; randomSeed: string; tiePolicy: "NO_TIES_ALLOWED" | "REPLAY_MATCH";
  winPoints: number; tiePoints: number; lossPoints: number; tiebreakers: TournamentTiebreaker[];
  scheduledStartAt: Date | null; worldId: string | null; worldVersion: number | null; worldName: string | null;
  experienceProfileId: string | null; experienceProfileVersion: number | null; experienceProfileName: string | null;
  simulationSnapshot: TournamentSimulationSnapshot | null; championParticipantId: string | null;
  tiedChampionParticipantIds: string[]; finalStandings: TournamentStanding[] | null; executionError: string | null;
  participants: Array<{ id: string; entityId: string; displayName: string; seed: number; position: number; status: string; entityCategory: string; entityStatus: string }>;
  rounds: Array<{ id: string; number: number; label: string; state: TournamentRoundState; startsAt: Date | null; completedAt: Date | null; matchCount: number }>;
  matches: Array<{ id: string; roundId: string; matchNumber: number; state: TournamentMatchState; participantOneId: string | null; participantTwoId: string | null; winnerParticipantId: string | null; nextMatchId: string | null; nextSlot: number | null; replayOfMatchId: string | null; simulationId: string | null; simulationRunId: string | null; runStatus: string | null; result: CompetitionMatchResult | null; scheduledAt: Date | null; startedAt: Date | null; completedAt: Date | null }>;
  standings: TournamentStanding[]; createdByName: string | null; createdAt: Date; updatedAt: Date;
  startedAt: Date | null; pausedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null; archivedAt: Date | null;
}

export interface ListTournamentsParams {
  search?: string; status?: TournamentStatusFilter; format?: TournamentFormat; module?: string;
  projectId?: string; creatorId?: string; sort?: TournamentSort; page?: number; pageSize?: number;
}

function validatedTournamentTemplateConfig(template: {
  status: string;
  mode: string;
  configuration: string | null;
}) {
  if (template.status !== "READY") {
    throw new ValidationError("Choose a READY supported Simulation template from this workspace.");
  }
  const config = parseStoredConfig(template.configuration, template.mode);
  const module = productionEngineRegistry.forMode(template.mode);
  if (!module) {
    throw new ValidationError("Choose a READY supported Simulation template from this workspace.");
  }
  try {
    resultAdapterFor(module.id, module.version);
  } catch {
    throw new ValidationError("That Simulation module cannot provide Tournament results.");
  }
  if (template.mode === "battle") {
    if (config.mode.format !== "duel") {
      throw new ValidationError("Tournament Battle templates must use duel format.");
    }
  } else if (template.mode === "race") {
    const issue = raceExecutionIssue(config.mode, 2);
    if (issue) throw new ValidationError(issue);
  } else {
    throw new ValidationError("That Simulation mode is not supported for Tournament matches.");
  }
  return config;
}

function storedStatus(value: string): TournamentStatus {
  if (!isTournamentStatus(value)) throw new ConflictError("Stored Tournament status is invalid.");
  return value;
}
function storedFormat(value: string): TournamentFormat {
  if (value !== "SINGLE_ELIMINATION" && value !== "ROUND_ROBIN") throw new ConflictError("Stored Tournament format is invalid.");
  return value;
}
function parseJson<T>(value: string | null, parse: (input: unknown) => T, label: string): T | null {
  if (!value) return null;
  try { return parse(JSON.parse(value)); } catch { throw new ConflictError(`Stored Tournament ${label} is invalid.`); }
}
function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try { const result: unknown = JSON.parse(value); if (Array.isArray(result) && result.every((item) => typeof item === "string")) return result; } catch { /* handled below */ }
  throw new ConflictError("Stored Tournament participant outcome is invalid.");
}
function parseTiebreakers(value: string): TournamentTiebreaker[] {
  try {
    const result: unknown = JSON.parse(value);
    if (Array.isArray(result) && result.length && result.every((item) => item === "POINTS" || item === "WINS" || item === "HEAD_TO_HEAD")) return result;
  } catch { /* handled below */ }
  throw new ConflictError("Stored Tournament tiebreakers are invalid.");
}

function standingsForRow(row: TournamentRow): TournamentStanding[] {
  const entries = new Map(row.participants.map((participant) => [participant.id, {
    rank: 0, tournamentParticipantId: participant.id, entityId: participant.entityId,
    displayName: participant.displayName, seed: participant.seed, played: 0, wins: 0, losses: 0, ties: 0, points: 0,
  }]));
  const headToHead: Array<{ first: string; second: string; winner: string | null }> = [];
  for (const match of row.matches) {
    const result = parseJson(match.resultSnapshot, competitionMatchResultSchema.parse.bind(competitionMatchResultSchema), "Match result");
    if (!result || !match.participantOneId || !match.participantTwoId || match.replayOfMatchId) continue;
    const first = entries.get(match.participantOneId); const second = entries.get(match.participantTwoId);
    if (!first || !second) continue;
    first.played += 1; second.played += 1;
    if (result.winnerTournamentParticipantId) {
      const winner = entries.get(result.winnerTournamentParticipantId);
      const loser = result.winnerTournamentParticipantId === first.tournamentParticipantId ? second : first;
      if (!winner) throw new ConflictError("Stored Match winner is invalid.");
      winner.wins += 1; winner.points += row.winPoints; loser.losses += 1; loser.points += row.lossPoints;
      headToHead.push({ first: first.tournamentParticipantId, second: second.tournamentParticipantId, winner: winner.tournamentParticipantId });
    } else {
      first.ties += 1; second.ties += 1; first.points += row.tiePoints; second.points += row.tiePoints;
      headToHead.push({ first: first.tournamentParticipantId, second: second.tournamentParticipantId, winner: null });
    }
  }
  const tiebreakers = parseTiebreakers(row.tiebreakers);
  let groups: TournamentStanding[][] = [[...entries.values()]];
  const splitBy = (group: TournamentStanding[], score: (entry: TournamentStanding) => number) => {
    const sorted = [...group].sort((left, right) => score(right) - score(left) || left.seed - right.seed);
    const split: TournamentStanding[][] = [];
    for (const entry of sorted) {
      const current = split.at(-1);
      if (!current || score(current[0]!) !== score(entry)) split.push([entry]); else current.push(entry);
    }
    return split;
  };
  for (const rule of tiebreakers) {
    groups = groups.flatMap((group) => {
      if (group.length < 2) return [group];
      if (rule === "POINTS") return splitBy(group, (entry) => entry.points);
      if (rule === "WINS") return splitBy(group, (entry) => entry.wins);
      const ids = new Set(group.map((entry) => entry.tournamentParticipantId));
      const miniPoints = new Map(group.map((entry) => [entry.tournamentParticipantId, 0]));
      for (const result of headToHead) {
        if (!ids.has(result.first) || !ids.has(result.second)) continue;
        if (result.winner) miniPoints.set(result.winner, (miniPoints.get(result.winner) ?? 0) + row.winPoints);
        else {
          miniPoints.set(result.first, (miniPoints.get(result.first) ?? 0) + row.tiePoints);
          miniPoints.set(result.second, (miniPoints.get(result.second) ?? 0) + row.tiePoints);
        }
      }
      return splitBy(group, (entry) => miniPoints.get(entry.tournamentParticipantId) ?? 0);
    });
  }
  const ranked: TournamentStanding[] = []; let position = 1;
  for (const group of groups) {
    for (const entry of [...group].sort((left, right) => left.seed - right.seed)) { entry.rank = position; ranked.push(entry); }
    position += group.length;
  }
  return ranked;
}

function toTournamentView(row: TournamentRow): TournamentView {
  const standings = row.format === "ROUND_ROBIN" ? standingsForRow(row) : [];
  return {
    id: row.id, workspaceId: row.workspaceId, projectId: row.projectId, projectName: row.project?.name ?? null,
    simulationTemplateId: row.simulationTemplateId, simulationTemplateName: row.simulationTemplate.name,
    name: row.name, slug: row.slug, description: row.description, status: storedStatus(row.status),
    archivedFromStatus: row.archivedFromStatus && isTournamentStatus(row.archivedFromStatus) ? row.archivedFromStatus : null,
    format: storedFormat(row.format), participantType: "ENTITY", moduleKey: row.moduleKey,
    seedingMethod: row.seedingMethod === "RANDOM" ? "RANDOM" : "MANUAL", randomSeed: row.randomSeed,
    tiePolicy: row.tiePolicy === "REPLAY_MATCH" ? "REPLAY_MATCH" : "NO_TIES_ALLOWED",
    winPoints: row.winPoints, tiePoints: row.tiePoints, lossPoints: row.lossPoints, tiebreakers: parseTiebreakers(row.tiebreakers),
    scheduledStartAt: row.scheduledStartAt, worldId: row.worldId, worldVersion: row.worldVersion, worldName: row.world?.name ?? null,
    experienceProfileId: row.experienceProfileId, experienceProfileVersion: row.experienceProfileVersion,
    experienceProfileName: row.experienceProfile?.name ?? null,
    simulationSnapshot: parseJson(row.simulationSnapshot, tournamentSimulationSnapshotSchema.parse.bind(tournamentSimulationSnapshotSchema), "Simulation snapshot"),
    championParticipantId: row.championParticipantId, tiedChampionParticipantIds: parseStringArray(row.tiedChampionParticipantIds),
    finalStandings: row.finalStandingsSnapshot ? parseJson(row.finalStandingsSnapshot, (input) => input as TournamentStanding[], "final standings") : null,
    executionError: row.executionError,
    participants: row.participants.map((participant) => ({ id: participant.id, entityId: participant.entityId, displayName: participant.displayName, seed: participant.seed, position: participant.position, status: participant.status, entityCategory: participant.entity.category, entityStatus: participant.entity.status })),
    rounds: row.rounds.map((round) => ({ id: round.id, number: round.number, label: round.label, state: isTournamentRoundState(round.state) ? round.state : "PENDING", startsAt: round.startsAt, completedAt: round.completedAt, matchCount: row.matches.filter((match) => match.roundId === round.id).length })),
    matches: row.matches.map((match) => ({ id: match.id, roundId: match.roundId, matchNumber: match.matchNumber, state: isTournamentMatchState(match.state) ? match.state : "PENDING", participantOneId: match.participantOneId, participantTwoId: match.participantTwoId, winnerParticipantId: match.winnerParticipantId, nextMatchId: match.nextMatchId, nextSlot: match.nextSlot, replayOfMatchId: match.replayOfMatchId, simulationId: match.simulationId, simulationRunId: match.simulationRunId, runStatus: match.simulationRun?.status ?? null, result: parseJson(match.resultSnapshot, competitionMatchResultSchema.parse.bind(competitionMatchResultSchema), "Match result"), scheduledAt: match.scheduledAt, startedAt: match.startedAt, completedAt: match.completedAt })),
    standings, createdByName: row.createdBy?.displayName ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt,
    startedAt: row.startedAt, pausedAt: row.pausedAt, completedAt: row.completedAt, cancelledAt: row.cancelledAt, archivedAt: row.archivedAt,
  };
}

async function loadTournament(workspaceId: string, tournamentId: string): Promise<TournamentRow> {
  const row = await prisma.tournament.findFirst({ where: { id: tournamentId, workspaceId }, include: tournamentInclude });
  if (!row) throw new NotFoundError("Tournament not found.");
  return row;
}

export async function getTournament(userId: string, workspaceId: string, tournamentId: string) {
  await requireMembership(userId, workspaceId, "tournament.view");
  return toTournamentView(await loadTournament(workspaceId, tournamentId));
}

export async function listTournaments(userId: string, workspaceId: string, params: ListTournamentsParams = {}) {
  await requireMembership(userId, workspaceId, "tournament.view");
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(TOURNAMENT_MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? TOURNAMENT_PAGE_SIZE)));
  const where: Prisma.TournamentWhereInput = { workspaceId };
  const status = params.status ?? "CURRENT";
  if (status === "CURRENT") where.status = { not: "ARCHIVED" }; else if (status !== "ALL") where.status = status;
  if (params.format) where.format = params.format;
  if (params.module) where.moduleKey = params.module;
  if (params.projectId) where.projectId = params.projectId;
  if (params.creatorId) where.createdById = params.creatorId;
  if (params.search?.trim()) where.OR = [{ name: { contains: params.search.trim() } }, { description: { contains: params.search.trim() } }];
  const orderBy: Prisma.TournamentOrderByWithRelationInput[] = params.sort === "name_asc" ? [{ name: "asc" }, { id: "asc" }] : params.sort === "name_desc" ? [{ name: "desc" }, { id: "asc" }] : params.sort === "updated_asc" ? [{ updatedAt: "asc" }, { id: "asc" }] : params.sort === "start_asc" ? [{ scheduledStartAt: { sort: "asc", nulls: "last" } }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "asc" }];
  const [total, rows] = await Promise.all([prisma.tournament.count({ where }), prisma.tournament.findMany({ where, include: tournamentInclude, orderBy, skip: (page - 1) * pageSize, take: pageSize })]);
  return { items: rows.map(toTournamentView), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listTournamentCreationOptions(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const [entities, projects, simulations, worlds, experiences] = await Promise.all([
    prisma.entity.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.simulation.findMany({ where: { workspaceId, status: "READY", mode: { in: ["battle", "race"] } }, select: { id: true, name: true, mode: true, status: true, projectId: true, configuration: true, worldId: true, worldVersion: true, experienceProfileId: true, experienceProfileVersion: true }, orderBy: { name: "asc" } }),
    prisma.world.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true, versions: { select: { version: true, status: true }, orderBy: { version: "desc" } } }, orderBy: { name: "asc" } }),
    prisma.experienceProfile.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true, versions: { select: { version: true, status: true, modeCompatibility: true }, orderBy: { version: "desc" } } }, orderBy: { name: "asc" } }),
  ]);
  return {
    entities,
    projects,
    simulations: simulations.filter((simulation) => {
      try { validatedTournamentTemplateConfig(simulation); return true; }
      catch { return false; }
    }),
    worlds: worlds.flatMap((world) => world.versions.filter((version) => version.status !== "ARCHIVED").map((version) => ({ worldId: world.id, worldName: world.name, version: version.version }))),
    experiences: experiences.flatMap((profile) => profile.versions.filter((version) => {
      if (version.status === "ARCHIVED") return false;
      try { const modes: unknown = JSON.parse(version.modeCompatibility); return Array.isArray(modes) && modes.some((mode) => mode === "battle" || mode === "race"); } catch { return false; }
    }).map((version) => ({ experienceProfileId: profile.id, experienceProfileName: profile.name, version: version.version }))),
  };
}

async function availableSlug(tx: Prisma.TransactionClient, workspaceId: string, name: string, excludeId?: string) {
  const base = slugify(name) || "tournament"; let candidate = base; let suffix = 2;
  while (await tx.tournament.findFirst({ where: { workspaceId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) candidate = `${base}-${suffix++}`;
  return candidate;
}

async function validateBindings(tx: Prisma.TransactionClient, workspaceId: string, data: CreateTournamentInput) {
  const template = await tx.simulation.findFirst({ where: { id: data.simulationTemplateId, workspaceId }, select: { id: true, name: true, projectId: true, mode: true, status: true, seed: true, configVersion: true, configuration: true, presentation: true, worldId: true, worldVersion: true, experienceProfileId: true, experienceProfileVersion: true } });
  if (!template) throw new ValidationError("Choose a READY supported Simulation template from this workspace.");
  validatedTournamentTemplateConfig(template);
  if (data.projectId && !(await tx.project.findFirst({ where: { id: data.projectId, workspaceId, status: { not: "ARCHIVED" } }, select: { id: true } }))) throw new ValidationError("Choose an active Project from this workspace.");
  const entityIds = [...new Set(data.participants.map((participant) => participant.entityId))];
  const entities = await tx.entity.findMany({ where: { id: { in: entityIds }, workspaceId }, select: { id: true, name: true, category: true, status: true } });
  if (entities.length !== entityIds.length || entities.some((entity) => entity.status === "ARCHIVED")) throw new ValidationError("Every Tournament participant must be an active Entity in this workspace.");
  const worldId = data.worldId ?? template.worldId; const worldVersion = data.worldVersion ?? template.worldVersion;
  if ((worldId && !worldVersion) || (!worldId && worldVersion)) throw new ValidationError("Choose both a World and immutable version.");
  if (worldId && !(await tx.worldVersion.findFirst({ where: { worldId, version: worldVersion!, world: { workspaceId, status: { not: "ARCHIVED" } } }, select: { id: true } }))) throw new ValidationError("Choose an active World version from this workspace.");
  const experienceProfileId = data.experienceProfileId ?? template.experienceProfileId;
  const experienceProfileVersion = data.experienceProfileVersion ?? template.experienceProfileVersion;
  if ((experienceProfileId && !experienceProfileVersion) || (!experienceProfileId && experienceProfileVersion)) throw new ValidationError("Choose both an Experience Profile and immutable version.");
  if (experienceProfileId) {
    const version = await tx.experienceProfileVersion.findFirst({ where: { experienceProfileId, version: experienceProfileVersion!, experienceProfile: { workspaceId, status: { not: "ARCHIVED" } } }, select: { status: true, modeCompatibility: true } });
    let compatible = false;
    try { const modes: unknown = version ? JSON.parse(version.modeCompatibility) : []; compatible = Array.isArray(modes) && modes.includes(template.mode); } catch { compatible = false; }
    if (!version || version.status === "ARCHIVED" || !compatible) throw new ValidationError("Choose an active compatible Experience Profile version from this workspace.");
  }
  return { template, entities, worldId: worldId ?? null, worldVersion: worldVersion ?? null, experienceProfileId: experienceProfileId ?? null, experienceProfileVersion: experienceProfileVersion ?? null };
}

function seededParticipants(data: CreateTournamentInput, entities: Array<{ id: string; name: string; category: string }>) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const ordered = data.participants.map((input, position) => ({ input, position, entity: byId.get(input.entityId)! }));
  if (data.seedingMethod === "RANDOM") {
    const rng = SeededRng.fromSeed(data.randomSeed!);
    for (let index = ordered.length - 1; index > 0; index -= 1) { const target = Math.floor(rng.nextFloat() * (index + 1)); [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!]; }
  } else ordered.sort((left, right) => (left.input.seed ?? left.position + 1) - (right.input.seed ?? right.position + 1));
  return ordered.map((item, position) => ({ entityId: item.entity.id, displayName: item.entity.name, seed: position + 1, position, teamMetadata: item.input.teamMetadata ? JSON.stringify(item.input.teamMetadata) : null, snapshotMetadata: JSON.stringify({ sourceType: "ENTITY", category: item.entity.category }) }));
}

export async function createTournament(userId: string, workspaceId: string, input: unknown) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const parsed = parseOrThrow(createTournamentSchema, input);
  const data = { ...parsed, randomSeed: parsed.randomSeed ?? generateSeed() };
  const created = await prisma.$transaction(async (tx) => {
    const validated = await validateBindings(tx, workspaceId, data);
    return tx.tournament.create({ data: {
      workspaceId, projectId: data.projectId ?? null, simulationTemplateId: data.simulationTemplateId,
      name: data.name, slug: await availableSlug(tx, workspaceId, data.name), description: data.description ?? null,
      format: data.format, participantType: "ENTITY", moduleKey: validated.template.mode, seedingMethod: data.seedingMethod,
      randomSeed: data.randomSeed, tiePolicy: data.tiePolicy, winPoints: data.winPoints, tiePoints: data.tiePoints,
      lossPoints: data.lossPoints, tiebreakers: JSON.stringify(data.tiebreakers), scheduledStartAt: data.scheduledStartAt ?? null,
      worldId: validated.worldId, worldVersion: validated.worldVersion,
      experienceProfileId: validated.experienceProfileId, experienceProfileVersion: validated.experienceProfileVersion,
      createdById: userId, participants: { create: seededParticipants(data, validated.entities) },
    }, include: tournamentInclude });
  });
  await recordAudit({ action: "tournament.created", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: created.id, metadata: { name: created.name, format: created.format } });
  return toTournamentView(created);
}

function editableInput(row: TournamentRow): CreateTournamentInput {
  return {
    name: row.name, description: row.description ?? undefined, projectId: row.projectId ?? undefined,
    simulationTemplateId: row.simulationTemplateId, format: storedFormat(row.format),
    participants: row.participants.map((participant) => ({ entityId: participant.entityId, seed: participant.seed })),
    seedingMethod: row.seedingMethod === "RANDOM" ? "RANDOM" : "MANUAL", randomSeed: row.randomSeed,
    tiePolicy: row.tiePolicy === "REPLAY_MATCH" ? "REPLAY_MATCH" : "NO_TIES_ALLOWED",
    winPoints: row.winPoints, tiePoints: row.tiePoints, lossPoints: row.lossPoints, tiebreakers: parseTiebreakers(row.tiebreakers),
    scheduledStartAt: row.scheduledStartAt ?? undefined, worldId: row.worldId ?? undefined, worldVersion: row.worldVersion ?? undefined,
    experienceProfileId: row.experienceProfileId ?? undefined, experienceProfileVersion: row.experienceProfileVersion ?? undefined,
  };
}

export async function updateTournament(userId: string, workspaceId: string, tournamentId: string, input: unknown) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const current = await loadTournament(workspaceId, tournamentId);
  if (current.status !== "DRAFT" && current.status !== "CONFIGURING") throw new ConflictError("Tournament structure is locked after it becomes READY.");
  const patch = parseOrThrow(updateTournamentSchema, input);
  const data = parseOrThrow(createTournamentSchema, { ...editableInput(current), ...patch });
  const normalized = { ...data, randomSeed: data.randomSeed ?? current.randomSeed };
  await prisma.$transaction(async (tx) => {
    const validated = await validateBindings(tx, workspaceId, normalized);
    await tx.tournamentMatch.deleteMany({ where: { tournamentId } });
    await tx.tournamentRound.deleteMany({ where: { tournamentId } });
    await tx.tournamentParticipant.deleteMany({ where: { tournamentId } });
    await tx.tournament.update({ where: { id: tournamentId }, data: {
      projectId: normalized.projectId ?? null, simulationTemplateId: normalized.simulationTemplateId,
      name: normalized.name, slug: await availableSlug(tx, workspaceId, normalized.name, tournamentId), description: normalized.description ?? null,
      status: "DRAFT", format: normalized.format, moduleKey: validated.template.mode, seedingMethod: normalized.seedingMethod, randomSeed: normalized.randomSeed,
      tiePolicy: normalized.tiePolicy, winPoints: normalized.winPoints, tiePoints: normalized.tiePoints, lossPoints: normalized.lossPoints,
      tiebreakers: JSON.stringify(normalized.tiebreakers), scheduledStartAt: normalized.scheduledStartAt ?? null,
      worldId: validated.worldId, worldVersion: validated.worldVersion,
      experienceProfileId: validated.experienceProfileId, experienceProfileVersion: validated.experienceProfileVersion,
      simulationSnapshot: null, executionError: null,
      participants: { create: seededParticipants(normalized, validated.entities) },
    } });
  });
  await recordAudit({ action: "tournament.updated", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId, metadata: { name: normalized.name } });
  if (input && typeof input === "object" && Object.prototype.hasOwnProperty.call(input, "participants")) await recordAudit({ action: "tournament.participants_updated", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId, metadata: { name: normalized.name, participantCount: normalized.participants.length } });
  return getTournament(userId, workspaceId, tournamentId);
}

function bracketSeedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) { const nextSize = order.length * 2; order = order.flatMap((seed) => [seed, nextSize + 1 - seed]); }
  return order;
}

type MatchSpec = { id: string; roundId: string; matchNumber: number; state: string; participantOneId: string | null; participantTwoId: string | null; winnerParticipantId: string | null; nextMatchId: string | null; nextSlot: number | null };

type SeededParticipant = { id: string; seed: number };

function eliminationStructure(participants: SeededParticipant[]) {
  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const roundCount = Math.log2(bracketSize);
  const rounds = Array.from({ length: roundCount }, (_, index) => ({ id: randomUUID(), number: index + 1, label: index === roundCount - 1 ? "Final" : index === roundCount - 2 ? "Semifinals" : `Round ${index + 1}` }));
  const matches: MatchSpec[] = []; const byRound: MatchSpec[][] = []; let matchNumber = 1;
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const count = bracketSize / 2 ** (roundIndex + 1);
    const current = Array.from({ length: count }, () => ({ id: randomUUID(), roundId: rounds[roundIndex]!.id, matchNumber: matchNumber++, state: "PENDING", participantOneId: null, participantTwoId: null, winnerParticipantId: null, nextMatchId: null, nextSlot: null }));
    byRound.push(current); matches.push(...current);
  }
  byRound.forEach((roundMatches, roundIndex) => roundMatches.forEach((match, index) => {
    const next = byRound[roundIndex + 1]?.[Math.floor(index / 2)];
    if (next) { match.nextMatchId = next.id; match.nextSlot = index % 2 + 1; }
  }));
  const bySeed = new Map(participants.map((participant) => [participant.seed, participant.id]));
  const order = bracketSeedOrder(bracketSize);
  byRound[0]!.forEach((match, index) => {
    match.participantOneId = bySeed.get(order[index * 2]!) ?? null;
    match.participantTwoId = bySeed.get(order[index * 2 + 1]!) ?? null;
  });
  for (const match of byRound[0]!) {
    const count = Number(Boolean(match.participantOneId)) + Number(Boolean(match.participantTwoId));
    if (count === 2) match.state = "READY";
    else if (count === 1) {
      match.state = "BYE"; match.winnerParticipantId = match.participantOneId ?? match.participantTwoId;
      if (match.nextMatchId && match.nextSlot) {
        const next = matches.find((candidate) => candidate.id === match.nextMatchId)!;
        if (match.nextSlot === 1) next.participantOneId = match.winnerParticipantId; else next.participantTwoId = match.winnerParticipantId;
      }
    }
  }
  for (const roundMatches of byRound.slice(1)) for (const match of roundMatches) {
    match.state = match.participantOneId && match.participantTwoId ? "READY" : "PENDING";
  }
  return { rounds, matches };
}

function roundRobinStructure(participants: SeededParticipant[]) {
  const slots: Array<string | null> = participants.map((participant) => participant.id);
  if (slots.length % 2) slots.push(null);
  const rounds: Array<{ id: string; number: number; label: string }> = []; const matches: MatchSpec[] = []; let matchNumber = 1;
  for (let roundIndex = 0; roundIndex < slots.length - 1; roundIndex += 1) {
    const round = { id: randomUUID(), number: roundIndex + 1, label: `Round ${roundIndex + 1}` }; rounds.push(round);
    for (let index = 0; index < slots.length / 2; index += 1) {
      const first = slots[index] ?? null; const second = slots[slots.length - 1 - index] ?? null;
      if (first && second) matches.push({ id: randomUUID(), roundId: round.id, matchNumber: matchNumber++, state: "READY", participantOneId: first, participantTwoId: second, winnerParticipantId: null, nextMatchId: null, nextSlot: null });
    }
    const last = slots.pop()!; slots.splice(1, 0, last);
  }
  return { rounds, matches };
}

export async function generateTournamentStructure(userId: string, workspaceId: string, tournamentId: string) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  await prisma.$transaction(async (tx) => {
    const row = await tx.tournament.findFirst({ where: { id: tournamentId, workspaceId }, include: { participants: { orderBy: { seed: "asc" } }, simulationTemplate: true } });
    if (!row) throw new NotFoundError("Tournament not found.");
    if (row.status !== "DRAFT" && row.status !== "CONFIGURING") throw new ConflictError("Tournament structure is locked.");
    if (await tx.tournamentMatch.count({ where: { tournamentId } })) throw new ConflictError("Tournament structure has already been generated.");
    if (row.participants.length < 2) throw new ValidationError("At least two participants are required.");
    const config = validatedTournamentTemplateConfig(row.simulationTemplate);
    const snapshot = tournamentSimulationSnapshotSchema.parse({ snapshotVersion: TOURNAMENT_SNAPSHOT_VERSION, sourceSimulationId: row.simulationTemplate.id, sourceSimulationName: row.simulationTemplate.name, projectId: row.projectId ?? row.simulationTemplate.projectId, mode: row.simulationTemplate.mode, seed: row.simulationTemplate.seed ?? row.randomSeed, configVersion: row.simulationTemplate.configVersion, configuration: config, presentation: parseStoredPresentation(row.simulationTemplate.presentation), worldId: row.worldId, worldVersion: row.worldVersion, experienceProfileId: row.experienceProfileId, experienceProfileVersion: row.experienceProfileVersion });
    const structure = row.format === "SINGLE_ELIMINATION" ? eliminationStructure(row.participants) : roundRobinStructure(row.participants);
    await tx.tournamentRound.createMany({ data: structure.rounds.map((round) => ({ ...round, tournamentId, state: structure.matches.filter((match) => match.roundId === round.id).every((match) => match.state === "BYE") ? "COMPLETED" : structure.matches.some((match) => match.roundId === round.id && match.state === "READY") ? "READY" : "PENDING", completedAt: structure.matches.filter((match) => match.roundId === round.id).every((match) => match.state === "BYE") ? new Date() : null })) });
    await tx.tournamentMatch.createMany({ data: structure.matches.map((match) => ({ ...match, tournamentId, completedAt: match.state === "BYE" ? new Date() : null, metadata: JSON.stringify({ generated: true }) })) });
    const changed = await tx.tournament.updateMany({ where: { id: tournamentId, status: { in: ["DRAFT", "CONFIGURING"] } }, data: { status: "CONFIGURING", simulationSnapshot: JSON.stringify(snapshot), executionError: null } });
    if (changed.count !== 1) throw new ConflictError("Tournament changed while its structure was generated.");
  });
  await recordAudit({ action: "tournament.structure_generated", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId });
  return getTournament(userId, workspaceId, tournamentId);
}

async function transitionTournament(userId: string, workspaceId: string, tournamentId: string, from: readonly string[], to: TournamentStatus, action: "tournament.ready" | "tournament.started" | "tournament.paused" | "tournament.resumed" | "tournament.cancelled") {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const row = await loadTournament(workspaceId, tournamentId);
  if (!from.includes(row.status)) throw new ConflictError(`Tournament cannot move from ${row.status} to ${to}.`);
  if (to === "READY" && (!row.simulationSnapshot || !row.matches.length || !row.matches.some((match) => match.state === "READY"))) throw new ValidationError("Generate a valid bracket or schedule before marking this Tournament ready.");
  const now = new Date();
  const data: Prisma.TournamentUpdateManyMutationInput = { status: to, executionError: null };
  if (to === "IN_PROGRESS") { data.pausedAt = null; if (!row.startedAt) data.startedAt = now; }
  if (to === "PAUSED") data.pausedAt = now;
  if (to === "CANCELLED") data.cancelledAt = now;
  const changed = await prisma.tournament.updateMany({ where: { id: tournamentId, workspaceId, status: row.status }, data });
  if (changed.count !== 1) throw new ConflictError("Tournament changed while this action was applied.");
  await recordAudit({ action, actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId, metadata: { name: row.name } });
  return getTournament(userId, workspaceId, tournamentId);
}

export const markTournamentReady = (userId: string, workspaceId: string, tournamentId: string) => transitionTournament(userId, workspaceId, tournamentId, ["CONFIGURING"], "READY", "tournament.ready");
export const startTournament = (userId: string, workspaceId: string, tournamentId: string) => transitionTournament(userId, workspaceId, tournamentId, ["READY"], "IN_PROGRESS", "tournament.started");
export const pauseTournament = (userId: string, workspaceId: string, tournamentId: string) => transitionTournament(userId, workspaceId, tournamentId, ["IN_PROGRESS"], "PAUSED", "tournament.paused");
export const resumeTournament = (userId: string, workspaceId: string, tournamentId: string) => transitionTournament(userId, workspaceId, tournamentId, ["PAUSED"], "IN_PROGRESS", "tournament.resumed");
export const cancelTournament = (userId: string, workspaceId: string, tournamentId: string) => transitionTournament(userId, workspaceId, tournamentId, ["DRAFT", "CONFIGURING", "READY", "IN_PROGRESS", "PAUSED"], "CANCELLED", "tournament.cancelled");

export async function updateTournamentSchedule(userId: string, workspaceId: string, tournamentId: string, input: unknown) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const data = parseOrThrow(tournamentScheduleSchema, input);
  const row = await loadTournament(workspaceId, tournamentId);
  if (["COMPLETED", "CANCELLED", "ARCHIVED"].includes(row.status)) throw new ConflictError("Scheduling is locked for this Tournament.");
  const roundIds = new Set(row.rounds.map((round) => round.id)); const matchIds = new Set(row.matches.map((match) => match.id));
  if (data.rounds.some((round) => !roundIds.has(round.roundId)) || data.matches.some((match) => !matchIds.has(match.matchId))) throw new NotFoundError("Tournament schedule item not found.");
  if (new Set(data.rounds.map((round) => round.roundId)).size !== data.rounds.length || new Set(data.matches.map((match) => match.matchId)).size !== data.matches.length) throw new ValidationError("Schedule items must be unique.");
  await prisma.$transaction(async (tx) => {
    if (data.scheduledStartAt !== undefined) await tx.tournament.update({ where: { id: tournamentId }, data: { scheduledStartAt: data.scheduledStartAt } });
    for (const round of data.rounds) await tx.tournamentRound.update({ where: { id: round.roundId }, data: { startsAt: round.startsAt } });
    for (const match of data.matches) await tx.tournamentMatch.update({ where: { id: match.matchId }, data: { scheduledAt: match.scheduledAt } });
  });
  await recordAudit({ action: "tournament.updated", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId, metadata: { name: row.name, scheduleUpdated: true } });
  return getTournament(userId, workspaceId, tournamentId);
}

function matchSeed(tournamentSeed: string, matchNumber: number) {
  return `SV-${createHash("sha256").update(`${tournamentSeed}:${matchNumber}`).digest("hex").slice(0, 8).toUpperCase()}`;
}

export async function runTournamentMatch(userId: string, workspaceId: string, tournamentId: string, matchId: string) {
  await requireMembership(userId, workspaceId, "tournament.run");
  const claimed = await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({ where: { id: tournamentId, workspaceId }, include: { participants: true } });
    if (!tournament) throw new NotFoundError("Tournament not found.");
    if (tournament.status !== "IN_PROGRESS") throw new ConflictError("Tournament must be in progress to run a Match.");
    const match = await tx.tournamentMatch.findFirst({ where: { id: matchId, tournamentId } });
    if (!match) throw new NotFoundError("Tournament Match not found.");
    if (match.state !== "READY" || match.simulationRunId || !match.participantOneId || !match.participantTwoId) throw new ConflictError("This Match is not eligible to run.");
    const snapshot = parseJson(tournament.simulationSnapshot, tournamentSimulationSnapshotSchema.parse.bind(tournamentSimulationSnapshotSchema), "Simulation snapshot");
    if (!snapshot) throw new ConflictError("Tournament Simulation snapshot is unavailable.");
    const participantById = new Map(tournament.participants.map((participant) => [participant.id, participant]));
    const first = participantById.get(match.participantOneId); const second = participantById.get(match.participantTwoId);
    if (!first || !second) throw new ConflictError("Match participants are unavailable.");
    const simulation = await tx.simulation.create({ data: { workspaceId, projectId: snapshot.projectId, name: `${tournament.name} · Match ${match.matchNumber}`, description: `Tournament Match ${match.matchNumber} derived from ${snapshot.sourceSimulationName}.`, mode: snapshot.mode, status: "READY", seed: matchSeed(tournament.randomSeed, match.matchNumber), configVersion: snapshot.configVersion, configuration: JSON.stringify(snapshot.configuration), presentation: JSON.stringify(snapshot.presentation), worldId: snapshot.worldId, worldVersion: snapshot.worldVersion, experienceProfileId: snapshot.experienceProfileId, experienceProfileVersion: snapshot.experienceProfileVersion, metadata: JSON.stringify({ tournamentId, tournamentMatchId: match.id, sourceSimulationId: snapshot.sourceSimulationId }), createdById: userId, entityLinks: { create: [{ entityId: first.entityId, position: 0, role: "participant", overrides: null }, { entityId: second.entityId, position: 1, role: "participant", overrides: null }] } } });
    const changed = await tx.tournamentMatch.updateMany({ where: { id: match.id, state: "READY", simulationId: null, simulationRunId: null }, data: { state: "RUNNING", simulationId: simulation.id, startedAt: new Date() } });
    if (changed.count !== 1) throw new ConflictError("Match changed while its Run was being launched.");
    await tx.tournamentRound.update({ where: { id: match.roundId }, data: { state: "IN_PROGRESS", startsAt: new Date() } });
    return { matchId: match.id, simulationId: simulation.id };
  });
  let run;
  try {
    run = await createSimulationRun(userId, workspaceId, claimed.simulationId);
    await prisma.tournamentMatch.update({ where: { id: claimed.matchId }, data: { simulationRunId: run.id } });
    run = await startSimulationRun(userId, workspaceId, run.id);
    run = await executeUntilComplete(userId, workspaceId, run.id);
    if (run.status !== "COMPLETED") throw new ConflictError("The authoritative Match Run did not complete.");
  } catch (error) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "PAUSED", pausedAt: new Date(), executionError: "Match execution did not complete. Inspect the authoritative Run before resuming." } }).catch(() => undefined);
    throw error;
  }
  await recordAudit({ action: "tournament.match_run_created", actorUserId: userId, workspaceId, entityType: "TournamentMatch", entityId: matchId, metadata: { tournamentId, runId: run.id } });
  return acceptTournamentMatchResult(userId, workspaceId, tournamentId, matchId);
}

async function refreshRoundStates(tx: Prisma.TransactionClient, tournamentId: string) {
  const rounds = await tx.tournamentRound.findMany({ where: { tournamentId }, include: { matches: true } });
  for (const round of rounds) {
    const terminal = round.matches.every((match) => match.state === "COMPLETED" || match.state === "BYE" || match.state === "CANCELLED");
    const running = round.matches.some((match) => match.state === "RUNNING");
    const ready = round.matches.some((match) => match.state === "READY");
    await tx.tournamentRound.update({ where: { id: round.id }, data: { state: terminal ? "COMPLETED" : running ? "IN_PROGRESS" : ready ? "READY" : "PENDING", completedAt: terminal ? round.completedAt ?? new Date() : null } });
  }
}

function resultHash(result: CompetitionMatchResult) {
  return `sha256:${createHash("sha256").update(JSON.stringify(result)).digest("hex")}`;
}

export async function acceptTournamentMatchResult(userId: string, workspaceId: string, tournamentId: string, matchId: string) {
  await requireMembership(userId, workspaceId, "tournament.run");
  const tournament = await loadTournament(workspaceId, tournamentId);
  const match = tournament.matches.find((candidate) => candidate.id === matchId);
  if (!match) throw new NotFoundError("Tournament Match not found.");
  if (!match.simulationRunId || !match.participantOneId || !match.participantTwoId) throw new ConflictError("Match has no authoritative Run to consume.");
  if (match.state === "COMPLETED") return toTournamentView(tournament);
  if (match.state !== "RUNNING") throw new ConflictError("Only a running Match can accept a result.");
  const run = await getSimulationRun(userId, workspaceId, match.simulationRunId);
  const participantById = new Map(tournament.participants.map((participant) => [participant.id, participant]));
  const mapped = [participantById.get(match.participantOneId), participantById.get(match.participantTwoId)];
  if (!mapped[0] || !mapped[1]) throw new ConflictError("Match participants are unavailable.");
  let result: CompetitionMatchResult;
  try { result = resultAdapterFor(run.moduleId, run.moduleVersion).interpret(run, mapped.map((participant) => ({ tournamentParticipantId: participant!.id, entityId: participant!.entityId }))); }
  catch (error) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "PAUSED", pausedAt: new Date(), executionError: error instanceof Error ? error.message : "Run result mapping failed." } });
    throw error;
  }
  await prisma.$transaction(async (tx) => {
    const current = await tx.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!current || current.tournamentId !== tournamentId) throw new NotFoundError("Tournament Match not found.");
    if (current.state === "COMPLETED") return;
    if (current.state !== "RUNNING" || current.simulationRunId !== run.id) throw new ConflictError("Match changed while its result was being accepted.");
    await tx.tournamentMatch.update({ where: { id: matchId }, data: { state: "COMPLETED", winnerParticipantId: result.winnerTournamentParticipantId, resultSnapshot: JSON.stringify(result), resultHash: resultHash(result), completedAt: new Date() } });
    if (tournament.format === "SINGLE_ELIMINATION") {
      if (!result.winnerTournamentParticipantId) {
        if (tournament.tiePolicy === "REPLAY_MATCH") {
          const last = await tx.tournamentMatch.aggregate({ where: { tournamentId }, _max: { matchNumber: true } });
          await tx.tournamentMatch.create({ data: { tournamentId, roundId: current.roundId, matchNumber: (last._max.matchNumber ?? 0) + 1, state: "READY", participantOneId: current.participantOneId, participantTwoId: current.participantTwoId, nextMatchId: current.nextMatchId, nextSlot: current.nextSlot, replayOfMatchId: current.id, metadata: JSON.stringify({ replayReason: "AUTHORITATIVE_TIE" }) } });
        } else await tx.tournament.update({ where: { id: tournamentId }, data: { status: "PAUSED", pausedAt: new Date(), executionError: "An elimination Match ended in a tie. Advancement requires an explicit resolution." } });
      } else if (current.nextMatchId && current.nextSlot) {
        const next = await tx.tournamentMatch.findUniqueOrThrow({ where: { id: current.nextMatchId } });
        const existing = current.nextSlot === 1 ? next.participantOneId : next.participantTwoId;
        if (existing && existing !== result.winnerTournamentParticipantId) throw new ConflictError("The next bracket slot is already occupied.");
        const data = current.nextSlot === 1 ? { participantOneId: result.winnerTournamentParticipantId } : { participantTwoId: result.winnerTournamentParticipantId };
        await tx.tournamentMatch.update({ where: { id: next.id }, data: { ...data, state: (current.nextSlot === 1 ? next.participantTwoId : next.participantOneId) ? "READY" : "PENDING" } });
        const loserId = current.participantOneId === result.winnerTournamentParticipantId ? current.participantTwoId : current.participantOneId;
        if (loserId) await tx.tournamentParticipant.update({ where: { id: loserId }, data: { status: "ELIMINATED" } });
      } else {
        await tx.tournament.update({ where: { id: tournamentId }, data: { status: "COMPLETED", championParticipantId: result.winnerTournamentParticipantId, tiedChampionParticipantIds: JSON.stringify([]), completedAt: new Date(), executionError: null } });
        const loserId = current.participantOneId === result.winnerTournamentParticipantId ? current.participantTwoId : current.participantOneId;
        if (loserId) await tx.tournamentParticipant.update({ where: { id: loserId }, data: { status: "ELIMINATED" } });
      }
    }
    await refreshRoundStates(tx, tournamentId);
  });
  let refreshed = await loadTournament(workspaceId, tournamentId);
  if (refreshed.format === "ROUND_ROBIN" && refreshed.matches.every((candidate) => candidate.state === "COMPLETED")) {
    const standings = standingsForRow(refreshed); const champions = standings.filter((standing) => standing.rank === 1).map((standing) => standing.tournamentParticipantId);
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "COMPLETED", championParticipantId: champions.length === 1 ? champions[0] : null, tiedChampionParticipantIds: JSON.stringify(champions.length > 1 ? champions : []), finalStandingsSnapshot: JSON.stringify(standings), completedAt: new Date(), executionError: null } });
    refreshed = await loadTournament(workspaceId, tournamentId);
  }
  await recordAudit({ action: "tournament.result_accepted", actorUserId: userId, workspaceId, entityType: "TournamentMatch", entityId: matchId, metadata: { tournamentId, runId: run.id, winnerParticipantId: result.winnerTournamentParticipantId } });
  if (tournament.format === "SINGLE_ELIMINATION" && result.winnerTournamentParticipantId && match.nextMatchId) await recordAudit({ action: "tournament.participant_advanced", actorUserId: userId, workspaceId, entityType: "TournamentMatch", entityId: matchId, metadata: { tournamentId, nextMatchId: match.nextMatchId, participantId: result.winnerTournamentParticipantId } });
  if (refreshed.status === "COMPLETED") await recordAudit({ action: "tournament.completed", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId });
  return toTournamentView(refreshed);
}

export async function archiveTournament(userId: string, workspaceId: string, tournamentId: string) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const row = await loadTournament(workspaceId, tournamentId); if (row.status === "ARCHIVED") return toTournamentView(row);
  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "ARCHIVED", archivedFromStatus: row.status, archivedAt: new Date() } });
  await recordAudit({ action: "tournament.archived", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId, metadata: { name: row.name } });
  return getTournament(userId, workspaceId, tournamentId);
}

export async function restoreTournament(userId: string, workspaceId: string, tournamentId: string) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const row = await loadTournament(workspaceId, tournamentId); if (row.status !== "ARCHIVED") throw new ConflictError("Tournament is not archived.");
  const previous = row.archivedFromStatus && row.archivedFromStatus !== "ARCHIVED" ? row.archivedFromStatus : "DRAFT";
  const restored = previous === "IN_PROGRESS" ? "PAUSED" : previous;
  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: restored, archivedFromStatus: null, archivedAt: null, pausedAt: restored === "PAUSED" ? new Date() : row.pausedAt } });
  await recordAudit({ action: "tournament.restored", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId, metadata: { name: row.name } });
  return getTournament(userId, workspaceId, tournamentId);
}

export async function deleteTournament(userId: string, workspaceId: string, tournamentId: string) {
  await requireMembership(userId, workspaceId, "tournament.manage");
  const row = await loadTournament(workspaceId, tournamentId);
  if (row.matches.some((match) => match.simulationRunId || match.resultSnapshot)) throw new ConflictError("A Tournament with authoritative Run history cannot be deleted. Archive it instead.");
  const simulationIds = row.matches.flatMap((match) => match.simulationId ? [match.simulationId] : []);
  await prisma.$transaction(async (tx) => { await tx.tournament.delete({ where: { id: tournamentId } }); if (simulationIds.length) await tx.simulation.deleteMany({ where: { id: { in: simulationIds } } }); });
  await recordAudit({ action: "tournament.deleted", actorUserId: userId, workspaceId, entityType: "Tournament", entityId: tournamentId, metadata: { name: row.name } });
  return { id: tournamentId };
}
