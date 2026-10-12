import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listTournamentCreationOptions } from "@/server/services/tournament-service";
import { TournamentForm } from "@/components/tournaments/tournament-form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Create Anything Wars Tournament" };

export default async function AnythingWarsNewTournamentPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("tournament.manage")) return <EmptyState icon={Trophy} title="You cannot create Tournaments" description="Your workspace role does not include Tournament management." action={<Link href="/anything-wars/tournaments" className={buttonClasses({ variant: "secondary" })}>Back to Tournaments</Link>} />;
  const options = await listTournamentCreationOptions(user.id, workspace.id);
  return <div className="space-y-6"><Link href="/anything-wars/tournaments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Anything Wars Tournaments</Link><PageHeader eyebrow="Anything Wars" icon={Trophy} title="New Tournament" description="Choose competitors, deterministic seeding, and a READY Battle, Race, or Survival Simulation template." />{options.simulations.length && options.entities.length >= 2 ? <TournamentForm mode="create" options={options} detailBasePath="/anything-wars/tournaments" productLanguage /> : <EmptyState icon={Trophy} title="Tournament prerequisites are missing" description="Create at least two active Entities and one READY supported Simulation template first." action={<Link href="/anything-wars/create" className={buttonClasses({ variant: "secondary" })}>Create a War template</Link>} />}</div>;
}
