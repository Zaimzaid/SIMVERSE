import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { TOURNAMENT_FORMATS, TOURNAMENT_STATUSES, type TournamentFormat, type TournamentStatusFilter } from "@/lib/tournaments/constants";
import { requirePlatformContext } from "@/server/context";
import { listTournaments } from "@/server/services/tournament-service";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

export const metadata: Metadata = { title: "Tournaments" };
type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("tournament.view")) return <div className="space-y-6"><PageHeader icon={Trophy} title="Tournaments" description="Workspace competition orchestration." /><EmptyState icon={Trophy} title="No access to Tournaments" description="Your role does not include Tournament access." /></div>;
  const query = await searchParams; const search = first(query.q); const statusRaw = first(query.status).toUpperCase();
  const status = ([...TOURNAMENT_STATUSES, "CURRENT", "ALL"] as readonly string[]).includes(statusRaw) ? statusRaw as TournamentStatusFilter : "CURRENT";
  const formatRaw = first(query.format).toUpperCase(); const format = (TOURNAMENT_FORMATS as readonly string[]).includes(formatRaw) ? formatRaw as TournamentFormat : undefined;
  const result = await listTournaments(user.id, workspace.id, { search, status, format }); const canManage = permissions.includes("tournament.manage");
  return <div className="space-y-6"><PageHeader icon={Trophy} title="Tournaments" description="Coordinate authoritative SimulationRuns through brackets and round-robin schedules." actions={canManage ? <Link href="/tournaments/new" className={buttonClasses()}><Plus className="size-4" />New Tournament</Link> : undefined} />
    <form className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-3"><Input name="q" defaultValue={search} placeholder="Search Tournaments" /><Select name="status" defaultValue={status}><option value="CURRENT">Current statuses</option><option value="ALL">All statuses</option>{TOURNAMENT_STATUSES.map((item) => <option key={item}>{item.replaceAll("_", " ")}</option>)}</Select><Select name="format" defaultValue={format ?? ""}><option value="">All formats</option>{TOURNAMENT_FORMATS.map((item) => <option key={item}>{item.replaceAll("_", " ")}</option>)}</Select><button className={buttonClasses({ variant: "secondary", className: "md:col-span-3 md:justify-self-start" })}>Apply filters</button></form>
    {result.items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{result.items.map((tournament) => <Link key={tournament.id} href={`/tournaments/${tournament.id}`}><Card interactive className="h-full"><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle>{tournament.name}</CardTitle><Badge variant={tournament.status === "COMPLETED" ? "success" : tournament.status === "PAUSED" ? "warning" : tournament.status === "CANCELLED" ? "danger" : "accent"}>{tournament.status.replaceAll("_", " ")}</Badge></div><CardDescription>{tournament.description ?? `${tournament.format.replaceAll("_", " ")} Tournament`}</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><p><span className="block text-xs text-muted">Format</span>{tournament.format.replaceAll("_", " ")}</p><p><span className="block text-xs text-muted">Participants</span>{tournament.participants.length}</p><p><span className="block text-xs text-muted">Matches</span>{tournament.matches.length}</p><p><span className="block text-xs text-muted">Module</span>{tournament.moduleKey}</p></CardContent></Card></Link>)}</div> : <EmptyState icon={Trophy} title="No Tournaments found" description="Create a Tournament or adjust the active filters." action={canManage ? <Link href="/tournaments/new" className={buttonClasses()}><Plus className="size-4" />Create Tournament</Link> : undefined} />}
  </div>;
}
