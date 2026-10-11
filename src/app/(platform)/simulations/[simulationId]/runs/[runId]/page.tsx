import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Play, Users } from "lucide-react";
import { NotFoundError } from "@/lib/errors";
import { BATTLE_MODULE_ID, BATTLE_MODULE_VERSION } from "@/lib/modules/battle/config";
import { DEFAULT_RACE_MAX_TICKS, RACE_MODULE_ID, RACE_MODULE_VERSION } from "@/lib/modules/race/config";
import { raceStateSchema } from "@/lib/modules/race/schemas";
import {
  DEFAULT_SURVIVAL_MAX_TICKS, SURVIVAL_MODULE_ID, SURVIVAL_MODULE_VERSION,
} from "@/lib/modules/survival/config";
import { survivalStateSchema } from "@/lib/modules/survival/schemas";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import { getSimulationRun, listSimulationRunEvents } from "@/server/services/simulation-run-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BattleRunControls } from "@/components/battle/battle-run-controls";
import { BattleRunSummary, battleEventDescription } from "@/components/battle/battle-run-summary";
import { RaceRunControls } from "@/components/race/race-run-controls";
import { RaceRunSummary, raceEventDescription } from "@/components/race/race-run-summary";
import { SurvivalRunControls } from "@/components/survival/survival-run-controls";
import { SurvivalRunSummary, survivalEventDescription } from "@/components/survival/survival-run-summary";
import { buttonClasses } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ simulationId: string; runId: string }>;
  searchParams: Promise<{ after?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Simulation run" };
}

export default async function SimulationRunPage({ params, searchParams }: PageProps) {
  const { simulationId, runId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();
  let run;
  try {
    run = await getSimulationRun(user.id, workspace.id, runId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (run.simulationId !== simulationId) notFound();

  const requestedAfter = Number((await searchParams).after ?? "0");
  const after = Number.isSafeInteger(requestedAfter) && requestedAfter >= 0 ? requestedAfter : 0;
  const events = await listSimulationRunEvents(user.id, workspace.id, runId, after, 50);
  const names = new Map(run.participants.map((participant) => [participant.runParticipantId, participant.name]));
  const statusVariant = run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "danger" : "neutral";
  const battleV1 = run.moduleId === BATTLE_MODULE_ID && run.moduleVersion === BATTLE_MODULE_VERSION;
  const raceV1 = run.moduleId === RACE_MODULE_ID && run.moduleVersion === RACE_MODULE_VERSION;
  const survivalV1 = run.moduleId === SURVIVAL_MODULE_ID && run.moduleVersion === SURVIVAL_MODULE_VERSION;
  const raceState = raceV1 ? raceStateSchema.safeParse(run.state.moduleState) : null;
  const survivalState = survivalV1 ? survivalStateSchema.safeParse(run.state.moduleState) : null;
  const activeStatus = run.status === "CREATED" || run.status === "RUNNING" || run.status === "PAUSED"
    ? run.status : null;

  return (
    <div className="space-y-6">
      <Link href={`/simulations/${simulationId}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to simulation
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={statusVariant}>{run.status}</Badge>
            <Badge variant="outline">{run.mode}</Badge>
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Simulation run</h1>
          <p className="mt-1 text-sm text-secondary">{run.inputSnapshot.simulationName}</p>
        </div>
        <p className="font-mono text-xs text-muted">{run.id}</p>
      </div>

      {run.failureMessage ? (
        <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {run.failureMessage}
        </div>
      ) : null}

      {battleV1 && activeStatus && permissions.includes("simulation.run") ? (
        <BattleRunControls simulationId={simulationId} runId={run.id} status={activeStatus} />
      ) : null}
      {raceV1 && activeStatus && permissions.includes("simulation.run") ? (
        <RaceRunControls simulationId={simulationId} runId={run.id} status={activeStatus}
          currentTick={run.currentTick} maxTicks={raceState?.success ? raceState.data.config.maxTicks : DEFAULT_RACE_MAX_TICKS} />
      ) : null}
      {survivalV1 && activeStatus && permissions.includes("simulation.run") ? (
        <SurvivalRunControls simulationId={simulationId} runId={run.id} status={activeStatus}
          currentTick={run.currentTick} maxTicks={survivalState?.success ? survivalState.data.config.maxTicks : DEFAULT_SURVIVAL_MAX_TICKS} />
      ) : null}

      {battleV1 && run.status === "COMPLETED" ? (
        <Link href={`/simulations/${simulationId}/runs/${run.id}/watch`} className={buttonClasses({ size: "lg" })}>
          <Play className="size-4" aria-hidden />Watch Replay
        </Link>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card as="section" className="lg:col-span-2">
          <CardHeader><CardTitle>Execution</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted">Current tick</dt><dd className="mt-1 text-foreground">{run.currentTick}</dd></div>
              <div><dt className="text-xs text-muted">Simulated time</dt><dd className="mt-1 text-foreground">{run.elapsedSimulationMs} ms</dd></div>
              <div><dt className="text-xs text-muted">Resolved seed</dt><dd className="mt-1 font-mono text-foreground">{run.resolvedSeed}</dd></div>
              <div><dt className="text-xs text-muted">Events</dt><dd className="mt-1 text-foreground">{run.eventCount}</dd></div>
              <div><dt className="text-xs text-muted">Created</dt><dd className="mt-1 text-foreground">{formatRelativeTime(run.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted">Module</dt><dd className="mt-1 break-all font-mono text-foreground">{run.moduleId} · {run.moduleVersion}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card as="section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-4 text-muted" />Input snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {run.participants.map((participant) => (
                <li key={participant.runParticipantId} className="rounded-lg border border-border bg-background/40 p-2.5">
                  <p className="font-medium text-foreground">{participant.position + 1}. {participant.name}</p>
                  <p className="text-xs text-muted">{participant.category} · {participant.attributes.length} attributes</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {battleV1 ? <BattleRunSummary run={run} /> : null}
      {raceV1 ? <RaceRunSummary run={run} /> : null}
      {survivalV1 ? <SurvivalRunSummary run={run} /> : null}

      {run.result && !battleV1 && !raceV1 && !survivalV1 ? (
        <Card as="section">
          <CardHeader><CardTitle>Result</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-foreground">{run.result.summary}</p>
            <p className="text-xs text-muted">{run.result.resultType} · version {run.result.version}</p>
            {Object.keys(run.result.metrics).length ? (
              <dl className="grid gap-3 sm:grid-cols-3">
                {Object.entries(run.result.metrics).map(([key, value]) => (
                  <div key={key}><dt className="text-xs text-muted">{key}</dt><dd className="text-foreground">{String(value)}</dd></div>
                ))}
              </dl>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card as="section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-muted" />Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.items.length === 0 ? <p className="text-sm text-muted">No events recorded in this page.</p> : (
            <ol className="space-y-2">
              {events.items.map((event) => (
                <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{battleV1 ? battleEventDescription(event, names) : raceV1 ? raceEventDescription(event, names) : survivalV1 ? survivalEventDescription(event, names) : event.type}</p>
                    {battleV1 || raceV1 || survivalV1 ? <p className="text-xs text-muted">{event.type}</p> : null}
                    {event.actorRunParticipantId ? <p className="text-xs text-muted">Actor: {names.get(event.actorRunParticipantId) ?? "Participant"}</p> : null}
                  </div>
                  <p className="text-xs text-muted">#{event.sequence} · tick {event.tick} · {event.simulatedTimeMs} ms</p>
                </li>
              ))}
            </ol>
          )}
          {events.hasMore ? (
            <Link
              href={`/simulations/${simulationId}/runs/${runId}?after=${events.nextAfterSequence}`}
              className="mt-4 inline-flex text-sm font-medium text-accent hover:underline"
            >
              More events
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
