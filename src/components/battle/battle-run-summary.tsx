import { battleResultSchema, battleStateSchema } from "@/lib/modules/battle/schemas";
import type { EngineEvent } from "@/lib/engine/schemas";
import type { RunView } from "@/server/services/simulation-run-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function nameOf(names: Map<string, string>, id: string | null): string {
  return id ? names.get(id) ?? "Participant" : "Battle";
}

/** Text is derived from versioned, validated event payloads and rendered as plain React text. */
export function battleEventDescription(event: EngineEvent, names: Map<string, string>): string {
  const actor = nameOf(names, event.actorRunParticipantId);
  const target = nameOf(names, event.targetRunParticipantId);
  const payload = event.payload;
  switch (event.type) {
    case "battle.started": return `Battle started with ${Array.isArray(payload.participantIds) ? payload.participantIds.length : "?"} participants.`;
    case "battle.defend": return `${actor} defends until the next action or landed hit.`;
    case "battle.attack": return `${actor} attacks ${target}${payload.dodged === true ? "; attack dodged" : ` for ${payload.finalDamage} damage${payload.guarded === true ? " through a guard" : ""}`}.`;
    case "battle.dodged": return `${target} dodges ${actor}'s attack.`;
    case "battle.critical_hit": return `${actor} lands a critical hit on ${target}.`;
    case "battle.damage": return `${target} loses ${payload.amount} health (${payload.healthAfter} remaining).`;
    case "battle.eliminated": return `${target} is eliminated by ${actor}.`;
    case "battle.timeout": return `Time limit reached with ${payload.survivors} participants still standing.`;
    case "battle.completed": return payload.completionReason === "KNOCKOUT"
      ? `Battle completed by elimination. Winner: ${nameOf(names, typeof payload.winnerRunParticipantId === "string" ? payload.winnerRunParticipantId : null)}.`
      : "Battle completed at the time limit.";
    default: return event.type;
  }
}

export function BattleRunSummary({ run }: { run: RunView }) {
  const parsedState = battleStateSchema.safeParse(run.state.moduleState);
  const parsedResult = run.result?.resultType === "battle.result"
    ? battleResultSchema.safeParse(run.result.modulePayload) : null;
  const result = parsedResult?.success ? parsedResult.data : null;
  const state = parsedState.success ? parsedState.data : null;
  if (!state && !result) return null;
  const names = new Map(run.participants.map((participant) => [participant.runParticipantId, participant.name]));
  const metrics = result?.participantMetrics ?? state?.participants ?? [];
  const ranking = result?.ranking ?? metrics.map((participant) => participant.runParticipantId);
  const byId = new Map(metrics.map((participant) => [participant.runParticipantId, participant]));
  const winner = result?.winnerRunParticipantId ? nameOf(names, result.winnerRunParticipantId) : null;
  const tie = result?.tiedParticipantIds.map((id) => nameOf(names, id)) ?? [];

  return (
    <Card as="section">
      <CardHeader><CardTitle>Battle {result ? "result" : "progress"}</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {result ? (
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {result.completionReason === "KNOCKOUT" ? `Winner by elimination: ${winner ?? "Unknown"}`
                : tie.length > 1 ? `Time-limit tie: ${tie.join(", ")}`
                  : `Time limit reached. Leader: ${winner ?? "Unknown"}`}
            </p>
            <p className="text-secondary">{result.totalTicks} ticks · {result.simulatedDurationMs} ms simulated · {result.format === "duel" ? "Duel" : "Free-for-all"}</p>
          </div>
        ) : (
          <p className="text-secondary">Round {state?.round ?? 1} · tick {run.currentTick} · {state?.config.format === "duel" ? "Duel" : "Free-for-all"}</p>
        )}
        <ol className="grid gap-2 sm:grid-cols-2">
          {ranking.map((id, index) => {
            const participant = byId.get(id);
            if (!participant) return null;
            return (
              <li key={id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-foreground">{result ? `${index + 1}. ` : ""}{nameOf(names, id)}</p>
                  <Badge variant={participant.alive ? "success" : "neutral"}>{participant.alive ? "Standing" : "Eliminated"}</Badge>
                </div>
                <p className="mt-1 text-xs text-secondary">Health {participant.health}/100 · Damage {participant.damageDealt} · Hits {participant.attacksLanded}/{participant.attacksAttempted}</p>
                <p className="text-xs text-muted">Critical {participant.criticalHits} · Dodges {participant.dodges} · Defends {participant.defends}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
