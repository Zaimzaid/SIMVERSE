import { NotFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import {
  MEDIA_EXPORT_ASPECT_SLUG,
  MEDIA_EXPORT_CONTENT_TYPE,
  MEDIA_EXPORT_DIMENSIONS,
  MEDIA_EXPORT_FILE_EXTENSION,
} from "@/lib/media/export/constants";
import { buildResultGraphic, mediaExportRequestSchema } from "@/lib/media/export/model";
import { renderResultGraphicSvg } from "@/lib/media/export/svg";
import { rasterizeSvgToPng } from "@/server/media/rasterize";
import { getMediaArtifact } from "./media-artifact-service";

export interface MediaExportResult {
  filename: string;
  contentType: string;
  /** SVG payloads are strings; PNG payloads are bytes. */
  body: string | Uint8Array<ArrayBuffer>;
  byteLength: number;
}

const EXPORT_TYPE_SLUG = { RESULT_CARD: "result-card", STORY_POSTER: "story-poster" } as const;

/** Build a safe, bounded, lowercase filename slug — never derived from a path. */
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "simverse";
}

/**
 * Render a portable graphic from an immutable artifact version.
 *
 * Authority: this reads a saved MediaArtifactVersion only — never a live
 * Simulation or Entity — so version N always renders as version N. It performs
 * no result calculation; it stylizes the storyboard's authoritative summary.
 *
 * Permission + isolation: getMediaArtifact re-checks `media.view` membership on
 * the server and scopes the lookup to the active workspace, so a foreign
 * artifact id surfaces a safe NotFound.
 */
export async function renderArtifactExport(
  userId: string,
  workspaceId: string,
  artifactId: string,
  input: unknown,
): Promise<MediaExportResult> {
  const request = parseOrThrow(mediaExportRequestSchema, input, "Choose a valid export type and format.");
  const artifact = await getMediaArtifact(userId, workspaceId, artifactId);

  const targetVersion = request.version ?? artifact.currentVersion;
  const version = artifact.versions.find((candidate) => candidate.version === targetVersion);
  if (!version) throw new NotFoundError("That media version does not exist.");

  const aspectRatio = request.ratio ?? version.aspectRatio;

  const model = buildResultGraphic({
    artifactId: artifact.id,
    artifactVersion: version.version,
    exportType: request.exportType,
    aspectRatio,
    title: version.title,
    subtitle: version.subtitle,
    description: version.description,
    source: {
      simulationName: artifact.source.simulationName,
      mode: artifact.source.mode,
      moduleId: artifact.source.moduleId,
      moduleVersion: artifact.source.moduleVersion,
    },
    storyboard: version.storyboard,
  });

  const svg = renderResultGraphicSvg(model);
  const base = `${slugify(artifact.source.simulationName || version.title)}-${EXPORT_TYPE_SLUG[request.exportType]}-v${version.version}-${MEDIA_EXPORT_ASPECT_SLUG[aspectRatio]}`;
  const filename = `${base}.${MEDIA_EXPORT_FILE_EXTENSION[request.format]}`;

  if (request.format === "svg") {
    return {
      filename,
      contentType: MEDIA_EXPORT_CONTENT_TYPE.svg,
      body: svg,
      byteLength: new TextEncoder().encode(svg).length,
    };
  }

  const png = await rasterizeSvgToPng(svg, MEDIA_EXPORT_DIMENSIONS[aspectRatio]);
  return {
    filename,
    contentType: MEDIA_EXPORT_CONTENT_TYPE.png,
    body: png,
    byteLength: png.byteLength,
  };
}
