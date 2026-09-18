import type { ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import type { VisualEntityInstance, VisualSource } from "./types";

export function visualSource(participant: Pick<ParticipantSnapshotV1, "imageUrl" | "name" | "shortName">): VisualSource {
  const url = participant.imageUrl?.trim();
  if (url && (/^https?:\/\//i.test(url) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);base64,/i.test(url))) {
    return { kind: "IMAGE", url };
  }
  const initials = (participant.shortName?.trim() || participant.name.trim().split(/\s+/).map((word) => word[0]).join(""))
    .slice(0, 3).toLocaleUpperCase();
  return { kind: "FALLBACK", initials: initials || "?" };
}

/** Normalized arena coordinates; placement depends on participant order, never category. */
export function buildArenaScene(participants: ParticipantSnapshotV1[]): VisualEntityInstance[] {
  const ordered = [...participants].sort((a, b) => a.position - b.position);
  return ordered.map((participant, index) => {
    const count = ordered.length;
    const angle = count === 2 ? (index === 0 ? Math.PI : 0) : -Math.PI / 2 + index * Math.PI * 2 / count;
    const x = count === 2 ? (index === 0 ? 0.26 : 0.74) : 0.5 + Math.cos(angle) * 0.31;
    const y = count === 2 ? 0.62 : 0.55 + Math.sin(angle) * 0.24;
    return {
      id: participant.runParticipantId,
      name: participant.name,
      shortName: participant.shortName || participant.name,
      category: participant.category,
      source: visualSource(participant),
      primaryColor: participant.primaryColor || "#22d3ee",
      secondaryColor: participant.secondaryColor || "#3b82f6",
      x, y,
      facing: x < 0.5 ? 1 : -1,
    };
  });
}
