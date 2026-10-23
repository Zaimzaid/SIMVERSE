/**
 * Public / Unlisted Sharing v1 constants.
 *
 * Visibility is the single source of truth for public access. A share is
 * reachable through its public page only while UNLISTED or PUBLIC; PRIVATE means
 * "not publicly accessible" (the default, and the state a revoke returns to).
 */

export const MEDIA_SHARE_VISIBILITIES = ["PRIVATE", "UNLISTED", "PUBLIC"] as const;
export type MediaShareVisibility = (typeof MEDIA_SHARE_VISIBILITIES)[number];

export const MEDIA_SHARE_VISIBILITY_LABELS: Record<MediaShareVisibility, string> = {
  PRIVATE: "Private",
  UNLISTED: "Unlisted",
  PUBLIC: "Public",
};

/** Plain-language help shown in the Studio sharing panel — precise about meaning. */
export const MEDIA_SHARE_VISIBILITY_HELP: Record<MediaShareVisibility, string> = {
  PRIVATE: "Only your workspace can see this. There is no public link.",
  UNLISTED: "Anyone with the link can view it. It will not appear in public discovery.",
  PUBLIC: "Anyone can view it. Public discovery will be added later.",
};

/** 16 random bytes → 22 URL-safe base64url characters (128 bits of entropy). */
export const MEDIA_SHARE_PUBLIC_ID_BYTES = 16;
export const MEDIA_SHARE_TITLE_OVERRIDE_MAX = 200;

export function isMediaShareVisibility(value: string): value is MediaShareVisibility {
  return (MEDIA_SHARE_VISIBILITIES as readonly string[]).includes(value);
}

/** True when a share in this visibility should resolve on the public page. */
export function isPubliclyVisible(visibility: MediaShareVisibility): boolean {
  return visibility === "UNLISTED" || visibility === "PUBLIC";
}

/** Relative paths for the public viewer and its render endpoint. */
export function sharePath(publicId: string): string {
  return `/s/${publicId}`;
}
export function shareImagePath(publicId: string): string {
  return `/s/${publicId}/image`;
}
