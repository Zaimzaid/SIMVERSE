import { z } from "zod";
import { MEDIA_ASPECT_RATIOS } from "../constants";
import {
  MEDIA_SHARE_VISIBILITIES,
  MEDIA_SHARE_TITLE_OVERRIDE_MAX,
} from "./constants";

/**
 * Input contract for creating/updating a share. `visibility` may be any of the
 * three states (setting PRIVATE suspends public access); `version` defaults to
 * the artifact's current version; `titleOverride` is optional public copy.
 */
export const setMediaShareSchema = z.object({
  visibility: z.enum(MEDIA_SHARE_VISIBILITIES),
  version: z.coerce.number().int().positive().max(1_000_000).optional(),
  titleOverride: z
    .union([z.string().trim().max(MEDIA_SHARE_TITLE_OVERRIDE_MAX), z.literal("")])
    .optional()
    .transform((value) => value || undefined),
}).strict();

export type SetMediaShareInput = z.infer<typeof setMediaShareSchema>;

/**
 * PublicMediaShareV1 — the deliberately narrow, presentation-ready projection
 * returned to the anonymous public page. It is resolved entirely to safe
 * display values server-side: no runParticipantId, sourceEntityId, workspace or
 * member identifiers, seed, raw events, or any other internal field ever
 * appears here. Treat all string fields as plain text (never HTML).
 */
const publicParticipantSchema = z.object({
  name: z.string().min(1).max(120),
  shortName: z.string().min(1).max(80).nullable(),
  category: z.string().min(1).max(120),
  color: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/),
  initials: z.string().min(1).max(3),
}).strict();

const publicRankedSchema = z.object({
  rank: z.number().int().positive().max(100_000),
  name: z.string().min(1).max(120),
}).strict();

const publicSceneSchema = z.object({
  kind: z.string().min(1).max(40),
  title: z.string().min(1).max(160),
  caption: z.string().max(600),
  participantNames: z.array(z.string().min(1).max(120)).max(64),
}).strict();

export const publicMediaShareV1Schema = z.object({
  version: z.literal(1),
  shareId: z.string().min(1).max(64),
  visibility: z.enum(["UNLISTED", "PUBLIC"]),
  artifact: z.object({
    type: z.string().min(1).max(40),
    version: z.number().int().positive().max(1_000_000),
    aspectRatio: z.enum(MEDIA_ASPECT_RATIOS),
    title: z.string().min(1).max(240),
    subtitle: z.string().min(1).max(240).nullable(),
    description: z.string().min(1).max(2_000).nullable(),
    mode: z.string().min(1).max(120),
    moduleLabel: z.string().min(1).max(120),
  }).strict(),
  result: z.object({
    resultType: z.string().min(1).max(120),
    headline: z.string().min(1).max(200),
    detail: z.string().min(1).max(500),
    completionReason: z.string().min(1).max(120),
    winners: z.array(z.string().min(1).max(120)).max(500),
    tied: z.array(z.string().min(1).max(120)).max(500),
    ranking: z.array(publicRankedSchema).max(500),
  }).strict(),
  participants: z.array(publicParticipantSchema).min(1).max(500),
  scenes: z.array(publicSceneSchema).max(12),
  branding: z.object({ wordmark: z.string().min(1).max(40) }).strict(),
  createdAt: z.string(),
}).strict();

export type PublicMediaShareV1 = z.infer<typeof publicMediaShareV1Schema>;
export type PublicShareParticipant = z.infer<typeof publicParticipantSchema>;
export type PublicShareScene = z.infer<typeof publicSceneSchema>;
