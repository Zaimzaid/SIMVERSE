import type { EngineEvent, ParticipantSnapshotV1 } from "@/lib/engine/schemas";

export type VisualSource =
  | { kind: "IMAGE"; url: string }
  | { kind: "FALLBACK"; initials: string };

export interface VisualEntityInstance {
  id: string;
  name: string;
  shortName: string;
  category: string;
  source: VisualSource;
  primaryColor: string;
  secondaryColor: string;
  x: number;
  y: number;
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
  camera: { x: number; y: number; zoom: number; shake: number };
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
