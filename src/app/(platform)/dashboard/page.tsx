import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Download,
  FolderKanban,
  Rocket,
  Swords,
} from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import {
  getRecentActivity,
  getWorkspaceStats,
} from "@/server/services/dashboard-service";
import { describeAuditAction } from "@/lib/activity";
import { PRODUCTS } from "@/lib/products";
import { formatRelativeTime } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";

export default async function DashboardPage() {
  const ctx = await requirePlatformContext();
  const [stats, activity] = await Promise.all([
    getWorkspaceStats(ctx.user.id, ctx.workspace.id),
    getRecentActivity(ctx.user.id, ctx.workspace.id),
  ]);

  const firstName = ctx.user.displayName.split(/\s+/)[0] ?? ctx.user.displayName;

  const statCards = [
    { label: "Projects", value: stats.projects, icon: FolderKanban, hint: "No projects yet" },
    { label: "Simulations", value: stats.simulations, icon: Swords, hint: "Nothing running" },
    { label: "Entities", value: stats.entities, icon: Boxes, hint: "None created" },
    { label: "Exports", value: stats.exports, icon: Download, hint: "No exports yet" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="aurora opacity-70" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <Badge variant="accent" className="mb-4">
              Welcome, {firstName}
            </Badge>
            <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              Welcome to SIMVERSE.
            </h1>
            <p className="mt-2 text-secondary">
              Your simulation universe starts here.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link href="/create" className={buttonClasses({ variant: "primary", size: "lg" })}>
              <Rocket className="size-4" />
              Start building
            </Link>
            <Link
              href="/templates"
              className={buttonClasses({ variant: "secondary", size: "lg" })}
            >
              Browse templates
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              hint={card.hint}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent activity</h2>
          </div>
          <Card>
            {activity.length === 0 ? (
              <EmptyState
                icon={Rocket}
                title="No activity yet"
                description="Your workspace activity will show up here as you build."
                className="border-none"
              />
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((item) => {
                  const { icon: Icon, label } = describeAuditAction(
                    item.action,
                    item.metadata,
                  );
                  return (
                    <li key={item.id} className="flex items-center gap-3 p-4">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/50 text-accent">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {label}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted">
                        {formatRelativeTime(item.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        {/* Launch a product */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Launch a product</h2>
          </div>
          <Card className="p-2">
            <ul className="space-y-1">
              {PRODUCTS.slice(0, 4).map((product) => (
                <li key={product.name}>
                  <div className="flex items-center gap-3 rounded-lg p-2.5">
                    <span
                      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${product.gradient} text-foreground`}
                    >
                      <product.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                    </div>
                    <Badge variant={product.status === "In development" ? "accent" : "neutral"}>
                      {product.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
            <div className="p-2.5">
              <Link
                href="/create"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                Explore all products
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
