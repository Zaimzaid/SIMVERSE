import type { MediaArtifactVersion, Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { engineEventSchema, inputSnapshotSchema, participantSnapshotSchema, resultEnvelopeSchema, stringifyBounded } from "@/lib/engine/schemas";
import {
  MEDIA_ARTIFACT_MAX_PAGE_SIZE,
  MEDIA_ARTIFACT_PAGE_SIZE,
  type MediaArtifactStatus,
  type MediaArtifactType,
  type MediaAspectRatio,
  isMediaArtifactStatus,
  isMediaArtifactType,
  isMediaAspectRatio,
} from "@/lib/media/constants";
import { storyboardAdapterFor, supportsStoryboardSource, type StoryboardSourceRun } from "@/lib/media/adapters";
import {
  createMediaArtifactFromRunSchema,
  createMediaArtifactVersionSchema,
  storyboardV1Schema,
  type CreateMediaArtifactVersionInput,
  type StoryboardV1,
} from "@/lib/media/schemas";
import { parseOrThrow } from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

const versionWithCreator = {
  createdBy: { select: { displayName: true } },
} satisfies Prisma.MediaArtifactVersionInclude;

const artifactInclude = {
  createdBy: { select: { displayName: true } },
  sourceRun: {
    select: {
      id: true, simulationId: true, status: true, mode: true, moduleId: true,
      moduleVersion: true, inputSnapshot: true, completedAt: true,
    },
  },
  versions: { include: versionWithCreator, orderBy: { version: "desc" as const } },
} satisfies Prisma.MediaArtifactInclude;

const artifactListInclude = {
  createdBy: { select: { displayName: true } },
  sourceRun: {
    select: {
      id: true, simulationId: true, status: true, mode: true, moduleId: true,
      moduleVersion: true, inputSnapshot: true, completedAt: true,
    },
  },
  versions: { include: versionWithCreator, orderBy: { version: "desc" as const }, take: 1 },
} satisfies Prisma.MediaArtifactInclude;

type ArtifactRow = Prisma.MediaArtifactGetPayload<{ include: typeof artifactInclude }>;
type ArtifactListRow = Prisma.MediaArtifactGetPayload<{ include: typeof artifactListInclude }>;

export interface MediaArtifactVersionView {
  id: string;
  artifactId: string;
  version: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  aspectRatio: MediaAspectRatio;
  status: MediaArtifactStatus;
  storyboard: StoryboardV1;
  createdByName: string | null;
  createdAt: Date;
}

export interface MediaArtifactView {
  id: string;
  workspaceId: string;
  sourceRunId: string;
  type: MediaArtifactType;
  status: MediaArtifactStatus;
  currentVersion: number;
  archivedFromStatus: MediaArtifactStatus | null;
  source: {
    runId: string;
    simulationId: string;
    simulationName: string;
    mode: string;
    moduleId: string;
    moduleVersion: string;
    completedAt: Date | null;
  };
  version: MediaArtifactVersionView;
  versions: MediaArtifactVersionView[];
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface MediaArtifactListResult {
  items: MediaArtifactView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CompletedMediaSourceView {
  runId: string;
  simulationId: string;
  simulationName: string;
  mode: string;
  moduleId: string;
  moduleVersion: string;
  completedAt: Date | null;
  participantNames: string[];
  artifactCount: number;
}

function parseStoredJson<T>(value: string, schema: { parse(input: unknown): T }, message: string): T {
  try { return schema.parse(JSON.parse(value)); }
  catch { throw new ValidationError(message); }
}

function storedType(value: string): MediaArtifactType {
  if (!isMediaArtifactType(value)) throw new ValidationError("Stored media artifact type is invalid.");
  return value;
}

function storedStatus(value: string): MediaArtifactStatus {
  if (!isMediaArtifactStatus(value)) throw new ValidationError("Stored media artifact status is invalid.");
  return value;
}

function storedAspectRatio(value: string): MediaAspectRatio {
  if (!isMediaAspectRatio(value)) throw new ValidationError("Stored media aspect ratio is invalid.");
  return value;
}

function toVersionView(row: MediaArtifactVersion & { createdBy: { displayName: string } | null }): MediaArtifactVersionView {
  return {
    id: row.id,
    artifactId: row.artifactId,
    version: row.version,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    aspectRatio: storedAspectRatio(row.aspectRatio),
    status: storedStatus(row.status),
    storyboard: parseStoredJson(row.storyboard, storyboardV1Schema, "Stored storyboard data is invalid."),
    createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt,
  };
}

function toArtifactView(row: ArtifactRow | ArtifactListRow): MediaArtifactView {
  const input = parseStoredJson(row.sourceRun.inputSnapshot, inputSnapshotSchema, "The source Run snapshot is invalid.");
  const versions = row.versions.map(toVersionView);
  const current = versions[0];
  if (!current || current.version !== row.currentVersion) {
    throw new ValidationError("The current media artifact version is unavailable.");
  }
  if (current.status !== storedStatus(row.status)) {
    throw new ValidationError("The current media artifact status is inconsistent.");
  }
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sourceRunId: row.sourceRunId,
    type: storedType(row.type),
    status: storedStatus(row.status),
    currentVersion: row.currentVersion,
    archivedFromStatus: row.archivedFromStatus && isMediaArtifactStatus(row.archivedFromStatus)
      ? row.archivedFromStatus : null,
    source: {
      runId: row.sourceRun.id,
      simulationId: row.sourceRun.simulationId,
      simulationName: input.simulationName,
      mode: row.sourceRun.mode,
      moduleId: row.sourceRun.moduleId,
      moduleVersion: row.sourceRun.moduleVersion,
      completedAt: row.sourceRun.completedAt,
    },
    version: current,
    versions,
    createdByName: row.createdBy?.displayName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function parseSourceRun(row: {
  id: string; simulationId: string; status: string; mode: string; moduleId: string; moduleVersion: string;
  inputSnapshot: string; result: string | null;
  participants: { snapshot: string }[];
  events: { sequence: number; tick: number; simulatedTimeMs: number; type: string; actorRunParticipantId: string | null;
    targetRunParticipantId: string | null; payloadVersion: number; payload: string }[];
}): StoryboardSourceRun {
  if (row.status !== "COMPLETED" || !row.result) throw new ValidationError("Only a completed Run can become content.");
  const input = parseStoredJson(row.inputSnapshot, inputSnapshotSchema, "The source Run snapshot is invalid.");
  const participants = row.participants.map(({ snapshot }) =>
    parseStoredJson(snapshot, participantSnapshotSchema, "A source Run participant snapshot is invalid."));
  const inputIds = input.participants.map((participant) => participant.runParticipantId);
  if (inputIds.length !== participants.length || inputIds.some((id, index) => id !== participants[index]?.runParticipantId)) {
    throw new ValidationError("The source Run participant snapshots do not match.");
  }
  const result = parseStoredJson(row.result, resultEnvelopeSchema, "The completed Run result is invalid.");
  const events = row.events.map((event) => parseStoredJson(JSON.stringify({
    sequence: event.sequence,
    tick: event.tick,
    simulatedTimeMs: event.simulatedTimeMs,
    type: event.type,
    actorRunParticipantId: event.actorRunParticipantId,
    targetRunParticipantId: event.targetRunParticipantId,
    payloadVersion: event.payloadVersion,
    payload: parseStoredJson(event.payload, { parse: (value: unknown) => value }, "A source Run event is invalid."),
  }), engineEventSchema, "A source Run event is invalid."));
  return {
    id: row.id,
    simulationId: row.simulationId,
    simulationName: input.simulationName,
    mode: row.mode,
    moduleId: row.moduleId,
    moduleVersion: row.moduleVersion,
    participants,
    events,
    result,
  };
}

function isWriteConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "P2002" || code === "P2034" || code === "P2028";
}

export async function listMediaArtifacts(
  userId: string,
  workspaceId: string,
  options: { status?: MediaArtifactStatus | "CURRENT" | "ALL"; page?: number; pageSize?: number } = {},
): Promise<MediaArtifactListResult> {
  await requireMembership(userId, workspaceId, "media.view");
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(MEDIA_ARTIFACT_MAX_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize ?? MEDIA_ARTIFACT_PAGE_SIZE)));
  const where: Prisma.MediaArtifactWhereInput = { workspaceId };
  const status = options.status ?? "CURRENT";
  if (status === "CURRENT") where.status = { not: "ARCHIVED" };
  else if (status !== "ALL") where.status = status;
  const [total, rows] = await Promise.all([
    prisma.mediaArtifact.count({ where }),
    prisma.mediaArtifact.findMany({
      where,
      include: artifactListInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items: rows.map(toArtifactView), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getMediaArtifact(
  userId: string,
  workspaceId: string,
  artifactId: string,
): Promise<MediaArtifactView> {
  await requireMembership(userId, workspaceId, "media.view");
  const row = await prisma.mediaArtifact.findFirst({ where: { id: artifactId, workspaceId }, include: artifactInclude });
  if (!row) throw new NotFoundError("Media artifact not found.");
  return toArtifactView(row);
}

export async function listCompletedMediaSources(
  userId: string,
  workspaceId: string,
  limit = 12,
): Promise<CompletedMediaSourceView[]> {
  await requireMembership(userId, workspaceId, "media.create");
  const safeLimit = Math.min(30, Math.max(1, Math.floor(limit)));
  const rows = await prisma.simulationRun.findMany({
    where: {
      workspaceId,
      status: "COMPLETED",
      OR: [
        { moduleId: "battle", moduleVersion: "battle-v1" },
        { moduleId: "race", moduleVersion: "race-v1" },
        { moduleId: "survival", moduleVersion: "survival-v1" },
      ],
    },
    select: {
      id: true, simulationId: true, mode: true, moduleId: true, moduleVersion: true,
      inputSnapshot: true, completedAt: true, _count: { select: { mediaArtifacts: true } },
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: safeLimit,
  });
  return rows.flatMap((row) => {
    let raw: unknown;
    try { raw = JSON.parse(row.inputSnapshot); }
    catch { return []; }
    const parsed = inputSnapshotSchema.safeParse(raw);
    if (!parsed.success || !supportsStoryboardSource(row.moduleId, row.moduleVersion)) return [];
    return [{
      runId: row.id,
      simulationId: row.simulationId,
      simulationName: parsed.data.simulationName,
      mode: row.mode,
      moduleId: row.moduleId,
      moduleVersion: row.moduleVersion,
      completedAt: row.completedAt,
      participantNames: parsed.data.participants.map((participant) => participant.name),
      artifactCount: row._count.mediaArtifacts,
    }];
  });
}

export async function createMediaArtifactFromRun(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<MediaArtifactView> {
  await requireMembership(userId, workspaceId, "media.create");
  const data = parseOrThrow(createMediaArtifactFromRunSchema, input, "Choose a valid completed Run and format.");
  let artifactId: string;
  try {
    artifactId = await prisma.$transaction(async (tx) => {
      const row = await tx.simulationRun.findFirst({
        where: { id: data.runId, workspaceId },
        include: {
          participants: { orderBy: { position: "asc" } },
          events: { orderBy: { sequence: "asc" } },
        },
      });
      if (!row) throw new NotFoundError("Run not found.");
      const adapter = storyboardAdapterFor(row.moduleId, row.moduleVersion);
      if (!adapter) throw new ValidationError("Creator/Media does not support this Run module yet.");
      const source = parseSourceRun(row);
      let storyboard: StoryboardV1;
      try { storyboard = storyboardV1Schema.parse(adapter.build(source)); }
      catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("The completed Run could not produce a valid storyboard.");
      }
      const artifact = await tx.mediaArtifact.create({
        data: {
          workspaceId,
          sourceRunId: row.id,
          type: "STORYBOARD",
          status: "DRAFT",
          currentVersion: 1,
          createdById: userId,
        },
        select: { id: true },
      });
      await tx.mediaArtifactVersion.create({
        data: {
          artifactId: artifact.id,
          version: 1,
          title: `${source.simulationName} Storyboard`,
          subtitle: storyboard.summary.headline,
          description: "A storyboard generated from the saved authoritative SIMVERSE Run.",
          aspectRatio: data.aspectRatio,
          status: "DRAFT",
          storyboard: stringifyBounded(storyboard, 2_000_000),
          createdById: userId,
        },
      });
      return artifact.id;
    });
  } catch (error) {
    if (isWriteConflict(error)) throw new ConflictError("Media creation conflicted with another change. Try again.");
    throw error;
  }
  await recordAudit({
    action: "media.artifact.created",
    actorUserId: userId,
    workspaceId,
    entityType: "MediaArtifact",
    entityId: artifactId,
    metadata: { sourceRunId: data.runId, type: "STORYBOARD", version: 1 },
  });
  return getMediaArtifact(userId, workspaceId, artifactId);
}

function editedStoryboard(current: StoryboardV1, input: CreateMediaArtifactVersionInput): StoryboardV1 {
  if (input.scenes.length !== current.scenes.length) throw new ValidationError("Every storyboard scene must be preserved.");
  const changes = new Map(input.scenes.map((scene) => [scene.id, scene]));
  if (changes.size !== input.scenes.length || current.scenes.some((scene) => !changes.has(scene.id))) {
    throw new ValidationError("Storyboard scene identifiers cannot be changed.");
  }
  const orders = input.scenes.map((scene) => scene.order).sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index)) throw new ValidationError("Storyboard scene order must be continuous.");
  return storyboardV1Schema.parse({
    ...current,
    scenes: current.scenes.map((scene) => {
      const change = changes.get(scene.id)!;
      return { ...scene, order: change.order, title: change.title, caption: change.caption, enabled: change.enabled };
    }).sort((a, b) => a.order - b.order),
  });
}

async function appendArtifactVersion(
  userId: string,
  workspaceId: string,
  artifactId: string,
  build: (current: MediaArtifactVersionView, artifactStatus: MediaArtifactStatus) => {
    title: string; subtitle: string | null; description: string | null;
    aspectRatio: MediaAspectRatio; status: MediaArtifactStatus; storyboard: StoryboardV1;
    archivedAt?: Date | null; archivedFromStatus?: MediaArtifactStatus | null;
  },
): Promise<{ version: number; status: MediaArtifactStatus }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.mediaArtifact.findFirst({
        where: { id: artifactId, workspaceId },
        include: { versions: { include: versionWithCreator, orderBy: { version: "desc" }, take: 1 } },
      });
      if (!row) throw new NotFoundError("Media artifact not found.");
      const currentRow = row.versions[0];
      if (!currentRow || currentRow.version !== row.currentVersion) throw new ValidationError("The current media version is unavailable.");
      const current = toVersionView(currentRow);
      const artifactStatus = storedStatus(row.status);
      const next = build(current, artifactStatus);
      const nextVersion = row.currentVersion + 1;
      const update = await tx.mediaArtifact.updateMany({
        where: { id: artifactId, workspaceId, currentVersion: row.currentVersion, status: row.status },
        data: {
          currentVersion: nextVersion,
          status: next.status,
          ...(next.archivedAt !== undefined ? { archivedAt: next.archivedAt } : {}),
          ...(next.archivedFromStatus !== undefined ? { archivedFromStatus: next.archivedFromStatus } : {}),
        },
      });
      if (update.count !== 1) throw new ConflictError("This media artifact changed while you were editing it.");
      await tx.mediaArtifactVersion.create({ data: {
        artifactId,
        version: nextVersion,
        title: next.title,
        subtitle: next.subtitle,
        description: next.description,
        aspectRatio: next.aspectRatio,
        status: next.status,
        storyboard: stringifyBounded(next.storyboard, 2_000_000),
        createdById: userId,
      } });
      return { version: nextVersion, status: next.status };
    });
  } catch (error) {
    if (isWriteConflict(error)) throw new ConflictError("This media artifact changed while you were editing it.");
    throw error;
  }
}

export async function createMediaArtifactVersion(
  userId: string,
  workspaceId: string,
  artifactId: string,
  input: unknown,
): Promise<MediaArtifactView> {
  await requireMembership(userId, workspaceId, "media.edit");
  const data = parseOrThrow(createMediaArtifactVersionSchema, input, "The storyboard update is invalid.");
  const appended = await appendArtifactVersion(userId, workspaceId, artifactId, (current, artifactStatus) => {
    if (artifactStatus === "ARCHIVED") throw new ConflictError("Restore this media artifact before editing it.");
    return {
      title: data.title,
      subtitle: data.subtitle ?? null,
      description: data.description ?? null,
      aspectRatio: data.aspectRatio,
      status: data.status,
      storyboard: editedStoryboard(current.storyboard, data),
    };
  });
  await recordAudit({
    action: "media.artifact.version_created",
    actorUserId: userId,
    workspaceId,
    entityType: "MediaArtifact",
    entityId: artifactId,
    metadata: { version: appended.version, status: appended.status },
  });
  return getMediaArtifact(userId, workspaceId, artifactId);
}

export async function archiveMediaArtifact(
  userId: string,
  workspaceId: string,
  artifactId: string,
): Promise<MediaArtifactView> {
  await requireMembership(userId, workspaceId, "media.edit");
  const existing = await getMediaArtifact(userId, workspaceId, artifactId);
  if (existing.status === "ARCHIVED") return existing;
  const appended = await appendArtifactVersion(userId, workspaceId, artifactId, (current, status) => {
    if (status === "ARCHIVED") throw new ConflictError("This media artifact is already archived.");
    return {
      title: current.title,
      subtitle: current.subtitle,
      description: current.description,
      aspectRatio: current.aspectRatio,
      status: "ARCHIVED",
      storyboard: current.storyboard,
      archivedAt: new Date(),
      archivedFromStatus: status,
    };
  });
  await recordAudit({
    action: "media.artifact.archived", actorUserId: userId, workspaceId,
    entityType: "MediaArtifact", entityId: artifactId, metadata: { version: appended.version },
  });
  return getMediaArtifact(userId, workspaceId, artifactId);
}

export async function restoreMediaArtifact(
  userId: string,
  workspaceId: string,
  artifactId: string,
): Promise<MediaArtifactView> {
  await requireMembership(userId, workspaceId, "media.edit");
  const existing = await getMediaArtifact(userId, workspaceId, artifactId);
  if (existing.status !== "ARCHIVED") return existing;
  const restoredStatus = existing.archivedFromStatus === "READY" ? "READY" : "DRAFT";
  const appended = await appendArtifactVersion(userId, workspaceId, artifactId, (current, status) => {
    if (status !== "ARCHIVED") throw new ConflictError("This media artifact is not archived.");
    return {
      title: current.title,
      subtitle: current.subtitle,
      description: current.description,
      aspectRatio: current.aspectRatio,
      status: restoredStatus,
      storyboard: current.storyboard,
      archivedAt: null,
      archivedFromStatus: null,
    };
  });
  await recordAudit({
    action: "media.artifact.restored", actorUserId: userId, workspaceId,
    entityType: "MediaArtifact", entityId: artifactId,
    metadata: { version: appended.version, status: restoredStatus },
  });
  return getMediaArtifact(userId, workspaceId, artifactId);
}
