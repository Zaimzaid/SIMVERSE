import type { EngineEvent, ParticipantSnapshotV1, ResultEnvelopeV1 } from "@/lib/engine/schemas";
import type { StoryboardV1 } from "@/lib/media/schemas";

export interface StoryboardSourceRun {
  id: string;
  simulationId: string;
  simulationName: string;
  mode: string;
  moduleId: string;
  moduleVersion: string;
  participants: ParticipantSnapshotV1[];
  events: EngineEvent[];
  result: ResultEnvelopeV1;
}

export interface StoryboardAdapter {
  readonly id: string;
  supports(moduleId: string, moduleVersion: string): boolean;
  build(source: StoryboardSourceRun): StoryboardV1;
}

export interface HighlightCandidate {
  sequence: number;
  priority: number;
  title: string;
  caption: string;
  participantRefs: string[];
  turningPoint?: boolean;
  durationHintMs?: number;
}
