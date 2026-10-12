import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aperture, ArrowLeft, CalendarClock, Globe2, Play, Plus, RefreshCw, Users } from "lucide-react";
import { anythingWarsEventHref, anythingWarsRematchHref, anythingWarsRunHref, anythingWarsWatchHref } from "@/lib/anything-wars/routes";
import { NotFoundError } from "@/lib/errors";
import { BATTLE_MODULE_ID, BATTLE_MODULE_VERSION } from "@/lib/modules/battle/config";
import { DEFAULT_RACE_MAX_TICKS, RACE_MODULE_ID, RACE_MODULE_VERSION } from "@/lib/modules/race/config";
import { raceStateSchema } from "@/lib/modules/race/schemas";
import { DEFAULT_SURVIVAL_MAX_TICKS, SURVIVAL_MODULE_ID, SURVIVAL_MODULE_VERSION } from "@/lib/modules/survival/config";
import { survivalStateSchema } from "@/lib/modules/survival/schemas";
import { requirePlatformContext } from "@/server/context";
import { getAnythingWarsEvent } from "@/server/services/anything-wars-service";
import { getSimulationRun, listSimulationRunEvents } from "@/server/services/simulation-run-service";
import { AnythingWarsRunActions } from "@/components/anything-wars/anything-wars-run-actions";
import { BattleRunControls } from "@/components/battle/battle-run-controls";
import { BattleRunSummary, battleEventDescription } from "@/components/battle/battle-run-summary";
import { RaceRunControls } from "@/components/race/race-run-controls";
import { RaceRunSummary, raceEventDescription } from "@/components/race/race-run-summary";
import { SurvivalRunControls } from "@/components/survival/survival-run-controls";
import { SurvivalRunSummary, survivalEventDescription } from "@/components/survival/survival-run-summary";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Anything Wars Run" };
interface PageProps { params: Promise<{ simulationId: string; runId: string }>; searchParams: Promise<{ after?: string }> }

function statusVariant(status: string): BadgeVariant {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "RUNNING") return "accent";
  if (status === "PAUSED") return "warning";
  return "neutral";
}

export default async function AnythingWarsRunPage({ params, searchParams }: PageProps) {
  const { simulationId, runId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();
  let event;
  let run;
  try {
    [event, run] = await Promise.all([
      getAnythingWarsEvent(user.id, workspace.id, simulationId),
      getSimulationRun(user.id, workspace.id, runId),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (run.simulationId !== event.id) notFound();

  const requestedAfter = Number((await searchParams).after ?? "0");
  const after = Number.isSafeInteger(requestedAfter) && requestedAfter >= 0 ? requestedAfter : 0;
  const events = await listSimulationRunEvents(user.id, workspace.id, run.id, after, 50);
  const names = new Map(run.participants.map((participant) => [participant.runParticipantId, participant.name]));
  const battleV1 = run.moduleId === BATTLE_MODULE_ID && run.moduleVersion === BATTLE_MODULE_VERSION;
  const raceV1 = run.moduleId === RACE_MODULE_ID && run.moduleVersion === RACE_MODULE_VERSION;
  const survivalV1 = run.moduleId === SURVIVAL_MODULE_ID && run.moduleVersion === SURVIVAL_MODULE_VERSION;
  const raceState = raceV1 ? raceStateSchema.safeParse(run.state.moduleState) : null;
  const survivalState = survivalV1 ? survivalStateSchema.safeParse(run.state.moduleState) : null;
  const activeStatus = ["CREATED", "RUNNING", "PAUSED"].includes(run.status) ? run.status as "CREATED" | "RUNNING" | "PAUSED" : null;
  const canRun = permissions.includes("simulation.run");
  const runBasePath = `${anythingWarsEventHref(event.id)}/runs`;

  return (
    <div className="space-y-6">
      <Link href={anythingWarsEventHref(event.id)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{event.name}</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant={statusVariant(run.status)}>{run.status}</Badge><Badge variant="outline" className="capitalize">{run.mode}</Badge></div><h1 className="mt-2 font-display text-2xl font-semibold text-foreground">{run.status === "COMPLETED" ? "War Results" : "War in Progress"}</h1><p className="mt-1 text-sm text-secondary">{run.inputSnapshot.simulationName}</p></div><div className="flex flex-wrap gap-2">{canRun ? <AnythingWarsRunActions simulationId={event.id} runId={run.id} status={run.status} /> : null}{permissions.includes("simulation.create") ? <Link href={anythingWarsRematchHref(event.id)} className={buttonClasses({ variant: "secondary" })}><RefreshCw className="size-4" />Rematch</Link> : null}<Link href="/anything-wars/create" className={buttonClasses({ variant: "secondary" })}><Plus className="size-4" />New War</Link></div></div>

      {run.failureMessage ? <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">{run.failureMessage}</div> : null}
      {battleV1 && activeStatus && canRun ? <BattleRunControls simulationId={event.id} runId={run.id} status={activeStatus} runBasePath={runBasePath} /> : null}
      {raceV1 && activeStatus && canRun ? <RaceRunControls simulationId={event.id} runId={run.id} status={activeStatus} runBasePath={runBasePath} currentTick={run.currentTick} maxTicks={raceState?.success ? raceState.data.config.maxTicks : DEFAULT_RACE_MAX_TICKS} /> : null}
      {survivalV1 && activeStatus && canRun ? <SurvivalRunControls simulationId={event.id} runId={run.id} status={activeStatus} runBasePath={runBasePath} currentTick={run.currentTick} maxTicks={survivalState?.success ? survivalState.data.config.maxTicks : DEFAULT_SURVIVAL_MAX_TICKS} /> : null}
      {battleV1 && run.status === "COMPLETED" ? <Link href={anythingWarsWatchHref(event.id, run.id)} className={buttonClasses({ size: "lg" })}><Play className="size-4" />Watch 3D Replay</Link> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card as="section" className="lg:col-span-2"><CardHeader><CardTitle>Run facts</CardTitle><CardDescription>This data comes from the immutable input snapshot and authoritative engine state.</CardDescription></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted">Current tick</dt><dd>{run.currentTick}</dd></div><div><dt className="text-xs text-muted">Simulation time</dt><dd>{run.elapsedSimulationMs} ms</dd></div><div><dt className="text-xs text-muted">Seed</dt><dd className="font-mono">{run.resolvedSeed}</dd></div><div><dt className="text-xs text-muted">Events</dt><dd>{run.eventCount}</dd></div><div><dt className="text-xs text-muted">World</dt><dd>{run.inputSnapshot.world ? `${run.inputSnapshot.world.name} · v${run.inputSnapshot.world.version}` : "None"}</dd></div><div><dt className="text-xs text-muted">Presentation style</dt><dd>{run.inputSnapshot.experienceProfile ? `${run.inputSnapshot.experienceProfile.name} · v${run.inputSnapshot.experienceProfile.version}` : "Default"}</dd></div></dl></CardContent></Card>
        <Card as="section"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4 text-muted" />Competitor snapshot</CardTitle></CardHeader><CardContent><ol className="space-y-2">{run.participants.map((participant) => <li key={participant.runParticipantId} className="rounded-lg border border-border p-2.5 text-sm"><p className="font-medium text-foreground">{participant.position + 1}. {participant.name}</p><p className="text-xs text-muted">{participant.category.replaceAll("_", " ")} · {participant.attributes.length} attributes</p></li>)}</ol></CardContent></Card>
      </div>

      {battleV1 ? <BattleRunSummary run={run} /> : null}
      {raceV1 ? <RaceRunSummary run={run} /> : null}
      {survivalV1 ? <SurvivalRunSummary run={run} /> : null}

      <Card as="section"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-muted" />Event history</CardTitle></CardHeader><CardContent>{events.items.length ? <ol className="space-y-2">{events.items.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm"><div><p className="font-medium text-foreground">{battleV1 ? battleEventDescription(item, names) : raceV1 ? raceEventDescription(item, names) : survivalV1 ? survivalEventDescription(item, names) : item.type}</p><p className="text-xs text-muted">{item.type}</p></div><p className="text-xs text-muted">#{item.sequence} · tick {item.tick}</p></li>)}</ol> : <p className="text-sm text-muted">No events recorded on this page.</p>}{events.hasMore ? <Link href={`${anythingWarsRunHref(event.id, run.id)}?after=${events.nextAfterSequence}`} className="mt-4 inline-flex text-sm font-medium text-accent hover:underline">More events</Link> : null}</CardContent></Card>

      <div className="flex flex-wrap gap-4 text-sm"><Link href={`/simulations/${event.id}/runs/${run.id}`} className="font-medium text-accent hover:underline">View generic Run details</Link>{run.inputSnapshot.world ? <span className="inline-flex items-center gap-1 text-muted"><Globe2 className="size-4" />World snapshot preserved</span> : null}{run.inputSnapshot.experienceProfile ? <span className="inline-flex items-center gap-1 text-muted"><Aperture className="size-4" />Presentation snapshot preserved</span> : null}</div>
    </div>
  );
}
