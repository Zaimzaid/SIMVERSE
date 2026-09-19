import { z } from "zod";

export const VISUAL_SOURCE_TYPES = [
  "IMAGE",
  "MODEL_3D",
  "PROCEDURAL",
  "SPRITE",
  "ANIMATED_SPRITE",
  "GENERATED_3D",
] as const;
export type VisualSourceType = (typeof VISUAL_SOURCE_TYPES)[number];

export const VISUAL_ARCHETYPES = [
  "HUMANOID",
  "QUADRUPED",
  "CREATURE",
  "ROBOT",
  "VEHICLE_GROUND",
  "VEHICLE_AIR",
  "VEHICLE_WATER",
  "OBJECT",
  "ABSTRACT",
  "CUSTOM",
] as const;
export type VisualArchetype = (typeof VISUAL_ARCHETYPES)[number];

export const ANIMATION_STATES = [
  "IDLE",
  "WALK",
  "RUN",
  "TURN",
  "ATTACK_PRIMARY",
  "ATTACK_SECONDARY",
  "DEFEND",
  "DODGE",
  "HIT_LIGHT",
  "HIT_HEAVY",
  "DEFEATED",
  "VICTORY",
  "INTRO",
  "SPECIAL",
  "STUNNED",
  "JUMP",
  "LAND",
  "FLY",
  "SWIM",
  "EMOTE",
] as const;
export type AnimationState = (typeof ANIMATION_STATES)[number];
export type AnimationProfile = Partial<Record<AnimationState, string>>;

export const PRODUCTION_ANIMATION_STATES = [
  "IDLE",
  "WALK",
  "RUN",
  "TURN",
  "ATTACK_PRIMARY",
  "ATTACK_SECONDARY",
  "DEFEND",
  "DODGE",
  "HIT_LIGHT",
  "HIT_HEAVY",
  "DEFEATED",
  "VICTORY",
  "INTRO",
] as const satisfies readonly AnimationState[];

const modelUrlSchema = z.string().trim().max(2048).refine(
  (value) => {
    if (/^\/(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^?#]+\.(?:glb|gltf)(?:[?#].*)?$/i.test(value)) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && /\.(?:glb|gltf)$/i.test(url.pathname);
    } catch {
      return false;
    }
  },
  "Use a same-origin path or HTTPS URL ending in .gltf or .glb.",
);

const portraitUrlSchema = z.string().trim().max(1_400_000).refine((value) => {
  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|avif);base64,/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}, "Enter a valid portrait URL.");

const optionalText = <T extends z.ZodTypeAny>(schema: T) => z.union([z.literal(""), schema]).optional()
  .transform((value) => value || undefined);
const boundedTransform = z.number().finite().min(-100, "Offset is too small.").max(100, "Offset is too large.");
const boundedRotation = z.number().finite().min(-360, "Rotation is too small.").max(360, "Rotation is too large.");
const clipName = z.string().trim().min(1, "Choose a clip.").max(160, "Clip name is too long.");

export const animationProfileSchema = z.partialRecord(z.enum(ANIMATION_STATES), clipName);

export const visualProfileInputSchema = z.object({
  sourceType: z.enum(VISUAL_SOURCE_TYPES),
  portraitUrl: optionalText(portraitUrlSchema),
  modelUrl: optionalText(modelUrlSchema),
  archetype: z.enum(VISUAL_ARCHETYPES),
  scale: z.number().finite().min(0.05, "Scale must be at least 0.05.").max(20, "Scale must be at most 20."),
  rotationX: boundedRotation,
  rotationY: boundedRotation,
  rotationZ: boundedRotation,
  offsetX: boundedTransform,
  offsetY: boundedTransform,
  offsetZ: boundedTransform,
  animationProfile: animationProfileSchema,
  enabled: z.boolean(),
}).superRefine((value, context) => {
  if (value.sourceType === "MODEL_3D" && !value.modelUrl) {
    context.addIssue({ code: "custom", path: ["modelUrl"], message: "Assign a GLTF or GLB model for this source." });
  }
});
export type VisualProfileInput = z.infer<typeof visualProfileInputSchema>;

export interface VisualProfileSnapshotV1 extends VisualProfileInput {
  version: 1;
  profileRevision: number;
}

export const visualProfileSnapshotSchema = visualProfileInputSchema.safeExtend({
  version: z.literal(1),
  profileRevision: z.number().int().positive(),
});

export const DEFAULT_VISUAL_PROFILE: VisualProfileInput = {
  sourceType: "PROCEDURAL",
  portraitUrl: undefined,
  modelUrl: undefined,
  archetype: "CUSTOM",
  scale: 1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  animationProfile: {},
  enabled: true,
};

const ALIASES: Record<AnimationState, readonly string[]> = {
  IDLE: ["idle", "breath", "stand"],
  WALK: ["walk"], RUN: ["run", "sprint", "gallop"], TURN: ["turn"],
  ATTACK_PRIMARY: ["attack", "strike", "bite", "punch", "slash"],
  ATTACK_SECONDARY: ["attack2", "attack_2", "secondary", "kick"],
  DEFEND: ["defend", "guard", "block"], DODGE: ["dodge", "evade", "roll"],
  HIT_LIGHT: ["hit", "damage", "impact", "react"], HIT_HEAVY: ["heavyhit", "hit_heavy", "knockback"],
  DEFEATED: ["death", "defeat", "die", "fall"], VICTORY: ["victory", "celebrate", "win", "roar"],
  INTRO: ["intro", "entrance", "spawn"], SPECIAL: ["special"], STUNNED: ["stun"],
  JUMP: ["jump"], LAND: ["land"], FLY: ["fly"], SWIM: ["swim"], EMOTE: ["emote", "taunt"],
};

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ""); }

/** Conservative, non-destructive suggestions. The creator must save them. */
export function suggestAnimationMappings(clips: readonly string[]): AnimationProfile {
  const available = clips.map((clip) => ({ clip, key: normalized(clip) }));
  const suggestions: AnimationProfile = {};
  for (const state of ANIMATION_STATES) {
    const aliases = ALIASES[state].map(normalized);
    const exact = available.find(({ key }) => aliases.includes(key));
    const partial = available.find(({ key }) => aliases.some((alias) => key.includes(alias)));
    const match = exact ?? partial;
    if (match) suggestions[state] = match.clip;
  }
  return suggestions;
}

export interface ModelInspection {
  loaded: boolean;
  animationNames: string[];
  sceneCount: number;
  meshCount: number;
  skinnedMeshCount: number;
  skeletonDetected: boolean;
  dimensions: { x: number; y: number; z: number } | null;
  byteSize: number | null;
  error: string | null;
}

export type VisualValidationStatus = "READY" | "PARTIAL" | "FALLBACK REQUIRED" | "INVALID";

export function visualValidationStatus(
  profile: Pick<VisualProfileInput, "sourceType" | "modelUrl" | "animationProfile">,
  inspection: ModelInspection | null,
): VisualValidationStatus {
  if (profile.sourceType !== "MODEL_3D" || !profile.modelUrl) return "FALLBACK REQUIRED";
  if (inspection && !inspection.loaded) return "INVALID";
  if (!inspection) return "PARTIAL";
  const existing = new Set(inspection.animationNames);
  const mapped = Object.values(profile.animationProfile);
  if (!mapped.every((clip) => existing.has(clip))) return "PARTIAL";
  const readinessStates: AnimationState[] = [
    "IDLE", "RUN", "ATTACK_PRIMARY", "DODGE", "HIT_LIGHT", "DEFEATED", "VICTORY",
  ];
  return readinessStates.every((state) => {
    const clip = profile.animationProfile[state];
    return Boolean(clip && existing.has(clip));
  }) ? "READY" : "PARTIAL";
}
