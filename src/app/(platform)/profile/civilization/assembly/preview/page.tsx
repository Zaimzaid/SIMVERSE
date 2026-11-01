import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import { CalendarDays, CircleDot, Flag, MessageCircle, ShieldAlert, Users, Vote } from "lucide-react";

export const metadata: Metadata = {
  title: "District Assembly Design Preview | SIMVERSE",
  robots: { index: false, follow: false },
};

const sampleIdeas = [
  { name: "Community sports court", category: "Recreation", detail: "Residents suggest a flexible open-air space for games and weekend gatherings.", support: 12, oppose: 2 },
  { name: "Public tree and shade corridor", category: "Environment", detail: "A proposal for cooler walkways and shaded public areas.", support: 9, oppose: 1 },
  { name: "Shared learning and maker hub", category: "Services", detail: "A small community workspace for workshops, design and digital skills.", support: 7, oppose: 3 },
] as const;

export default async function AssemblyPreviewPage() {
  await requireUser();
  return <main className="mx-auto max-w-6xl space-y-7">
    <Link href="/profile/civilization/assembly"
      className="inline-block text-sm font-semibold text-accent hover:underline">← My District Assembly</Link>
    <header className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-200">
          Design Preview Only
        </span>
        <span className="text-xs text-secondary">No live residents, meetings, proposals or votes shown</span>
      </div>
      <h1 className="mt-5 font-display text-3xl font-semibold text-foreground sm:text-4xl">Build Your District Together</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
        This is a visual sample of a future district assembly, not a connected
        community. Every proposal, number and notice below is invented for
        interface demonstration only. Official districts remain inactive until
        reviewed geography and real membership are available.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <Users className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-foreground">District residents</p>
          <p className="mt-1 text-sm text-secondary">Actual membership: not active</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <Vote className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-foreground">Community decisions</p>
          <p className="mt-1 text-sm text-secondary">Advisory, not automatic construction</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <ShieldAlert className="size-5 text-accent" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-foreground">Staff feasibility</p>
          <p className="mt-1 text-sm text-secondary">Separate approval after voting</p>
        </div>
      </div>
    </header>
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Sample project proposals</h2>
          <span className="text-xs text-secondary">Demonstration values</span>
        </div>
        {sampleIdeas.map((idea) => <article key={idea.name}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <CircleDot className="size-4" aria-hidden /> {idea.category} · Example
          </div>
          <h3 className="mt-3 text-lg font-semibold text-foreground">{idea.name}</h3>
          <p className="mt-2 text-sm leading-7 text-secondary">{idea.detail}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-secondary">
            <span>Example support: {idea.support}</span><span>Example oppose: {idea.oppose}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled className="rounded-xl border border-border px-4 py-2.5 text-sm text-secondary opacity-50">Support (preview)</button>
            <button disabled className="rounded-xl border border-border px-4 py-2.5 text-sm text-secondary opacity-50">Discuss (preview)</button>
          </div>
        </article>)}
      </div>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><Flag className="size-5 text-accent" aria-hidden /> How ideas progress</h2>
          <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-6 text-secondary">
            <li>Resident proposes an idea</li>
            <li>Independent moderation approves discussion</li>
            <li>Eligible residents vote once</li>
            <li>Supported ideas reach staff feasibility review</li>
            <li>Later project phases decide sites, costs and construction</li>
          </ol>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><CalendarDays className="size-5 text-accent" aria-hidden /> Example meeting</h2>
          <p className="mt-3 text-sm text-secondary">A neighborhood planning meeting could appear here after an authorized moderator schedules it.</p>
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-200">No meeting has been scheduled</p>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><MessageCircle className="size-5 text-accent" aria-hidden /> Moderated discussion</h2>
          <p className="mt-3 text-sm text-secondary">Real residents will be able to discuss published ideas after joining an approved district. Unreviewed comments remain private.</p>
        </section>
      </aside>
    </section>
  </main>;
}
