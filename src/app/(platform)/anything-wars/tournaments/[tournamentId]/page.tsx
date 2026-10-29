import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListOrdered, Network, Pencil, Play, Trophy, Users } from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getTournament } from "@/server/services/tournament-service";
import { RunMatchButton, TournamentActions } from "@/components/tournaments/tournament-actions";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Tournament = Awaited<ReturnType<typeof getTournament>>;

export default async function AnythingWarsTournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();
  let tournament: Tournament;
  try { tournament = await getTournament(user.id, workspace.id, tournamentId); }
  catch (error) { if (isHiddenResourceError(error)) notFound(); throw error; }
  const canManage = permissions.includes("tournament.manage");
  const canRun = permissions.includes("tournament.run") && tournament.status === "IN_PROGRESS";
  const participants = new Map(tournament.participants.map((participant) => [participant.id, participant]));
  const champion = tournament.championParticipantId ? participants.get(tournament.championParticipantId) : null;

  return <div className="space-y-6">
    <Link href="/anything-wars/tournaments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Anything Wars Tournaments</Link>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant={tournament.status === "COMPLETED" ? "success" : tournament.status === "PAUSED" ? "warning" : tournament.status === "CANCELLED" ? "danger" : "accent"}>{tournament.status.replaceAll("_", " ")}</Badge><Badge variant="outline">{tournament.format.replaceAll("_", " ")}</Badge></div><h1 className="mt-2 font-display text-2xl font-semibold text-foreground">{tournament.name}</h1><p className="mt-1 text-sm text-secondary">{tournament.description ?? "An Anything Wars multi-match competition."}</p></div><div className="flex flex-wrap gap-2">{canManage && ["DRAFT", "CONFIGURING"].includes(tournament.status) ? <Link href={`/tournaments/${tournament.id}/edit`} className={buttonClasses({ variant: "secondary", size: "sm" })}><Pencil className="size-4" />Edit setup</Link> : null}<TournamentActions tournamentId={tournament.id} status={tournament.status} canManage={canManage} /></div></div>
    {tournament.executionError ? <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">{tournament.executionError}</div> : null}
    {champion ? <Card className="border-accent/40"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-accent">Champion</p><p className="mt-1 font-display text-2xl font-semibold">{champion.displayName}</p></CardContent></Card> : null}

    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Competitors" value={tournament.participants.length} /><Metric label="Matches" value={tournament.matches.length} /><Metric label="Completed" value={tournament.matches.filter((match) => match.state === "COMPLETED" || match.state === "BYE").length} /></div>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4" />Competitors</CardTitle><CardDescription>Saved Tournament identities stay frozen when source Entities change.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tournament.participants.map((participant) => <div key={participant.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span><strong>#{participant.seed}</strong> {participant.displayName}<span className="block text-xs text-muted">{participant.entityCategory}</span></span><Badge variant={participant.status === "ACTIVE" ? "success" : "neutral"}>{participant.status}</Badge></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Network className="size-4" />{tournament.format === "SINGLE_ELIMINATION" ? "Bracket" : "Schedule"}</CardTitle><CardDescription>Every played Match creates a normal authoritative SimulationRun.</CardDescription></CardHeader><CardContent>{tournament.rounds.length ? <div className="grid gap-4 lg:grid-cols-2">{tournament.rounds.map((round) => <section key={round.id} className="rounded-xl border border-border p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{round.label}</h3><Badge variant="outline">{round.state}</Badge></div><div className="space-y-2">{tournament.matches.filter((match) => match.roundId === round.id).map((match) => <div key={match.id} className="rounded-lg bg-surface-elevated p-3 text-sm"><div className="flex items-center justify-between"><span className="text-xs text-muted">Match #{match.matchNumber}</span><Badge variant={match.state === "COMPLETED" || match.state === "BYE" ? "success" : match.state === "RUNNING" ? "warning" : "outline"}>{match.state}</Badge></div><p className="mt-2">{participants.get(match.participantOneId ?? "")?.displayName ?? "TBD"} vs {participants.get(match.participantTwoId ?? "")?.displayName ?? (match.state === "BYE" ? "BYE" : "TBD")}</p>{match.winnerParticipantId ? <p className="mt-1 font-medium text-accent">Winner: {participants.get(match.winnerParticipantId)?.displayName}</p> : null}{canRun && match.state === "READY" ? <div className="mt-3"><RunMatchButton tournamentId={tournament.id} matchId={match.id} /></div> : null}{match.simulationRunId && match.simulationId ? <Link href={`/simulations/${match.simulationId}/runs/${match.simulationRunId}`} className="mt-2 inline-flex text-xs font-medium text-accent hover:underline"><Play className="mr-1 size-3.5" />View Match Run</Link> : null}</div>)}</div></section>)}</div> : <p className="text-sm text-muted">Generate the structure to create rounds and Matches.</p>}</CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ListOrdered className="size-4" />Standings</CardTitle></CardHeader><CardContent>{tournament.standings.length ? <ol className="space-y-2">{tournament.standings.map((standing) => <li key={standing.tournamentParticipantId} className="grid grid-cols-[3rem_1fr_auto] gap-3 rounded-lg border border-border p-3 text-sm"><strong>#{standing.rank}</strong><span>{standing.displayName}</span><span className="text-muted">{standing.wins}W · {standing.losses}L · {standing.points} pts</span></li>)}</ol> : <p className="text-sm text-muted">Standings appear as Match results are accepted.</p>}</CardContent></Card>
    <Link href={`/tournaments/${tournament.id}`} className="text-sm font-medium text-accent hover:underline">View full generic Tournament details</Link>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted">{label}</p><p className="mt-1 text-xl font-semibold text-foreground">{value}</p></CardContent></Card>;
}
