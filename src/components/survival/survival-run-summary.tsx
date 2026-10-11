import type { EngineEvent } from "@/lib/engine/schemas";
import { SURVIVAL_CONDITION_MAX, SURVIVAL_MODE_LABELS } from "@/lib/modules/survival/config";
import { survivalResultSchema, survivalStateSchema } from "@/lib/modules/survival/schemas";
import type { RunView } from "@/server/services/simulation-run-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function nameOf(names: Map<string, string>, id: string | null): string {
  return id ? names.get(id) ?? "Participant" : "No singular winner";
}

function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1_000;
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
}

/** Text derives only from validated authoritative Survival event payloads. */
export function survivalEventDescription(event: EngineEvent, names: Map<string, string>): string {
  const actor = nameOf(names, event.actorRunParticipantId);
  const payload = event.payload;
  switch (event.type) {
    case "survival.started": return `Survival started with ${Array.isArray(payload.participants) ? payload.participants.length : "?"} participants.`;
    case "survival.status": return `Survival status snapshot; ${Array.isArray(payload.leaderRunParticipantIds) ? payload.leaderRunParticipantIds.length : "?"} current leader(s).`;
    case "survival.resource_changed": return `${Array.isArray(payload.changes) ? payload.changes.length : "?"} resource depletion change(s) recorded.`;
    case "survival.hazard": return `${String(payload.category).replaceAll("_", " ")} hazard resolved at intensity ${payload.intensity}.`;
    case "survival.recovered": return `${Array.isArray(payload.recoveries) ? payload.recoveries.length : "?"} participant(s) recovered condition.`;
    case "survival.eliminated": return `${actor} was eliminated by ${String(payload.cause).replaceAll("_", " ").toLowerCase()}.`;
    case "survival.leader_changed": return "The authoritative Survival lead changed.";
    case "survival.timeout": return `Time limit reached with ${payload.survivingCount} survivor(s).`;
    case "survival.completed": return `Survival completed: ${String(payload.completionReason).replaceAll("_", " ").toLowerCase()}.`;
    default: return event.type;
  }
}

export function SurvivalRunSummary({ run }: { run: RunView }) {
  const parsedState = survivalStateSchema.safeParse(run.state.moduleState);
  const parsedResult = run.result?.resultType === "survival.result"
    ? survivalResultSchema.safeParse(run.result.modulePayload) : null;
  const state = parsedState.success ? parsedState.data : null;
  const result = parsedResult?.success ? parsedResult.data : null;
  if (!state && !result) return null;
  const names = new Map(run.participants.map((participant) => [participant.runParticipantId, participant.name]));
  const config = state?.config;
  const participants = result?.participants ?? state?.participants ?? [];
  const ranking = result?.ranking ?? state?.ranking ?? [];
  const byId = new Map(participants.map((participant) => [participant.runParticipantId, participant]));
  const leaderIds = result
    ? result.ranking.filter((entry) => entry.rank === 1).map((entry) => entry.runParticipantId)
    : state?.leaderRunParticipantIds ?? [];
  return (
    <Card as="section">
      <CardHeader><CardTitle>Survival {result ? "result" : "status"}</CardTitle></CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {result
              ? result.tiedParticipantIds.length > 1
                ? `Tied leaders: ${result.tiedParticipantIds.map((id) => nameOf(names, id)).join(", ")}`
                : `Winner: ${nameOf(names, result.winnerRunParticipantId)}`
              : `Leader${leaderIds.length === 1 ? "" : "s"}: ${leaderIds.map((id) => nameOf(names, id)).join(", ")}`}
          </p>
          <p className="text-secondary">
            {config ? SURVIVAL_MODE_LABELS[config.mode] : result ? SURVIVAL_MODE_LABELS[result.mode] : "Survival"}
            {result
              ? ` · ${result.completionReason.replaceAll("_", " ")} · ${result.totalTicks} ticks · ${result.hazardCount} hazards`
              : ` · tick ${run.currentTick} · ${state?.hazardCount ?? 0} hazards`}
          </p>
        </div>
        <ol className="space-y-3">
          {ranking.map((entry) => {
            const participant = byId.get(entry.runParticipantId);
            if (!participant) return null;
            const isResult = "finalCondition" in participant;
            const condition = isResult ? participant.finalCondition : participant.condition;
            const energy = isResult ? participant.finalResources.energy : participant.energy;
            const supplies = isResult ? participant.finalResources.supplies : participant.supplies;
            const survived = isResult ? participant.survived : participant.active;
            const duration = isResult ? participant.survivalDurationMs : participant.survivalTimeMs;
            const conditionPercent = Math.min(100, condition * 100 / SURVIVAL_CONDITION_MAX);
            return (
              <li key={entry.runParticipantId} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-foreground">{entry.rank}. {nameOf(names, entry.runParticipantId)}{entry.tied ? " (tie)" : ""}</p>
                  <Badge variant={survived ? "success" : "neutral"}>{survived ? "Surviving" : "Eliminated"}</Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-label={`${nameOf(names, entry.runParticipantId)} condition`} aria-valuenow={condition} aria-valuemin={0} aria-valuemax={SURVIVAL_CONDITION_MAX}>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${conditionPercent}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
                  <span>Condition {condition.toLocaleString()} · Energy {energy.toLocaleString()} · Supplies {supplies.toLocaleString()}</span>
                  <span>{formatDuration(duration)} · Endurance {participant.profile.endurance} · Resilience {participant.profile.resilience}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
