import Link from "next/link";
import {
  ArrowRight, Boxes, Download, FolderKanban, Globe2, Layers3,
  Play, Rocket, Sparkles, Swords, WalletCards,
} from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { getRecentActivity, getWorkspaceStats } from "@/server/services/dashboard-service";
import { listAnythingWarsEvents } from "@/server/services/anything-wars-service";
import { describeAuditAction } from "@/lib/activity";
import { anythingWarsEventHref, anythingWarsRunHref } from "@/lib/anything-wars/routes";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";

const DESTINATIONS = [
  {
    label: "Explore Earth", description: "Browse places and virtual land",
    href: "/earth/geography", icon: Globe2, permission: "workspace.view",
    accent: "from-cyan-500/20 to-emerald-500/10",
  },
  {
    label: "Build something", description: "Start worlds, assets and projects",
    href: "/create", icon: Sparkles, permission: "project.create",
    accent: "from-blue-500/20 to-violet-500/10",
  },
  {
    label: "Run a simulation", description: "Create experiments and events",
    href: "/simulations", icon: Layers3, permission: "simulation.view",
    accent: "from-amber-500/20 to-orange-500/10",
  },
  {
    label: "Economy Lab", description: "Explore your living economic town",
    href: "/economy/lab", icon: WalletCards, permission: "world.view",
    accent: "from-emerald-500/20 to-cyan-500/10",
  },
] as const;

export default async function DashboardPage() {
  const ctx = await requirePlatformContext();
  const [stats, activity, anythingWarsEvents] = await Promise.all([
    getWorkspaceStats(ctx.user.id, ctx.workspace.id),
    getRecentActivity(ctx.user.id, ctx.workspace.id),
    listAnythingWarsEvents(ctx.user.id, ctx.workspace.id, 4),
  ]);
  const firstName = ctx.user.displayName.split(/\s+/)[0] ?? ctx.user.displayName;
  const destinations = DESTINATIONS.filter((item) => ctx.permissions.includes(item.permission));

  const statCards = [
    { label: "Projects", value: stats.projects, icon: FolderKanban, hint: "No projects yet" },
    { label: "Simulations", value: stats.simulations, icon: Swords, hint: "Nothing running" },
    { label: "Entities", value: stats.entities, icon: Boxes, hint: "None created" },
    { label: "Exports", value: stats.exports, icon: Download, hint: "No exports yet" },
  ];

  return (
    <div className="space-y-9">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_20%,var(--accent-soft),transparent_55%)]" aria-hidden />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.17em] text-accent">
              <Rocket className="size-3.5" aria-hidden /> SIMVERSE Control Center
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-secondary sm:text-base">
              Your worlds, creations and simulations—all within reach. Choose a destination to continue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ctx.permissions.includes("project.create") && (
              <Link href="/create"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                <Rocket className="size-4" /> Start creating <ArrowRight className="size-4" />
              </Link>
            )}
            {ctx.permissions.includes("workspace.view") && (
              <Link href="/earth/geography"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/75 px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-hover">
                <Globe2 className="size-4" /> Explore Earth
              </Link>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="dashboard-areas">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">Choose your space</p>
            <h2 id="dashboard-areas" className="mt-1 font-display text-xl font-semibold text-foreground">
              Where would you like to go?
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {destinations.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className={`group relative flex min-h-32 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${item.accent} p-5 transition hover:border-accent/50 hover:bg-surface-hover`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex rounded-xl border border-border bg-background/70 p-2.5 text-foreground"><Icon className="size-5" /></span>
                  <ArrowRight className="size-4 text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
                </div>
                <div className="mt-5">
                  <h3 className="font-semibold text-foreground">{item.label}</h3>
                  <p className="mt-1 text-xs text-secondary">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="dashboard-activity-stats">
        <h2 id="dashboard-activity-stats" className="mb-4 font-display text-xl font-semibold text-foreground">
          Your workspace at a glance
        </h2>
        <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
          {statCards.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </div>
      </section>

      <section aria-labelledby="dashboard-recent-activity">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="dashboard-recent-activity" className="font-display text-xl font-semibold text-foreground">Recent activity</h2>
          <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            Open my projects <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <Card>
          {activity.length === 0 ? (
            <EmptyState icon={Rocket} title="Nothing here yet"
              description="Your real workspace events appear here as you build." className="border-none" />
          ) : (
            <ul className="divide-y divide-border">
              {activity.slice(0, 8).map((item) => {
                const { icon: Icon, label } = describeAuditAction(item.action, item.metadata);
                return (
                  <li key={item.id} className="flex items-center gap-3 p-4">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-accent">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                      <p className="mt-0.5 text-xs text-muted">Workspace activity</p>
                    </div>
                    <time className="shrink-0 text-xs text-muted">{formatRelativeTime(item.createdAt)}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {ctx.permissions.includes("simulation.view") && (
        <section aria-labelledby="dashboard-anything-wars">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="dashboard-anything-wars" className="font-display text-xl font-semibold text-foreground">
              Recent Anything Wars
            </h2>
            <Link href="/anything-wars"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              Browse events <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {anythingWarsEvents.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {anythingWarsEvents.map(({ simulation, latestRun, resultSummary }) => (
                <Link key={simulation.id} href={latestRun
                  ? anythingWarsRunHref(simulation.id, latestRun.id)
                  : anythingWarsEventHref(simulation.id)}>
                  <Card interactive className="h-full p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{simulation.name}</p>
                      <Badge variant={latestRun?.status === "COMPLETED" ? "success" : latestRun?.status === "RUNNING" ? "accent" : "neutral"}>
                        {latestRun?.status ?? simulation.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs capitalize text-muted">
                      {simulation.mode} · {simulation.participants.length} competitors
                    </p>
                    {resultSummary && <p className="mt-2 line-clamp-2 text-xs text-secondary">{resultSummary}</p>}
                  </Card>
                </Link>
              ))}
            </div>
          ) : <Card className="flex items-center gap-3 p-5 text-sm text-secondary">
            <Play className="size-5 text-accent" /> Create an Anything Wars event to see it here.
          </Card>}
        </section>
      )}
    </div>
  );
}
