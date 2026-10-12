import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, Flame, Gauge, Plus, Sparkles, Swords, Trophy } from "lucide-react";
import { ANYTHING_WARS_FUTURE_MODES } from "@/lib/anything-wars/constants";
import { anythingWarsEventHref } from "@/lib/anything-wars/routes";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import { listAnythingWarsEvents } from "@/server/services/anything-wars-service";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Anything Wars" };

const MODES = [
  { key: "battle", label: "Battle", description: "Direct combat competition", icon: Swords },
  { key: "race", label: "Race", description: "Speed, checkpoint, and lap competition", icon: Gauge },
  { key: "survival", label: "Survival", description: "Last-standing and endurance competition", icon: Flame },
  { key: "tournament", label: "Tournament", description: "Multi-match competition", icon: Trophy },
] as const;

function statusVariant(status: string): BadgeVariant {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "RUNNING" || status === "READY") return "accent";
  if (status === "PAUSED") return "warning";
  return "neutral";
}

export default async function AnythingWarsPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("simulation.view")) {
    return <EmptyState icon={Swords} title="Anything Wars is unavailable" description="Your workspace role cannot view simulations." />;
  }
  const events = await listAnythingWarsEvents(user.id, workspace.id);
  const active = events.filter(({ latestRun }) => latestRun && ["CREATED", "RUNNING", "PAUSED"].includes(latestRun.status));
  const completed = events.filter(({ latestRun }) => latestRun?.status === "COMPLETED");

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="aurora opacity-70" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <Badge variant="accent"><Sparkles className="size-3.5" />SIMVERSE product</Badge>
          <h1 className="mt-4 font-display text-3xl font-semibold text-foreground sm:text-5xl">Anything Wars</h1>
          <p className="mt-3 text-lg text-secondary">Choose anything. Make them compete. Watch the story unfold.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {permissions.includes("simulation.create") ? (
              <Link href="/anything-wars/create" className={buttonClasses({ size: "lg" })}><Plus className="size-4" />Start New War</Link>
            ) : null}
            {permissions.includes("tournament.view") ? (
              <Link href="/anything-wars/tournaments" className={buttonClasses({ variant: "secondary", size: "lg" })}><Trophy className="size-4" />Tournaments</Link>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Choose a competition</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODES.map((mode) => {
            const href = mode.key === "tournament" ? "/anything-wars/tournaments/new" : `/anything-wars/create?mode=${mode.key}`;
            const enabled = mode.key === "tournament" ? permissions.includes("tournament.manage") : permissions.includes("simulation.create");
            const content = <Card interactive={enabled} className="h-full"><CardHeader><mode.icon className="size-6 text-accent" /><CardTitle className="mt-3">{mode.label}</CardTitle><CardDescription>{mode.description}</CardDescription></CardHeader></Card>;
            return enabled ? <Link key={mode.key} href={href}>{content}</Link> : <div key={mode.key}>{content}</div>;
          })}
        </div>
      </section>

      {active.length ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Continue events</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {active.map(({ simulation, latestRun }) => (
              <Link key={simulation.id} href={latestRun ? `${anythingWarsEventHref(simulation.id)}/runs/${latestRun.id}` : anythingWarsEventHref(simulation.id)}>
                <Card interactive className="h-full"><CardContent className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate font-medium text-foreground">{simulation.name}</p><p className="text-sm capitalize text-muted">{simulation.mode} · tick {latestRun?.currentTick ?? 0}</p></div><Badge variant={statusVariant(latestRun?.status ?? simulation.status)}>{latestRun?.status ?? simulation.status}</Badge></CardContent></Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">Recent completed events</h2>{events.length ? <span className="text-sm text-muted">Real workspace Runs</span> : null}</div>
        {completed.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {completed.map(({ simulation, latestRun, resultSummary }) => (
              <Link key={simulation.id} href={`${anythingWarsEventHref(simulation.id)}/runs/${latestRun!.id}`}>
                <Card interactive className="h-full"><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle>{simulation.name}</CardTitle><Badge variant="success">Completed</Badge></div><CardDescription className="capitalize">{simulation.mode} · {simulation.participants.length} competitors</CardDescription></CardHeader><CardContent><p className="line-clamp-2 text-sm text-secondary">{resultSummary ?? "Authoritative result recorded."}</p><p className="mt-3 flex items-center gap-1 text-xs text-muted"><Clock3 className="size-3.5" />{formatRelativeTime(latestRun!.completedAt ?? latestRun!.createdAt)}</p></CardContent></Card>
              </Link>
            ))}
          </div>
        ) : <EmptyState icon={Swords} title="No completed wars yet" description="Start a Battle, Race, or Survival event and its real result will appear here." />}
      </section>

      {events.length ? (
        <p><Link href={anythingWarsEventHref(events[0]!.simulation.id)} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">Open most recent event <ArrowRight className="size-3.5" /></Link></p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Coming later</p>
        <div className="mt-3 flex flex-wrap gap-2">{ANYTHING_WARS_FUTURE_MODES.map((mode) => <Badge key={mode} variant="outline">{mode}</Badge>)}</div>
      </section>
    </div>
  );
}
