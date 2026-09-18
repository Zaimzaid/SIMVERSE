import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import type { AnimationProfile, EntityVisualProfile, VisualArchetype, VisualEntityInstance } from "./types";

const archetypes: VisualArchetype[] = ["HUMANOID", "QUADRUPED", "CREATURE", "ROBOT", "VEHICLE_GROUND", "VEHICLE_AIR", "VEHICLE_WATER", "OBJECT", "ABSTRACT", "CUSTOM"];
const animationStates = ["IDLE", "WALK", "RUN", "ATTACK", "DEFEND", "DODGE", "HIT", "DEFEATED", "VICTORY"] as const;

function safeModelUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  // Only project-hosted assets or HTTPS resources are eligible. The browser still enforces CORS.
  if (/^\/(?!\/)[^?#]+\.(glb|gltf)(?:[?#].*)?$/i.test(value) || /^https:\/\/[^\s]+\.(glb|gltf)(?:[?#].*)?$/i.test(value)) return value;
  return null;
}

function safePortrait(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);base64,/i.test(value) ? value : null;
}

function safeColor(value: string | null, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

/** Read only snapshotted identity. Phase 6 will replace this metadata bridge with managed Visual Assets. */
export function visualProfile(participant: ParticipantSnapshotV1): EntityVisualProfile {
  const raw = participant.metadata?.visualProfile;
  const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const modelUrl = safeModelUrl(data.modelUrl);
  const scale = typeof data.scale === "number" && Number.isFinite(data.scale) ? Math.max(0.25, Math.min(2, data.scale)) : 1;
  const orientationDegrees = typeof data.orientationDegrees === "number" && Number.isFinite(data.orientationDegrees)
    ? Math.max(-180, Math.min(180, data.orientationDegrees)) : 0;
  const archetype = typeof data.archetype === "string" && archetypes.includes(data.archetype as VisualArchetype)
    ? data.archetype as VisualArchetype : "ABSTRACT";
  const rawClips = data.animationProfile && typeof data.animationProfile === "object" && !Array.isArray(data.animationProfile)
    ? data.animationProfile as Record<string, unknown> : {};
  const animationProfile: AnimationProfile = {};
  for (const state of animationStates) {
    const clip = rawClips[state];
    if (typeof clip === "string" && clip.length <= 100) animationProfile[state] = clip;
  }
  return {
    sourceType: modelUrl ? "MODEL_3D" : "PROCEDURAL_3D", modelUrl, portraitUrl: safePortrait(participant.imageUrl),
    scale, orientationDegrees, archetype,
    primaryColor: safeColor(participant.primaryColor, "#22d3ee"),
    secondaryColor: safeColor(participant.secondaryColor, "#5068ff"), animationProfile,
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
