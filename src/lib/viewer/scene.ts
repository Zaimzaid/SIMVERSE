import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import {
  ANIMATION_STATES,
  VISUAL_ARCHETYPES,
  type AnimationProfile,
  type VisualArchetype,
} from "@/lib/visuals/profile";
import type { EntityVisualProfile, VisualEntityInstance } from "./types";

function safeModelUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  if (/^\/(?!\/)[^?#]+\.(glb|gltf)(?:[?#].*)?$/i.test(value) || /^https:\/\/[^\s]+\.(glb|gltf)(?:[?#].*)?$/i.test(value)) return value;
  return null;
}

function safePortrait(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return /^https?:\/\//i.test(value) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);base64,/i.test(value) ? value : null;
}

function safeColor(value: string | null, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function bounded(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function animationMapping(value: unknown, legacy = false): AnimationProfile {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const profile: AnimationProfile = {};
  for (const state of ANIMATION_STATES) {
    const clip = raw[state];
    if (typeof clip === "string" && clip.length <= 160) profile[state] = clip;
  }
  if (legacy) {
    if (!profile.ATTACK_PRIMARY && typeof raw.ATTACK === "string") profile.ATTACK_PRIMARY = raw.ATTACK.slice(0, 160);
    if (!profile.HIT_LIGHT && typeof raw.HIT === "string") profile.HIT_LIGHT = raw.HIT.slice(0, 160);
  }
  return profile;
}

/** Resolve visual identity only from the immutable Run participant snapshot. */
export function visualProfile(participant: ParticipantSnapshotV1): EntityVisualProfile {
  const managed = participant.visualProfile?.enabled ? participant.visualProfile : null;
  const legacyRaw = participant.metadata?.visualProfile;
  const legacy = legacyRaw && typeof legacyRaw === "object" && !Array.isArray(legacyRaw)
    ? legacyRaw as Record<string, unknown> : {};
  const data: Record<string, unknown> = managed ?? legacy;
  const modelUrl = safeModelUrl(data.modelUrl);
  const archetype = typeof data.archetype === "string" && (VISUAL_ARCHETYPES as readonly string[]).includes(data.archetype)
    ? data.archetype as VisualArchetype : "ABSTRACT";
  const usesModel = Boolean(modelUrl && (!managed || managed.sourceType === "MODEL_3D"));
  return {
    sourceType: usesModel ? "MODEL_3D" : "PROCEDURAL",
    modelUrl: usesModel ? modelUrl : null,
    portraitUrl: safePortrait(managed?.portraitUrl) ?? safePortrait(participant.imageUrl),
    scale: bounded(data.scale, 1, 0.05, 20),
    rotationX: bounded(data.rotationX, 0, -360, 360),
    rotationY: bounded(data.rotationY ?? data.orientationDegrees, 0, -360, 360),
    rotationZ: bounded(data.rotationZ, 0, -360, 360),
    offsetX: bounded(data.offsetX, 0, -100, 100),
    offsetY: bounded(data.offsetY, 0, -100, 100),
    offsetZ: bounded(data.offsetZ, 0, -100, 100),
    archetype,
    primaryColor: safeColor(participant.primaryColor, "#22d3ee"),
    secondaryColor: safeColor(participant.secondaryColor, "#5068ff"),
    animationProfile: animationMapping(data.animationProfile, !managed),
  };
}

/** Pure deterministic spawn placement; no Entity category affects Battle geometry. */
export function buildArenaScene(participants: ParticipantSnapshotV1[]): VisualEntityInstance[] {
  const ordered = [...participants].sort((a, b) => a.position - b.position);
  return ordered.map((participant, index) => {
    const count = ordered.length;
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    const radius = Math.max(3.25, Math.min(5.1, count * 0.82));
    const x = count === 2 ? (index === 0 ? -3.4 : 3.4) : Math.cos(angle) * radius;
    const z = count === 2 ? 0 : Math.sin(angle) * radius;
    return {
      id: participant.runParticipantId, name: participant.name,
      shortName: participant.shortName || participant.name, category: participant.category,
      profile: visualProfile(participant), x, z, facing: x <= 0 ? 1 : -1,
    };
  });
}
