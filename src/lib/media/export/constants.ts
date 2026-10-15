import type { MediaAspectRatio } from "../constants";

/**
 * Creator / Media — Image / Post Export v1 constants.
 *
 * These describe the portable graphics SIMVERSE can render from an immutable
 * MediaArtifactVersion. The values here are the only approved export presets;
 * no width/height ever comes from the client (see the export service).
 */

export const MEDIA_EXPORT_TYPES = ["RESULT_CARD", "STORY_POSTER"] as const;
export type MediaExportType = (typeof MEDIA_EXPORT_TYPES)[number];

export const MEDIA_EXPORT_FORMATS = ["png", "svg"] as const;
export type MediaExportFormat = (typeof MEDIA_EXPORT_FORMATS)[number];

export const MEDIA_EXPORT_TYPE_LABELS: Record<MediaExportType, string> = {
  RESULT_CARD: "Result card",
  STORY_POSTER: "Story poster",
};

export const MEDIA_EXPORT_FORMAT_LABELS: Record<MediaExportFormat, string> = {
  png: "PNG",
  svg: "SVG",
};

export interface ExportDimensions {
  width: number;
  height: number;
}

/** The one source of truth mapping an artifact aspect ratio to output pixels. */
export const MEDIA_EXPORT_DIMENSIONS: Record<MediaAspectRatio, ExportDimensions> = {
  LANDSCAPE_16_9: { width: 1920, height: 1080 },
  PORTRAIT_9_16: { width: 1080, height: 1920 },
  SQUARE_1_1: { width: 1080, height: 1080 },
};

/** Short slug fragment used in download filenames. */
export const MEDIA_EXPORT_ASPECT_SLUG: Record<MediaAspectRatio, string> = {
  LANDSCAPE_16_9: "landscape",
  PORTRAIT_9_16: "vertical",
  SQUARE_1_1: "square",
};

export const MEDIA_EXPORT_CONTENT_TYPE: Record<MediaExportFormat, string> = {
  png: "image/png",
  svg: "image/svg+xml",
};

export const MEDIA_EXPORT_FILE_EXTENSION: Record<MediaExportFormat, string> = {
  png: "png",
  svg: "svg",
};

/** Story poster highlight bounds — a poster must never become a wall of captions. */
export const STORY_POSTER_MIN_HIGHLIGHTS = 2;
export const STORY_POSTER_MAX_HIGHLIGHTS = 4;

/** Hard ceiling on the rendered SVG string: a server resource guard. */
export const MAX_EXPORT_SVG_BYTES = 1_500_000;

export function isMediaExportType(value: string): value is MediaExportType {
  return (MEDIA_EXPORT_TYPES as readonly string[]).includes(value);
}

export function isMediaExportFormat(value: string): value is MediaExportFormat {
  return (MEDIA_EXPORT_FORMATS as readonly string[]).includes(value);
}
