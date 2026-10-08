import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { NotFoundError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getTournament, listTournamentCreationOptions } from "@/server/services/tournament-service";
import { TournamentForm } from "@/components/tournaments/tournament-form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Edit Tournament" };
export default async function EditTournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params; const { user, workspace, permissions } = await requirePlatformContext();
  let tournament; try { tournament = await getTournament(user.id, workspace.id, tournamentId); } catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  if (!permissions.includes("tournament.manage") || !["DRAFT","CONFIGURING"].includes(tournament.status)) return <div className="space-y-6"><PageHeader icon={Trophy} title="Edit Tournament" description="Tournament structure is locked." /><EmptyState icon={Trophy} title="This Tournament cannot be edited" description="Structural configuration locks when a Tournament becomes ready." action={<Link href={`/tournaments/${tournament.id}`} className={buttonClasses({ variant: "secondary" })}>Back to Tournament</Link>} /></div>;
  const options = await listTournamentCreationOptions(user.id, workspace.id);
  return <div className="space-y-6"><Link href={`/tournaments/${tournament.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />{tournament.name}</Link><PageHeader icon={Trophy} title="Edit Tournament" description="Saving structural changes clears any generated schedule so it can be rebuilt deterministically." /><TournamentForm mode="edit" options={options} initial={tournament} /></div>;
}
