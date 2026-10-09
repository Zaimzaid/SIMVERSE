import type { EngineEvent } from "@/lib/engine/schemas";
import { RACE_DISTANCE_UNIT_LABELS, type RaceDistanceUnit } from "@/lib/modules/race/config";
import { raceResultSchema, raceStateSchema } from "@/lib/modules/race/schemas";
import type { RunView } from "@/server/services/simulation-run-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function nameOf(names: Map<string, string>, id: string | null): string {
  return id ? names.get(id) ?? "Participant" : "Race";
}

function formatTime(micros: number | null): string {
  return micros === null ? "DNF" : `${(micros / 1_000_000).toFixed(3)} s`;
}

function formatDistance(milli: number, unit: RaceDistanceUnit): string {
  const divisor = unit === "KILOMETER" ? 1_000_000 : 1_000;
  const value = milli / divisor;
  const suffix = unit === "KILOMETER" ? "km" : unit === "METER" ? "m" : "units";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${suffix}`;
}

/** Text derives only from validated authoritative Race event payloads. */
export function raceEventDescription(event: EngineEvent, names: Map<string, string>): string {
  const actor = nameOf(names, event.actorRunParticipantId);
  const payload = event.payload;
  switch (event.type) {
    case "race.started": return `Race started with ${Array.isArray(payload.participants) ? payload.participants.length : "?"} participants.`;
    case "race.progress": return `Race progress snapshot; ${Array.isArray(payload.leaderRunParticipantIds) ? payload.leaderRunParticipantIds.length : "?"} current leader(s).`;
    case "race.lead_changed": return "The authoritative race lead changed.";
    case "race.checkpoint": return `${actor} crossed the ${payload.checkpointPercent}% checkpoint on lap ${payload.lap}.`;
    case "race.finished": return `${actor} finished in position ${payload.finishPosition} at ${formatTime(typeof payload.finishTimeMicros === "number" ? payload.finishTimeMicros : null)}.`;
    case "race.timeout": return `Time limit reached; ${payload.finishedCount} finished and ${payload.unfinishedCount} did not finish.`;
    case "race.completed": return payload.completionReason === "ALL_FINISHED" ? "Race completed after every participant finished." : "Race completed at the time limit.";
    default: return event.type;
  }
}

export function RaceRunSummary({ run }: { run: RunView }) {
  const parsedState = raceStateSchema.safeParse(run.state.moduleState);
  const parsedResult = run.result?.resultType === "race.result"
    ? raceResultSchema.safeParse(run.result.modulePayload) : null;
  const result = parsedResult?.success ? parsedResult.data : null;
  const state = parsedState.success ? parsedState.data : null;
  if (!state && !result) return null;
  const names = new Map(run.participants.map((participant) => [participant.runParticipantId, participant.name]));
  const config = state?.config ?? result!;
  const participants = result?.participants ?? state?.participants ?? [];
  const ranking = result?.ranking ?? state?.ranking ?? [];
  const byId = new Map(participants.map((participant) => [participant.runParticipantId, participant]));
  const leaderIds = result
    ? result.ranking.filter((entry) => entry.rank === 1).map((entry) => entry.runParticipantId)
    : state?.leaderRunParticipantIds ?? [];
  return (
    <Card as="section">
      <CardHeader><CardTitle>Race {result ? "result" : "progress"}</CardTitle></CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {result
              ? result.tiedParticipantIds.length > 1
                ? `Tied winners: ${result.tiedParticipantIds.map((id) => nameOf(names, id)).join(", ")}`
                : `Winner: ${nameOf(names, result.winnerRunParticipantId)}`
              : `Leader${leaderIds.length === 1 ? "" : "s"}: ${leaderIds.map((id) => nameOf(names, id)).join(", ")}`}
          </p>
          <p className="text-secondary">
            {config.mode === "CIRCUIT" ? `${config.laps} laps · ` : ""}
            {formatDistance(config.totalDistanceMilli, config.distanceUnit)} · {RACE_DISTANCE_UNIT_LABELS[config.distanceUnit]}
            {result ? ` · ${result.completionReason.replaceAll("_", " ")} · ${result.totalTicks} ticks` : ` · tick ${run.currentTick}`}
          </p>
        </div>
        <ol className="space-y-3">
          {ranking.map((entry) => {
            const participant = byId.get(entry.runParticipantId);
            if (!participant) return null;
            const progress = "distanceMilli" in participant ? participant.distanceMilli : participant.progressMilli;
            const percent = Math.min(100, progress * 100 / config.totalDistanceMilli);
            return (
              <li key={entry.runParticipantId} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-foreground">{entry.rank}. {nameOf(names, entry.runParticipantId)}{entry.tied ? " (tie)" : ""}</p>
                  <Badge variant={participant.finished ? "success" : "neutral"}>{participant.finished ? formatTime(participant.finishTimeMicros) : "DNF / racing"}</Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border" aria-label={`${nameOf(names, entry.runParticipantId)} ${percent.toFixed(1)}% complete`}>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
                  <span>{formatDistance(progress, config.distanceUnit)} · {percent.toFixed(1)}%</span>
                  <span>Lap {"currentLap" in participant ? participant.currentLap : participant.lapsCompleted}/{config.laps} · Speed {participant.profile.speed} · Accel {participant.profile.acceleration}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
