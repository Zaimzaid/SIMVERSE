import type { EngineEvent, ParticipantSnapshotV1 } from "@/lib/engine/schemas";

/** The source vocabulary is shared with the future Visual Asset system. Phase 5 renders MODEL_3D and PROCEDURAL_3D. */
export type VisualSourceType = "IMAGE" | "SPRITE" | "ANIMATED_SPRITE" | "MODEL_3D" | "PROCEDURAL_3D" | "CUSTOM";
export type VisualArchetype = "HUMANOID" | "QUADRUPED" | "CREATURE" | "ROBOT" | "VEHICLE_GROUND" | "VEHICLE_AIR" | "VEHICLE_WATER" | "OBJECT" | "ABSTRACT" | "CUSTOM";
export type AnimationState = "IDLE" | "WALK" | "RUN" | "ATTACK" | "DEFEND" | "DODGE" | "HIT" | "DEFEATED" | "VICTORY";
export type AnimationProfile = Partial<Record<AnimationState, string>>;

export interface EntityVisualProfile {
  sourceType: "MODEL_3D" | "PROCEDURAL_3D";
  modelUrl: string | null;
  portraitUrl: string | null;
  scale: number;
  orientationDegrees: number;
  archetype: VisualArchetype;
  primaryColor: string;
  secondaryColor: string;
  animationProfile: AnimationProfile;
}

export interface VisualEntityInstance {
  id: string;
  name: string;
  shortName: string;
  category: string;
  profile: EntityVisualProfile;
  /** World coordinates on the arena floor; Y is vertical in the renderer. */
  x: number;
  z: number;
  facing: -1 | 1;
}

export type CueKind = "START" | "DEFEND" | "ATTACK" | "DODGE" | "CRITICAL" | "DAMAGE" | "ELIMINATE" | "TIMEOUT" | "COMPLETE";

export interface ViewerCue {
  sequence: number;
  tick: number;
  simulatedTimeMs: number;
  startMs: number;
  durationMs: number;
  kind: CueKind;
  actorId: string | null;
  targetId: string | null;
  event: EngineEvent;
}

export interface ViewerMoment {
  tick: number;
  startMs: number;
  durationMs: number;
  cues: ViewerCue[];
}

export interface ViewerTimeline {
  introMs: number;
  durationMs: number;
  moments: ViewerMoment[];
  cues: ViewerCue[];
}

export interface VisualParticipantState {
  health: number;
  defending: boolean;
  eliminated: boolean;
}

export interface ViewerFrame {
  timeMs: number;
  introMs: number;
  reducedMotion: boolean;
  tick: number;
  activeMoment: ViewerMoment | null;
  progress: number;
  participants: Record<string, VisualParticipantState>;
  completed: boolean;
  timeout: boolean;
  caption: string;
  winnerId: string | null;
  tiedIds: string[];
  rankingIds: string[];
  completionReason: string | null;
  camera: { x: number; z: number; zoom: number; shake: number };
}

export interface ViewerInput {
  participants: ParticipantSnapshotV1[];
  events: EngineEvent[];
  result: unknown;
}

export interface SimulationViewerAdapter {
  moduleId: string;
  moduleVersions: readonly string[];
  buildScene(participants: ParticipantSnapshotV1[]): VisualEntityInstance[];
  buildTimeline(input: ViewerInput): ViewerTimeline;
  deriveFrame(timeline: ViewerTimeline, scene: VisualEntityInstance[], result: unknown, timeMs: number, reducedMotion?: boolean): ViewerFrame;
}
