import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import {
  getMyDistrictDevelopmentBoard, listMyDevelopmentStaffDistricts,
} from "@/server/services/founding-development-service";

export const metadata: Metadata = {
  title: "District Development | KAVANDRO",
  robots: { index: false, follow: false },
};

const examples = [
  { title: "Community garden", phase: "Feasibility review" },
  { title: "Public activity space", phase: "Planning discussion" },
  { title: "Walkable civic area", phase: "Site study required" },
];

export default async function MyDistrictDevelopmentPage() {
  const user = await requireUser();
  const [board, staff] = await Promise.all([
    getMyDistrictDevelopmentBoard(user.id),
    listMyDevelopmentStaffDistricts(user.id),
  ]);
  return <main className="mx-auto max-w-5xl space-y-6">
    <Link href="/profile/civilization" className="text-sm font-semibold text-accent hover:underline">
      ← My Civilization
    </Link>
    <header>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        Phase 8 · Build Your Civilization
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
        District development
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
        See how citizen proposals can progress from an assembly recommendation
        into staff feasibility assessment and future planning.
      </p>
    </header>
    {staff.districts.length > 0 && <Link
      href="/profile/civilization/development/staff"
      className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
      Restricted staff feasibility queue
    </Link>}
    {!board.district ? <>
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold text-foreground">Development projects are not active in your district yet</p>
        <p className="mt-3 text-sm leading-7 text-secondary">
          Approved geography, active district residence and a shortlisted community proposal
          are required for real district progress reporting. The cards below are illustrative
          examples, not actual KAVANDRO projects or construction commitments.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-3" aria-label="Example development journey">
        {examples.map((e, index) => <div key={e.title}
          className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Example {index + 1}
          </p>
          <h2 className="mt-3 text-lg font-semibold text-foreground">{e.title}</h2>
          <p className="mt-2 text-sm text-secondary">{e.phase} · demonstration only</p>
        </div>)}
      </div>
    </> : <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{board.district.name} — citizen proposals</h2>
      {!board.cases.length && <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-secondary">
        No assembly-shortlisted projects have entered staff feasibility assessment yet.
      </p>}
      {board.cases.map((project) => <article key={project.id}
        className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{project.category}</p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{project.title}</h3>
        <p className="mt-2 text-sm font-medium text-secondary">
          {project.status.replaceAll("_", " ").toLowerCase()}
        </p>
        <p className="mt-2 text-sm text-secondary">
          No site reserved · No budget allocated · Construction not authorized
        </p>
        {project.updates.length > 0 && <div className="mt-5 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Planning updates</h4>
          {project.updates.map((u) => <div key={u.id}
            className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-semibold text-accent">{u.kind.replaceAll("_", " ")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{u.summary}</p>
            <p className="mt-2 text-xs text-secondary">{new Date(u.createdAt).toLocaleDateString()}</p>
          </div>)}
        </div>}
      </article>)}
    </section>}
    <p className="rounded-xl border border-border bg-surface p-5 text-sm leading-7 text-secondary">
      {board.notice}
    </p>
  </main>;
}
