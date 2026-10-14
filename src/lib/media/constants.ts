export const MEDIA_ARTIFACT_TYPES = ["STORYBOARD"] as const;
export type MediaArtifactType = (typeof MEDIA_ARTIFACT_TYPES)[number];

export const MEDIA_ARTIFACT_STATUSES = ["DRAFT", "READY", "ARCHIVED"] as const;
export type MediaArtifactStatus = (typeof MEDIA_ARTIFACT_STATUSES)[number];

export const MEDIA_ASPECT_RATIOS = [
  "LANDSCAPE_16_9",
  "PORTRAIT_9_16",
  "SQUARE_1_1",
] as const;
export type MediaAspectRatio = (typeof MEDIA_ASPECT_RATIOS)[number];

export const MEDIA_ASPECT_RATIO_LABELS: Record<MediaAspectRatio, string> = {
  LANDSCAPE_16_9: "Landscape · 16:9",
  PORTRAIT_9_16: "Vertical · 9:16",
  SQUARE_1_1: "Square · 1:1",
};

export const STORYBOARD_SCENE_KINDS = [
  "INTRO",
  "COMPETITOR",
  "HIGHLIGHT",
  "TURNING_POINT",
  "RESULT",
  "OUTRO",
] as const;
export type StoryboardSceneKind = (typeof STORYBOARD_SCENE_KINDS)[number];

export const STORYBOARD_VERSION = 1 as const;
export const MEDIA_ARTIFACT_PAGE_SIZE = 24;
export const MEDIA_ARTIFACT_MAX_PAGE_SIZE = 50;
export const MAX_STORYBOARD_HIGHLIGHTS = 6;

export function isMediaArtifactStatus(value: string): value is MediaArtifactStatus {
  return (MEDIA_ARTIFACT_STATUSES as readonly string[]).includes(value);
}

export function isMediaArtifactType(value: string): value is MediaArtifactType {
  return (MEDIA_ARTIFACT_TYPES as readonly string[]).includes(value);
}

export function isMediaAspectRatio(value: string): value is MediaAspectRatio {
  return (MEDIA_ASPECT_RATIOS as readonly string[]).includes(value);
}
