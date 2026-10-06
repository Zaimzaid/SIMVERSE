import { z } from "zod";
import { safeAssetReferenceSchema } from "@/lib/assets/schemas";
import { ANIMATION_STATES, VISUAL_ARCHETYPES } from "@/lib/visuals/profile";
import {
  AUDIO_CUES, BATTLE_EXPERIENCE_EVENT_TYPES, CAMERA_ANGLES, CAMERA_CUES, CAMERA_DISTANCES,
  CAMERA_SUBJECTS, EXPERIENCE_ASSET_ROLES, EXPERIENCE_OVERRIDE_KINDS,
  EXPERIENCE_PRESET_TYPES, EXPERIENCE_PROFILE_SCHEMA_VERSION, EXPERIENCE_PROFILE_STATUSES,
  HUD_CUES, VFX_CUES,
} from "./constants";

const optionalText = (max: number) => z.union([z.literal(""), z.string().trim().max(max)]).optional()
  .transform((value) => value || undefined);
const optionalReference = z.union([z.literal(""), safeAssetReferenceSchema]).optional()
  .transform((value) => value || undefined);
const identifier = z.string().trim().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/,
  "Use letters, numbers, underscores, or hyphens and start with a letter.");
const compatibilityKey = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9._-]*$/,
  "Use a lowercase module or mode key.");
const tag = z.string().trim().min(1).max(60);
const normalized = z.number().finite().min(0).max(1);
const milliseconds = z.number().int().min(0).max(60_000);

export const experienceAssetAssociationSchema = z.object({
  identifier,
  assetId: z.string().trim().min(1).max(200),
  assetVersion: z.number().int().positive(),
  role: z.enum(EXPERIENCE_ASSET_ROLES),
}).strict();

export const experienceWorldAssociationSchema = z.object({
  worldId: z.string().trim().min(1).max(200),
  worldVersion: z.number().int().positive(),
  preferredCameraZone: optionalText(80),
  resultZonePreference: optionalText(80),
  vfxSurfaceResponseCategory: optionalText(80),
  ambientIntensity: normalized.default(0.5),
  lightingCue: optionalText(120),
  weatherPresentationCue: optionalText(120),
}).strict();

const conditionField = z.enum([
  "payload.format", "payload.maxTicks", "payload.health", "payload.reason", "payload.baseDamage",
  "payload.critical", "payload.dodged", "payload.guarded", "payload.finalDamage",
  "payload.targetHealthBefore", "payload.targetHealthAfter", "payload.targetHealth", "payload.amount",
  "payload.healthBefore", "payload.healthAfter", "payload.eliminationTick", "payload.eliminationRank",
  "payload.survivors", "payload.completionReason", "payload.winnerRunParticipantId",
]);
const conditionSchema = z.object({
  field: conditionField,
  operator: z.enum(["EQ", "NE", "GT", "GTE", "LT", "LTE", "PRESENT"]),
  value: z.union([z.string().max(160), z.number().finite(), z.boolean(), z.null()]).optional(),
}).strict().superRefine((value, context) => {
  if (value.operator === "PRESENT" && value.value !== undefined) context.addIssue({ code: "custom", path: ["value"], message: "PRESENT does not accept a comparison value." });
  if (value.operator !== "PRESENT" && value.value === undefined) context.addIssue({ code: "custom", path: ["value"], message: "Choose a comparison value." });
  if (["GT", "GTE", "LT", "LTE"].includes(value.operator) && typeof value.value !== "number") context.addIssue({ code: "custom", path: ["value"], message: "Ordered comparisons require a number." });
});

const CONDITION_FIELDS_BY_EVENT: Record<(typeof BATTLE_EXPERIENCE_EVENT_TYPES)[number], readonly string[]> = {
  "battle.started": ["payload.format", "payload.maxTicks"],
  "battle.attack": ["payload.baseDamage", "payload.critical", "payload.dodged", "payload.guarded", "payload.finalDamage", "payload.targetHealthBefore", "payload.targetHealthAfter"],
  "battle.defend": ["payload.health", "payload.reason"],
  "battle.dodged": ["payload.targetHealth"],
  "battle.critical_hit": ["payload.finalDamage"],
  "battle.damage": ["payload.amount", "payload.healthBefore", "payload.healthAfter", "payload.guarded"],
  "battle.eliminated": ["payload.eliminationTick", "payload.eliminationRank"],
  "battle.timeout": ["payload.maxTicks", "payload.survivors"],
  "battle.completed": ["payload.completionReason", "payload.winnerRunParticipantId"],
};

const overrideSchema = z.object({
  kind: z.enum(EXPERIENCE_OVERRIDE_KINDS),
  value: z.string().trim().min(1).max(200),
}).strict().superRefine((value, context) => {
  if (value.kind === "ARCHETYPE" && !(VISUAL_ARCHETYPES as readonly string[]).includes(value.value)) {
    context.addIssue({ code: "custom", path: ["value"], message: "Choose a known visual archetype." });
  }
});

const cameraCueSchema = z.object({
  mode: z.enum(CAMERA_CUES), priority: z.number().int().min(-1000).max(1000).default(0),
  durationMs: milliseconds, blendDurationMs: milliseconds,
  framingPreference: optionalText(160), subject: z.enum(CAMERA_SUBJECTS),
  distanceClass: z.enum(CAMERA_DISTANCES), anglePreference: z.enum(CAMERA_ANGLES),
  shakeIntensity: normalized, worldCameraZonePreference: optionalText(80),
}).strict();

export const experienceEventBindingSchema = z.object({
  identifier,
  eventType: z.enum(BATTLE_EXPERIENCE_EVENT_TYPES),
  priority: z.number().int().min(-1000).max(1000).default(0),
  condition: conditionSchema.optional(),
  override: overrideSchema.optional(),
  animation: z.object({ actor: z.enum(ANIMATION_STATES).optional(), target: z.enum(ANIMATION_STATES).optional() }).strict().optional(),
  camera: cameraCueSchema.optional(),
  vfx: z.object({ cue: z.enum(VFX_CUES), assetIdentifier: optionalText(80), surfaceResponseCategory: optionalText(80) }).strict().optional(),
  audio: z.object({ cue: z.enum(AUDIO_CUES), assetIdentifier: optionalText(80) }).strict().optional(),
  hud: z.object({ cues: z.array(z.enum(HUD_CUES)).max(12), uiAssetIdentifier: optionalText(80), messageTemplate: optionalText(240) }).strict().optional(),
  intensity: z.object({ camera: normalized, vfx: normalized, audio: normalized, reaction: normalized, slowMotion: normalized }).strict(),
  timing: z.object({ preDelayMs: milliseconds, holdMs: milliseconds, postDelayMs: milliseconds, transitionDurationMs: milliseconds, playbackEmphasis: normalized, slowMotionPreference: normalized }).strict(),
}).strict().superRefine((value, context) => {
  if (!value.animation && !value.camera && !value.vfx && !value.audio && !value.hud) context.addIssue({ code: "custom", message: "Add at least one presentation cue." });
  if (value.condition && !CONDITION_FIELDS_BY_EVENT[value.eventType].includes(value.condition.field)) context.addIssue({ code: "custom", path: ["condition", "field"], message: "That condition field is not authoritative for this event type." });
});

export const experienceDefinitionSchema = z.object({
  schemaVersion: z.literal(EXPERIENCE_PROFILE_SCHEMA_VERSION).default(EXPERIENCE_PROFILE_SCHEMA_VERSION),
  preset: z.enum(EXPERIENCE_PRESET_TYPES),
  moduleCompatibility: z.array(compatibilityKey).min(1).max(30),
  simulationModeCompatibility: z.array(compatibilityKey).min(1).max(30),
  eventBindings: z.array(experienceEventBindingSchema).min(1).max(250),
  assetAssociations: z.array(experienceAssetAssociationSchema).max(100).default([]),
  worldAssociations: z.array(experienceWorldAssociationSchema).max(50).default([]),
}).strict().superRefine((value, context) => {
  unique(value.eventBindings, (item) => item.identifier, context, ["eventBindings"], "Binding identifiers must be unique.");
  unique(value.assetAssociations, (item) => item.identifier, context, ["assetAssociations"], "Asset identifiers must be unique.");
  unique(value.worldAssociations, (item) => `${item.worldId}:${item.worldVersion}`, context, ["worldAssociations"], "World version associations must be unique.");
  const selectors = new Set<string>();
  value.eventBindings.forEach((binding, index) => {
    const selector = JSON.stringify([binding.eventType, binding.priority, binding.condition ?? null, binding.override ?? null]);
    if (selectors.has(selector)) context.addIssue({ code: "custom", path: ["eventBindings", index], message: "This binding conflicts with another binding using the same event, priority, condition and override." });
    selectors.add(selector);
  });
  const assets = new Map(value.assetAssociations.map((item) => [item.identifier, item.role]));
  if (!value.moduleCompatibility.includes("battle")) context.addIssue({ code: "custom", path: ["moduleCompatibility"], message: "Battle event bindings require Battle module compatibility." });
  if (!value.simulationModeCompatibility.includes("battle")) context.addIssue({ code: "custom", path: ["simulationModeCompatibility"], message: "Battle event bindings require Battle simulation-mode compatibility." });
  value.eventBindings.forEach((binding, index) => {
    for (const [identifierValue, role, path] of [
      [binding.vfx?.assetIdentifier, "VFX", "vfx"], [binding.audio?.assetIdentifier, "AUDIO", "audio"], [binding.hud?.uiAssetIdentifier, "UI", "hud"],
    ] as const) {
      if (identifierValue && assets.get(identifierValue) !== role) context.addIssue({ code: "custom", path: ["eventBindings", index, path], message: `Cue references a missing ${role} Asset association.` });
    }
  });
});

const profileShape = {
  name: z.string().trim().min(1, "Name is required.").max(160),
  description: optionalText(4000),
  status: z.enum(EXPERIENCE_PROFILE_STATUSES).refine((value) => value !== "ARCHIVED", "Use the archive action to archive a Profile.").default("DRAFT"),
  tags: z.array(tag).max(30).default([]),
  thumbnailReference: optionalReference,
  definition: experienceDefinitionSchema,
  changeNote: optionalText(500),
};

export const createExperienceProfileSchema = z.object(profileShape).strict();
export const updateExperienceProfileSchema = z.object(profileShape).partial().strict();
export type CreateExperienceProfileInput = z.infer<typeof createExperienceProfileSchema>;
export type ExperienceDefinitionV1 = z.infer<typeof experienceDefinitionSchema>;
export type ExperienceEventBinding = z.infer<typeof experienceEventBindingSchema>;
export type ExperienceAssetAssociation = z.infer<typeof experienceAssetAssociationSchema>;
export type ExperienceWorldAssociation = z.infer<typeof experienceWorldAssociationSchema>;

export const experienceRunSnapshotSchema = z.object({
  snapshotVersion: z.literal(1), experienceProfileId: z.string().min(1), version: z.number().int().positive(),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/), name: z.string().min(1),
  preset: z.enum(EXPERIENCE_PRESET_TYPES), definition: experienceDefinitionSchema,
}).strict();

function unique<T>(items: T[], key: (item: T) => string, context: z.RefinementCtx, path: (string | number)[], message: string) {
  const seen = new Set<string>();
  items.forEach((item, index) => { const value = key(item); if (seen.has(value)) context.addIssue({ code: "custom", path: [...path, index], message }); seen.add(value); });
}
