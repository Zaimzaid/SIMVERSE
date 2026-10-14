import { z } from "zod";
import {
  MEDIA_ARTIFACT_STATUSES,
  MEDIA_ARTIFACT_TYPES,
  MEDIA_ASPECT_RATIOS,
  STORYBOARD_SCENE_KINDS,
  STORYBOARD_VERSION,
} from "./constants";

const optionalCopy = (maximum: number) => z.union([
  z.string().trim().max(maximum),
  z.literal(""),
]).optional().transform((value) => value || undefined);

export const mediaArtifactTypeSchema = z.enum(MEDIA_ARTIFACT_TYPES);
export const mediaArtifactStatusSchema = z.enum(MEDIA_ARTIFACT_STATUSES);
export const mediaAspectRatioSchema = z.enum(MEDIA_ASPECT_RATIOS);
export const storyboardSceneKindSchema = z.enum(STORYBOARD_SCENE_KINDS);

export const storyboardParticipantSchema = z.object({
  runParticipantId: z.string().min(1).max(200),
  sourceEntityId: z.string().min(1).max(200),
  position: z.number().int().nonnegative().max(10_000),
  name: z.string().trim().min(1).max(120),
  shortName: z.string().trim().min(1).max(80).nullable(),
  category: z.string().trim().min(1).max(120),
  imageUrl: z.string().max(1_400_000).nullable(),
  primaryColor: z.string().max(40).nullable(),
  secondaryColor: z.string().max(40).nullable(),
}).strict();

export const storyboardSourceSchema = z.object({
  runId: z.string().min(1).max(200),
  simulationId: z.string().min(1).max(200),
  simulationName: z.string().trim().min(1).max(160),
  mode: z.string().trim().min(1).max(120),
  moduleId: z.string().trim().min(1).max(120),
  moduleVersion: z.string().trim().min(1).max(120),
}).strict();

export const storyboardSummarySchema = z.object({
  resultType: z.string().trim().min(1).max(120),
  headline: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(500),
  completionReason: z.string().trim().min(1).max(120),
  winnerParticipantRefs: z.array(z.string().min(1).max(200)).max(500),
  tiedParticipantRefs: z.array(z.string().min(1).max(200)).max(500),
  ranking: z.array(z.string().min(1).max(200)).min(1).max(500),
}).strict();

export const storyboardSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  order: z.number().int().nonnegative().max(100),
  kind: storyboardSceneKindSchema,
  title: z.string().trim().min(1).max(160),
  caption: z.string().trim().max(600),
  sourceEventSequence: z.number().int().positive().optional(),
  participantRefs: z.array(z.string().min(1).max(200)).max(500),
  durationHintMs: z.number().int().min(500).max(30_000).optional(),
  enabled: z.boolean(),
}).strict();

export const storyboardV1Schema = z.object({
  version: z.literal(STORYBOARD_VERSION),
  source: storyboardSourceSchema,
  participants: z.array(storyboardParticipantSchema).min(2).max(500),
  summary: storyboardSummarySchema,
  scenes: z.array(storyboardSceneSchema).min(3).max(12),
}).strict().superRefine((storyboard, context) => {
  const participantIds = new Set(storyboard.participants.map((item) => item.runParticipantId));
  if (participantIds.size !== storyboard.participants.length) {
    context.addIssue({ code: "custom", path: ["participants"], message: "Participant references must be unique." });
  }
  const sceneIds = new Set<string>();
  const orders = new Set<number>();
  for (const [index, scene] of storyboard.scenes.entries()) {
    if (sceneIds.has(scene.id)) context.addIssue({ code: "custom", path: ["scenes", index, "id"], message: "Scene identifiers must be unique." });
    if (orders.has(scene.order)) context.addIssue({ code: "custom", path: ["scenes", index, "order"], message: "Scene order must be unique." });
    sceneIds.add(scene.id); orders.add(scene.order);
    for (const ref of scene.participantRefs) {
      if (!participantIds.has(ref)) context.addIssue({ code: "custom", path: ["scenes", index, "participantRefs"], message: "Scene participant is not part of the source Run." });
    }
  }
  const summaryRefs = [
    ...storyboard.summary.winnerParticipantRefs,
    ...storyboard.summary.tiedParticipantRefs,
    ...storyboard.summary.ranking,
  ];
  if (summaryRefs.some((ref) => !participantIds.has(ref))) {
    context.addIssue({ code: "custom", path: ["summary"], message: "Result references must belong to the source Run." });
  }
  if (!storyboard.scenes.some((scene) => scene.kind === "RESULT")) {
    context.addIssue({ code: "custom", path: ["scenes"], message: "A storyboard must contain a result scene." });
  }
});
export type StoryboardV1 = z.infer<typeof storyboardV1Schema>;
export type StoryboardSceneV1 = z.infer<typeof storyboardSceneSchema>;

export const createMediaArtifactFromRunSchema = z.object({
  runId: z.string().trim().min(1).max(200),
  aspectRatio: mediaAspectRatioSchema.default("LANDSCAPE_16_9"),
}).strict();

export const editableStoryboardSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  order: z.number().int().nonnegative().max(100),
  title: z.string().trim().min(1).max(160),
  caption: z.string().trim().max(600),
  enabled: z.boolean(),
}).strict();

export const createMediaArtifactVersionSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(160),
  subtitle: optionalCopy(240),
  description: optionalCopy(2_000),
  aspectRatio: mediaAspectRatioSchema,
  status: z.enum(["DRAFT", "READY"]),
  scenes: z.array(editableStoryboardSceneSchema).min(3).max(12),
}).strict();

export type CreateMediaArtifactFromRunInput = z.infer<typeof createMediaArtifactFromRunSchema>;
export type CreateMediaArtifactVersionInput = z.infer<typeof createMediaArtifactVersionSchema>;
