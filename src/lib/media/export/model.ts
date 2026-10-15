import { z } from "zod";
import { MEDIA_ASPECT_RATIOS, type MediaAspectRatio } from "../constants";
import type { StoryboardV1 } from "../schemas";
import {
  MEDIA_EXPORT_DIMENSIONS,
  MEDIA_EXPORT_FORMATS,
  MEDIA_EXPORT_TYPES,
  STORY_POSTER_MAX_HIGHLIGHTS,
  type MediaExportType,
} from "./constants";

/**
 * ResultGraphicV1 — the validated, bounded view model the renderer consumes.
 *
 * The renderer never touches Prisma rows, a live Simulation or a live Entity.
 * It receives only this model, built from an immutable MediaArtifactVersion's
 * storyboard plus its creator presentation copy. Authoritative truth (winner,
 * ties, ranking, completion reason, participant identity) is copied verbatim
 * from the storyboard; the renderer may stylize it but never recomputes it.
 */

/** Only genuine hex colors are allowed through to SVG attributes. */
const SAFE_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function safeColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return SAFE_COLOR.test(trimmed) ? trimmed : null;
}

/** Deterministic brand palette fallback when a participant has no safe color. */
const BRAND_SERIES = ["#22d3ee", "#8b5cf6", "#3b82f6", "#34d399", "#fbbf24", "#f87171"] as const;

export function seriesColor(index: number): string {
  const safe = ((Math.trunc(index) % BRAND_SERIES.length) + BRAND_SERIES.length) % BRAND_SERIES.length;
  return BRAND_SERIES[safe]!;
}

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

const participantGraphicSchema = z.object({
  ref: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  shortName: z.string().min(1).max(80).nullable(),
  initials: z.string().min(1).max(3),
  category: z.string().min(1).max(120),
  color: z.string().regex(SAFE_COLOR),
}).strict();

const rankedParticipantSchema = z.object({
  rank: z.number().int().positive().max(100_000),
  ref: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
}).strict();

const graphicResultSchema = z.object({
  resultType: z.string().min(1).max(120),
  headline: z.string().min(1).max(200),
  detail: z.string().min(1).max(500),
  completionReason: z.string().min(1).max(120),
  winnerRefs: z.array(z.string().min(1).max(200)).max(500),
  tiedRefs: z.array(z.string().min(1).max(200)).max(500),
  ranking: z.array(rankedParticipantSchema).max(500),
}).strict();

const graphicHighlightSchema = z.object({
  order: z.number().int().nonnegative().max(100),
  kind: z.string().min(1).max(40),
  title: z.string().min(1).max(160),
  caption: z.string().max(600),
}).strict();

export const resultGraphicV1Schema = z.object({
  version: z.literal(1),
  artifactId: z.string().min(1).max(200),
  artifactVersion: z.number().int().positive().max(1_000_000),
  exportType: z.enum(MEDIA_EXPORT_TYPES),
  aspectRatio: z.enum(MEDIA_ASPECT_RATIOS),
  dimensions: z.object({
    width: z.number().int().positive().max(8000),
    height: z.number().int().positive().max(8000),
  }).strict(),
  brand: z.object({
    wordmark: z.string().min(1).max(40),
    tagline: z.string().min(1).max(80).nullable(),
  }).strict(),
  title: z.string().min(1).max(200),
  subtitle: z.string().min(1).max(240).nullable(),
  simulationName: z.string().min(1).max(160),
  mode: z.string().min(1).max(120),
  participants: z.array(participantGraphicSchema).min(1).max(500),
  result: graphicResultSchema,
  highlights: z.array(graphicHighlightSchema).max(STORY_POSTER_MAX_HIGHLIGHTS),
}).strict();

export type ResultGraphicV1 = z.infer<typeof resultGraphicV1Schema>;
export type ResultGraphicParticipant = z.infer<typeof participantGraphicSchema>;
export type ResultGraphicRanked = z.infer<typeof rankedParticipantSchema>;
export type ResultGraphicHighlight = z.infer<typeof graphicHighlightSchema>;

export interface BuildResultGraphicInput {
  artifactId: string;
  artifactVersion: number;
  exportType: MediaExportType;
  aspectRatio: MediaAspectRatio;
  /** Creator presentation copy from the artifact version. */
  title: string;
  subtitle: string | null;
  description: string | null;
  source: { simulationName: string; mode: string; moduleId: string; moduleVersion: string };
  /** Immutable authoritative storyboard snapshot. */
  storyboard: StoryboardV1;
}

/** Scene kinds considered meaningful "moments" for a story poster. */
const POSTER_EXCLUDED_KINDS = new Set(["RESULT", "OUTRO"]);

/**
 * Build a validated ResultGraphicV1 from an immutable artifact version. Pure and
 * isomorphic: identical output on the server (export) and the client (preview).
 */
export function buildResultGraphic(input: BuildResultGraphicInput): ResultGraphicV1 {
  const { storyboard } = input;
  const dimensions = MEDIA_EXPORT_DIMENSIONS[input.aspectRatio];

  const participants: ResultGraphicParticipant[] = storyboard.participants.map((participant, index) => ({
    ref: participant.runParticipantId,
    name: participant.name,
    shortName: participant.shortName,
    initials: initialsFor(participant.shortName ?? participant.name),
    category: participant.category,
    color: safeColor(participant.primaryColor) ?? seriesColor(index),
  }));

  const nameByRef = new Map(participants.map((participant) => [participant.ref, participant.name]));
  const resolveName = (ref: string) => nameByRef.get(ref) ?? "Participant";

  const ranking: ResultGraphicRanked[] = storyboard.summary.ranking.map((ref, index) => ({
    rank: index + 1,
    ref,
    name: resolveName(ref),
  }));

  const highlights: ResultGraphicHighlight[] = storyboard.scenes
    .filter((scene) => scene.enabled && !POSTER_EXCLUDED_KINDS.has(scene.kind))
    .sort((a, b) => a.order - b.order)
    .slice(0, STORY_POSTER_MAX_HIGHLIGHTS)
    .map((scene) => ({ order: scene.order, kind: scene.kind, title: scene.title, caption: scene.caption }));

  return resultGraphicV1Schema.parse({
    version: 1,
    artifactId: input.artifactId,
    artifactVersion: input.artifactVersion,
    exportType: input.exportType,
    aspectRatio: input.aspectRatio,
    dimensions,
    brand: { wordmark: "SIMVERSE", tagline: "Created in SIMVERSE" },
    title: input.title,
    subtitle: input.subtitle,
    simulationName: input.source.simulationName,
    mode: input.source.mode,
    participants,
    result: {
      resultType: storyboard.summary.resultType,
      headline: storyboard.summary.headline,
      detail: storyboard.summary.detail,
      completionReason: storyboard.summary.completionReason,
      winnerRefs: storyboard.summary.winnerParticipantRefs,
      tiedRefs: storyboard.summary.tiedParticipantRefs,
      ranking,
    },
    highlights: input.exportType === "STORY_POSTER" ? highlights : [],
  } satisfies ResultGraphicV1);
}

/**
 * Request contract for the export endpoint. `version` arrives as a query string,
 * so it is coerced; an absent version means "current". Unknown export types or
 * formats fail validation (→ 400) rather than silently defaulting.
 */
export const mediaExportRequestSchema = z.object({
  version: z.coerce.number().int().positive().max(1_000_000).optional(),
  exportType: z.enum(MEDIA_EXPORT_TYPES),
  format: z.enum(MEDIA_EXPORT_FORMATS),
  /** Optional aspect-ratio override; defaults to the version's stored ratio. */
  ratio: z.enum(MEDIA_ASPECT_RATIOS).optional(),
}).strict();

export type MediaExportRequestInput = z.infer<typeof mediaExportRequestSchema>;
