import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listTournamentCreationOptions } from "@/server/services/tournament-service";
import { TournamentForm } from "@/components/tournaments/tournament-form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "New Tournament" };
export default async function NewTournamentPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("tournament.manage")) return <div className="space-y-6"><PageHeader icon={Trophy} title="New Tournament" description="Create a competition structure." /><EmptyState icon={Trophy} title="You can’t create Tournaments" description="Your role does not include Tournament management." action={<Link href="/tournaments" className={buttonClasses({ variant: "secondary" })}>Back to Tournaments</Link>} /></div>;
  const options = await listTournamentCreationOptions(user.id, workspace.id);
  return <div className="space-y-6"><Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Tournaments</Link><PageHeader icon={Trophy} title="New Tournament" description="Configure participants, seeding, an authoritative Simulation template, presentation defaults, and competition rules." />{options.simulations.length && options.entities.length >= 2 ? <TournamentForm mode="create" options={options} /> : <EmptyState icon={Trophy} title="Tournament prerequisites are missing" description="Create at least two active Entities and one READY Battle duel Simulation before creating a Tournament." />}</div>;
}
