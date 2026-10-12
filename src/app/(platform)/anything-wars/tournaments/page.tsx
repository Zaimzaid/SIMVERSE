import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus, Trophy } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listTournaments } from "@/server/services/tournament-service";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Anything Wars Tournaments" };

export default async function AnythingWarsTournamentsPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("tournament.view")) return <EmptyState icon={Trophy} title="Tournaments are unavailable" description="Your workspace role does not include Tournament access." />;
  const result = await listTournaments(user.id, workspace.id, { status: "CURRENT" });
  const canManage = permissions.includes("tournament.manage");
  return <div className="space-y-6">
    <Link href="/anything-wars" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Anything Wars</Link>
    <PageHeader eyebrow="Anything Wars" icon={Trophy} title="Tournaments" description="Multi-match competitions powered by the existing authoritative Tournament system." actions={canManage ? <Link href="/anything-wars/tournaments/new" className={buttonClasses()}><Plus className="size-4" />New Tournament</Link> : undefined} />
    {result.items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{result.items.map((tournament) => <Link key={tournament.id} href={`/anything-wars/tournaments/${tournament.id}`}><Card interactive className="h-full"><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle>{tournament.name}</CardTitle><Badge variant={tournament.status === "COMPLETED" ? "success" : tournament.status === "PAUSED" ? "warning" : tournament.status === "CANCELLED" ? "danger" : "accent"}>{tournament.status.replaceAll("_", " ")}</Badge></div><CardDescription>{tournament.description ?? tournament.format.replaceAll("_", " ")}</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><p><span className="block text-xs text-muted">Competitors</span>{tournament.participants.length}</p><p><span className="block text-xs text-muted">Matches</span>{tournament.matches.length}</p><p><span className="block text-xs text-muted">Format</span>{tournament.format.replaceAll("_", " ")}</p><p><span className="block text-xs text-muted">Mechanics</span>{tournament.moduleKey}</p></CardContent></Card></Link>)}</div> : <EmptyState icon={Trophy} title="No Tournaments yet" description="Create a multi-match competition from a READY Battle, Race, or Survival template." action={canManage ? <Link href="/anything-wars/tournaments/new" className={buttonClasses()}><Plus className="size-4" />Create Tournament</Link> : undefined} />}
    <Link href="/tournaments" className="text-sm font-medium text-accent hover:underline">Open generic Tournament tools</Link>
  </div>;
}
