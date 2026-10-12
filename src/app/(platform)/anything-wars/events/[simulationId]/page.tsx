import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aperture, ArrowLeft, Edit3, Globe2, Hash, Plus, Swords, Users } from "lucide-react";
import { anythingWarsExecutionIssue } from "@/lib/anything-wars/constants";
import { anythingWarsEventHref, anythingWarsRunHref } from "@/lib/anything-wars/routes";
import { NotFoundError } from "@/lib/errors";
import { raceConfigV1Schema } from "@/lib/modules/race/config";
import { survivalConfigV1Schema } from "@/lib/modules/survival/config";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import { getAnythingWarsEvent } from "@/server/services/anything-wars-service";
import { listSimulationRuns } from "@/server/services/simulation-run-service";
import { BattleRunControls } from "@/components/battle/battle-run-controls";
import { RaceRunControls } from "@/components/race/race-run-controls";
import { SurvivalRunControls } from "@/components/survival/survival-run-controls";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Anything Wars Event" };

function statusVariant(status: string): BadgeVariant {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "RUNNING" || status === "READY") return "accent";
  if (status === "PAUSED") return "warning";
  return "neutral";
}

export default async function AnythingWarsEventPage({ params }: { params: Promise<{ simulationId: string }> }) {
  const { simulationId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();
  let event;
  try {
    event = await getAnythingWarsEvent(user.id, workspace.id, simulationId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const runs = await listSimulationRuns(user.id, workspace.id, simulationId);
  const issue = anythingWarsExecutionIssue(event.mode, event.configuration.mode, event.participants.length);
  const canRun = permissions.includes("simulation.run") && event.status === "READY" && !issue;
  const runBasePath = `${anythingWarsEventHref(event.id)}/runs`;
  const createRunPath = `/api/anything-wars/events/${event.id}/runs`;
  const race = event.mode === "race" ? raceConfigV1Schema.safeParse(event.configuration.mode) : null;
  const survival = event.mode === "survival" ? survivalConfigV1Schema.safeParse(event.configuration.mode) : null;

  return (
    <div className="space-y-6">
      <Link href="/anything-wars" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Anything Wars</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex flex-wrap gap-2"><Badge variant={statusVariant(event.status)}>{event.status}</Badge><Badge variant="outline" className="capitalize">{event.mode}</Badge></div><h1 className="mt-2 font-display text-2xl font-semibold text-foreground">{event.name}</h1><p className="mt-1 text-sm text-secondary">{event.description || "An Anything Wars competition."}</p></div>
        <div className="flex flex-wrap gap-2">{permissions.includes("simulation.edit") && event.status !== "ARCHIVED" ? <Link href={`/anything-wars/create?eventId=${event.id}`} className={buttonClasses({ variant: "secondary" })}><Edit3 className="size-4" />Edit event</Link> : null}{permissions.includes("simulation.create") && permissions.includes("simulation.run") ? <Link href="/anything-wars/quick" className={buttonClasses()}><Plus className="size-4" />New War</Link> : null}</div>
      </div>

      <Card as="section"><CardHeader><CardTitle>Launch and continue</CardTitle><CardDescription>Runs use the saved configuration and freeze a new immutable input snapshot.</CardDescription></CardHeader><CardContent>
        {issue ? <p className="text-sm text-danger">{issue}</p> : event.status !== "READY" ? <p className="text-sm text-secondary">Review this draft and mark it ready before launching.</p> : !permissions.includes("simulation.run") ? <p className="text-sm text-muted">Your workspace role can view this event but cannot run simulations.</p> : null}
        {canRun && event.mode === "battle" ? <BattleRunControls simulationId={event.id} createRunPath={createRunPath} runBasePath={runBasePath} /> : null}
        {canRun && event.mode === "race" && race?.success ? <RaceRunControls simulationId={event.id} maxTicks={race.data.maxTicks} createRunPath={createRunPath} runBasePath={runBasePath} /> : null}
        {canRun && event.mode === "survival" && survival?.success ? <SurvivalRunControls simulationId={event.id} maxTicks={survival.data.maxTicks} createRunPath={createRunPath} runBasePath={runBasePath} /> : null}
      </CardContent></Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card as="section" className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4 text-muted" />Competitors</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{event.participants.map((participant, index) => <div key={participant.entityId} className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="grid size-8 place-items-center rounded-lg bg-surface-hover text-xs font-semibold text-accent">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{participant.entity?.name ?? "Unavailable competitor"}</p><p className="text-xs text-muted">{participant.entity?.category.replaceAll("_", " ") ?? "Snapshot only"}</p></div></div>)}</div></CardContent></Card>
        <Card as="section"><CardHeader><CardTitle>Setup</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p><Globe2 className="mr-2 inline size-4 text-muted" />World: {event.worldName ? `${event.worldName} · v${event.worldVersion}` : "None"}</p><p><Aperture className="mr-2 inline size-4 text-muted" />Presentation: {event.experienceProfileName ? `${event.experienceProfileName} · v${event.experienceProfileVersion}` : "Default"}</p><p><Hash className="mr-2 inline size-4 text-muted" />Seed: <span className="font-mono">{event.seed}</span></p><p className="capitalize"><Swords className="mr-2 inline size-4 text-muted" />Mode: {event.mode}</p></CardContent></Card>
      </div>

      <Card as="section"><CardHeader><CardTitle>Run history</CardTitle><CardDescription>{runs.total} authoritative {runs.total === 1 ? "Run" : "Runs"}; older Runs never change when this event is edited.</CardDescription></CardHeader><CardContent>{runs.items.length ? <ol className="space-y-2">{runs.items.map((run) => <li key={run.id}><Link href={anythingWarsRunHref(event.id, run.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 hover:border-accent/40"><span className="flex items-center gap-2"><Badge variant={statusVariant(run.status)}>{run.status}</Badge><span className="text-sm font-medium text-foreground">Run {run.id.slice(-8)}</span></span><span className="text-xs text-muted">Tick {run.currentTick} · {formatRelativeTime(run.createdAt)}</span></Link></li>)}</ol> : <p className="text-sm text-muted">No Runs yet. Start the event when it is ready.</p>}</CardContent></Card>

      <p><Link href={`/simulations/${event.id}`} className="text-sm font-medium text-accent hover:underline">View generic Simulation details</Link></p>
    </div>
  );
}
