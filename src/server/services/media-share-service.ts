import { randomBytes } from "node:crypto";
import type { MediaShare } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { storyboardV1Schema, type StoryboardV1 } from "@/lib/media/schemas";
import { buildResultGraphic, initialsFor, safeColor, seriesColor } from "@/lib/media/export/model";
import { renderResultGraphicSvg } from "@/lib/media/export/svg";
import {
  MEDIA_EXPORT_ASPECT_SLUG,
  MEDIA_EXPORT_CONTENT_TYPE,
  MEDIA_EXPORT_DIMENSIONS,
  MEDIA_EXPORT_FILE_EXTENSION,
  isMediaExportFormat,
  isMediaExportType,
  type MediaExportFormat,
  type MediaExportType,
} from "@/lib/media/export/constants";
import {
  MEDIA_SHARE_PUBLIC_ID_BYTES,
  isMediaShareVisibility,
  isPubliclyVisible,
  type MediaShareVisibility,
} from "@/lib/media/share/constants";
import {
  publicMediaShareV1Schema,
  setMediaShareSchema,
  type PublicMediaShareV1,
} from "@/lib/media/share/schemas";
import { prisma } from "@/server/db/client";
import { rasterizeSvgToPng } from "@/server/media/rasterize";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

export interface ArtifactShareView {
  exists: boolean;
  visibility: MediaShareVisibility;
  pinnedVersion: number | null;
  publicId: string | null;
  titleOverride: string | null;
  updatedAt: string | null;
  createdByName: string | null;
}

export interface PublicShareGraphic {
  filename: string;
  contentType: string;
  body: string | Uint8Array<ArrayBuffer>;
  byteLength: number;
}

const NOT_SHARED: ArtifactShareView = {
  exists: false, visibility: "PRIVATE", pinnedVersion: null, publicId: null,
  titleOverride: null, updatedAt: null, createdByName: null,
};

function storedVisibility(value: string): MediaShareVisibility {
  if (!isMediaShareVisibility(value)) throw new ValidationError("Stored share visibility is invalid.");
  return value;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return slug || "simverse";
}

function humanizeModule(moduleId: string): string {
  return moduleId ? moduleId.charAt(0).toUpperCase() + moduleId.slice(1) : "Simulation";
}

function parseStoredStoryboard(value: string): StoryboardV1 {
  try { return storyboardV1Schema.parse(JSON.parse(value)); }
  catch { throw new ValidationError("Stored storyboard data is invalid."); }
}

function toShareView(share: (MediaShare & { createdBy: { displayName: string } | null }) | null): ArtifactShareView {
  if (!share) return NOT_SHARED;
  return {
    exists: true,
    visibility: storedVisibility(share.visibility),
    pinnedVersion: share.artifactVersion,
    publicId: share.publicId,
    titleOverride: share.titleOverride,
    updatedAt: share.updatedAt.toISOString(),
    createdByName: share.createdBy?.displayName ?? null,
  };
}

const shareInclude = { createdBy: { select: { displayName: true } } } as const;

/** Read the share state for an artifact (any workspace member who can view it). */
export async function getArtifactShare(userId: string, workspaceId: string, artifactId: string): Promise<ArtifactShareView> {
  await requireMembership(userId, workspaceId, "media.view");
  const artifact = await prisma.mediaArtifact.findFirst({
    where: { id: artifactId, workspaceId },
    select: { id: true, share: { include: shareInclude } },
  });
  if (!artifact) throw new NotFoundError("Media artifact not found.");
  return toShareView(artifact.share);
}

/** Create or update an artifact's share (requires media.share). */
export async function setArtifactShare(userId: string, workspaceId: string, artifactId: string, input: unknown): Promise<ArtifactShareView> {
  await requireMembership(userId, workspaceId, "media.share");
  const data = parseOrThrow(setMediaShareSchema, input, "Choose a valid visibility and version.");

  const artifact = await prisma.mediaArtifact.findFirst({
    where: { id: artifactId, workspaceId },
    select: { id: true, status: true, currentVersion: true, share: { select: { id: true, visibility: true } } },
  });
  if (!artifact) throw new NotFoundError("Media artifact not found.");

  const targetVersion = data.version ?? artifact.currentVersion;
  const versionExists = await prisma.mediaArtifactVersion.findUnique({
    where: { artifactId_version: { artifactId, version: targetVersion } },
    select: { version: true },
  });
  if (!versionExists) throw new NotFoundError("That media version does not exist.");

  const makingPublic = isPubliclyVisible(data.visibility);
  if (makingPublic && artifact.status === "ARCHIVED") {
    throw new ConflictError("Restore this artifact before sharing it publicly.");
  }

  const previousVisibility = artifact.share ? storedVisibility(artifact.share.visibility) : null;

  if (!artifact.share) {
    // Nothing to revoke/suspend if there is no share and the target is private.
    if (!makingPublic) return NOT_SHARED;
    await prisma.mediaShare.create({
      data: {
        workspaceId, artifactId, artifactVersion: targetVersion,
        visibility: data.visibility, publicId: generatePublicId(),
        titleOverride: data.titleOverride ?? null, createdById: userId,
      },
    });
    await audit("media.share.created", userId, workspaceId, artifactId, data.visibility, targetVersion);
  } else {
    await prisma.mediaShare.update({
      where: { artifactId },
      data: { visibility: data.visibility, artifactVersion: targetVersion, titleOverride: data.titleOverride ?? null },
    });
    const action = !makingPublic && previousVisibility !== "PRIVATE"
      ? "media.share.revoked"
      : "media.share.updated";
    await audit(action, userId, workspaceId, artifactId, data.visibility, targetVersion);
  }

  return getArtifactShare(userId, workspaceId, artifactId);
}

/** Revoke public access to an artifact's share (sets PRIVATE). */
export async function revokeArtifactShare(userId: string, workspaceId: string, artifactId: string): Promise<ArtifactShareView> {
  await requireMembership(userId, workspaceId, "media.share");
  const artifact = await prisma.mediaArtifact.findFirst({
    where: { id: artifactId, workspaceId },
    select: { id: true, share: { select: { id: true, visibility: true } } },
  });
  if (!artifact) throw new NotFoundError("Media artifact not found.");
  if (artifact.share && artifact.share.visibility !== "PRIVATE") {
    await prisma.mediaShare.update({ where: { artifactId }, data: { visibility: "PRIVATE" } });
    await audit("media.share.revoked", userId, workspaceId, artifactId, "PRIVATE", null);
  }
  return getArtifactShare(userId, workspaceId, artifactId);
}

function generatePublicId(): string {
  return randomBytes(MEDIA_SHARE_PUBLIC_ID_BYTES).toString("base64url");
}

async function audit(action: "media.share.created" | "media.share.updated" | "media.share.revoked", userId: string, workspaceId: string, artifactId: string, visibility: MediaShareVisibility, version: number | null) {
  await recordAudit({
    action, actorUserId: userId, workspaceId, entityType: "MediaShare", entityId: artifactId,
    metadata: { visibility, ...(version != null ? { artifactVersion: version } : {}) },
  });
}

// ---------------------------------------------------------------------------
// Public (unauthenticated) access — resolves ONLY active UNLISTED/PUBLIC shares
// of non-archived artifacts, and returns a deliberately narrow safe projection.
// ---------------------------------------------------------------------------

async function resolvePublicShare(publicId: string) {
  const share = await prisma.mediaShare.findUnique({
    where: { publicId },
    select: { publicId: true, visibility: true, artifactId: true, artifactVersion: true, titleOverride: true, createdAt: true, artifact: { select: { type: true, status: true } } },
  });
  if (!share) throw new NotFoundError("This shared page is not available.");
  const visibility = storedVisibility(share.visibility);
  if (!isPubliclyVisible(visibility) || share.artifact.status === "ARCHIVED") {
    throw new NotFoundError("This shared page is not available.");
  }
  const version = await prisma.mediaArtifactVersion.findUnique({
    where: { artifactId_version: { artifactId: share.artifactId, version: share.artifactVersion } },
  });
  if (!version) throw new NotFoundError("This shared page is not available.");
  return { share, visibility, version };
}

export async function getPublicMediaShare(publicId: string): Promise<PublicMediaShareV1> {
  const { share, visibility, version } = await resolvePublicShare(publicId);
  const storyboard = parseStoredStoryboard(version.storyboard);

  const participants = storyboard.participants.map((participant, index) => ({
    name: participant.name,
    shortName: participant.shortName,
    category: participant.category,
    color: safeColor(participant.primaryColor) ?? seriesColor(index),
    initials: initialsFor(participant.shortName ?? participant.name),
  }));
  const nameByRef = new Map(storyboard.participants.map((p) => [p.runParticipantId, p.name]));
  const resolveName = (ref: string) => nameByRef.get(ref) ?? "Participant";

  const projection: PublicMediaShareV1 = {
    version: 1,
    shareId: share.publicId,
    visibility: visibility === "PUBLIC" ? "PUBLIC" : "UNLISTED",
    artifact: {
      type: share.artifact.type,
      version: version.version,
      aspectRatio: version.aspectRatio as PublicMediaShareV1["artifact"]["aspectRatio"],
      title: share.titleOverride ?? version.title,
      subtitle: version.subtitle,
      description: version.description,
      mode: storyboard.source.mode,
      moduleLabel: humanizeModule(storyboard.source.moduleId),
    },
    result: {
      resultType: storyboard.summary.resultType,
      headline: storyboard.summary.headline,
      detail: storyboard.summary.detail,
      completionReason: storyboard.summary.completionReason,
      winners: storyboard.summary.winnerParticipantRefs.map(resolveName),
      tied: storyboard.summary.tiedParticipantRefs.map(resolveName),
      ranking: storyboard.summary.ranking.map((ref, index) => ({ rank: index + 1, name: resolveName(ref) })),
    },
    participants,
    scenes: storyboard.scenes.filter((scene) => scene.enabled).map((scene) => ({
      kind: scene.kind, title: scene.title, caption: scene.caption,
      participantNames: scene.participantRefs.map(resolveName),
    })),
    branding: { wordmark: "SIMVERSE" },
    createdAt: share.createdAt.toISOString(),
  };

  // Re-validate before it leaves the server: the projection is an external contract.
  return publicMediaShareV1Schema.parse(projection);
}

/** Render the pinned version's graphic for a public share (no auth). */
export async function renderPublicShareGraphic(
  publicId: string,
  options: { type?: string | null; format?: string | null; ratio?: string | null },
): Promise<PublicShareGraphic> {
  const { share, version } = await resolvePublicShare(publicId);
  const storyboard = parseStoredStoryboard(version.storyboard);

  const exportType: MediaExportType = options.type && isMediaExportType(options.type) ? options.type : "RESULT_CARD";
  const format: MediaExportFormat = options.format && isMediaExportFormat(options.format) ? options.format : "png";
  const aspectRatio = options.ratio && options.ratio in MEDIA_EXPORT_DIMENSIONS
    ? (options.ratio as keyof typeof MEDIA_EXPORT_DIMENSIONS)
    : (version.aspectRatio as keyof typeof MEDIA_EXPORT_DIMENSIONS);

  const model = buildResultGraphic({
    artifactId: share.artifactId,
    artifactVersion: version.version,
    exportType,
    aspectRatio,
    title: share.titleOverride ?? version.title,
    subtitle: version.subtitle,
    description: version.description,
    source: { simulationName: storyboard.source.simulationName, mode: storyboard.source.mode, moduleId: storyboard.source.moduleId, moduleVersion: storyboard.source.moduleVersion },
    storyboard,
  });
  const svg = renderResultGraphicSvg(model);
  const base = `simverse-${slugify(share.titleOverride ?? version.title)}-${exportType === "STORY_POSTER" ? "poster" : "card"}-${MEDIA_EXPORT_ASPECT_SLUG[aspectRatio]}`;
  const filename = `${base}.${MEDIA_EXPORT_FILE_EXTENSION[format]}`;

  if (format === "svg") {
    return { filename, contentType: MEDIA_EXPORT_CONTENT_TYPE.svg, body: svg, byteLength: new TextEncoder().encode(svg).length };
  }
  const png = await rasterizeSvgToPng(svg, MEDIA_EXPORT_DIMENSIONS[aspectRatio]);
  return { filename, contentType: MEDIA_EXPORT_CONTENT_TYPE.png, body: png, byteLength: png.byteLength };
}
