import { ValidationError } from "@/lib/errors";
import { MAX_STORYBOARD_HIGHLIGHTS, STORYBOARD_VERSION } from "@/lib/media/constants";
import { storyboardV1Schema, type StoryboardSceneV1, type StoryboardV1 } from "@/lib/media/schemas";
import type { HighlightCandidate, StoryboardSourceRun } from "./types";

export interface AuthoritativeStoryboardSummary {
  resultType: string;
  headline: string;
  detail: string;
  completionReason: string;
  winnerParticipantRefs: string[];
  tiedParticipantRefs: string[];
  ranking: string[];
}

export function participantNames(source: StoryboardSourceRun) {
  return new Map(source.participants.map((participant) => [participant.runParticipantId, participant.name]));
}

export function nameFor(names: ReadonlyMap<string, string>, participantId: string | null | undefined): string {
  return participantId ? names.get(participantId) ?? "Participant" : "Participant";
}

export function namesFor(names: ReadonlyMap<string, string>, participantIds: readonly string[]): string {
  const values = participantIds.map((id) => nameFor(names, id));
  if (values.length <= 3) return values.join(values.length === 2 ? " and " : ", ");
  return `${values.slice(0, 3).join(", ")} and ${values.length - 3} more`;
}

export function validateEnvelope(source: StoryboardSourceRun, resultType: string): void {
  if (source.result.resultType !== resultType || source.result.modulePayloadVersion !== 1) {
    throw new ValidationError("The completed Run result is not valid for this media adapter.");
  }
}

export function parsePayload<T>(
  event: StoryboardSourceRun["events"][number],
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
): T {
  if (event.payloadVersion !== 1) throw new ValidationError("A source Run event has an unsupported payload version.");
  const parsed = schema.safeParse(event.payload);
  if (!parsed.success) throw new ValidationError("A source Run event payload is invalid.");
  return parsed.data;
}

export function selectHighlights(candidates: readonly HighlightCandidate[]): HighlightCandidate[] {
  const unique = new Map<number, HighlightCandidate>();
  for (const candidate of candidates) {
    const existing = unique.get(candidate.sequence);
    if (!existing || candidate.priority > existing.priority) unique.set(candidate.sequence, candidate);
  }
  return [...unique.values()]
    .sort((a, b) => b.priority - a.priority || a.sequence - b.sequence)
    .slice(0, MAX_STORYBOARD_HIGHLIGHTS)
    .sort((a, b) => a.sequence - b.sequence);
}

function competitorCaption(source: StoryboardSourceRun): string {
  const names = source.participants.map((participant) => participant.name);
  if (names.length <= 6) return names.join(", ");
  return `${names.slice(0, 6).join(", ")} and ${names.length - 6} more participants`;
}

export function buildStoryboard(
  source: StoryboardSourceRun,
  summary: AuthoritativeStoryboardSummary,
  candidates: readonly HighlightCandidate[],
): StoryboardV1 {
  const highlights = selectHighlights(candidates);
  const allParticipantRefs = source.participants.map((participant) => participant.runParticipantId);
  const scenes: StoryboardSceneV1[] = [
    {
      id: "intro",
      order: 0,
      kind: "INTRO",
      title: source.simulationName,
      caption: `${source.mode[0]?.toUpperCase() ?? ""}${source.mode.slice(1)} · authoritative Run recap`,
      participantRefs: [],
      durationHintMs: 2_500,
      enabled: true,
    },
    {
      id: "competitors",
      order: 1,
      kind: "COMPETITOR",
      title: source.participants.length === 2 ? "Meet the competitors" : "The field",
      caption: competitorCaption(source),
      participantRefs: allParticipantRefs,
      durationHintMs: 3_000,
      enabled: true,
    },
    ...highlights.map((highlight, index): StoryboardSceneV1 => ({
      id: `event-${highlight.sequence}`,
      order: index + 2,
      kind: highlight.turningPoint ? "TURNING_POINT" : "HIGHLIGHT",
      title: highlight.title,
      caption: highlight.caption,
      sourceEventSequence: highlight.sequence,
      participantRefs: [...new Set(highlight.participantRefs)],
      durationHintMs: highlight.durationHintMs ?? 2_500,
      enabled: true,
    })),
    {
      id: "result",
      order: highlights.length + 2,
      kind: "RESULT",
      title: summary.headline,
      caption: summary.detail,
      participantRefs: [...new Set([...summary.winnerParticipantRefs, ...summary.tiedParticipantRefs])],
      durationHintMs: 4_000,
      enabled: true,
    },
    {
      id: "outro",
      order: highlights.length + 3,
      kind: "OUTRO",
      title: "Final standings",
      caption: "The result is preserved from the completed SIMVERSE Run.",
      participantRefs: summary.ranking,
      durationHintMs: 2_500,
      enabled: true,
    },
  ];

  return storyboardV1Schema.parse({
    version: STORYBOARD_VERSION,
    source: {
      runId: source.id,
      simulationId: source.simulationId,
      simulationName: source.simulationName,
      mode: source.mode,
      moduleId: source.moduleId,
      moduleVersion: source.moduleVersion,
    },
    participants: source.participants.map((participant) => ({
      runParticipantId: participant.runParticipantId,
      sourceEntityId: participant.sourceEntityId,
      position: participant.position,
      name: participant.name,
      shortName: participant.shortName,
      category: participant.category,
      imageUrl: participant.imageUrl,
      primaryColor: participant.primaryColor,
      secondaryColor: participant.secondaryColor,
    })),
    summary,
    scenes,
  });
}

export function assertResultParsed<T>(result: { success: boolean; data?: T }): T {
  if (!result.success || !result.data) throw new ValidationError("The completed Run result is invalid.");
  return result.data;
}
