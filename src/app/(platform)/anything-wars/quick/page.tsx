import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import { isAnythingWarsEventMode, type AnythingWarsEventMode } from "@/lib/anything-wars/constants";
import { requirePlatformContext } from "@/server/context";
import { QuickWarForm } from "@/components/anything-wars/quick-war-form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Quick War" };
type SearchParams = Record<string, string | string[] | undefined>;

export default async function QuickWarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { permissions } = await requirePlatformContext();
  const query = await searchParams;
  const requested = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const initialMode: AnythingWarsEventMode = requested && isAnythingWarsEventMode(requested.toLowerCase())
    ? requested.toLowerCase() as AnythingWarsEventMode
    : "battle";

  if (!permissions.includes("simulation.create") || !permissions.includes("simulation.run")) {
    return <EmptyState icon={Swords} title="Quick War is unavailable" description="Your workspace role needs permission to create and run competitions." action={<Link href="/anything-wars" className={buttonClasses({ variant: "secondary" })}>Back to Anything Wars</Link>} />;
  }

  return (
    <div className="space-y-6">
      <Link href="/anything-wars" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Anything Wars</Link>
      <PageHeader eyebrow="Anything Wars · Quick War" icon={Swords} title="Choose. Compete. See what happens." description="Pick a working competition type and at least two competitors. SIMVERSE handles the ordinary setup for you." />
      <QuickWarForm initialMode={initialMode} />
    </div>
  );
}
