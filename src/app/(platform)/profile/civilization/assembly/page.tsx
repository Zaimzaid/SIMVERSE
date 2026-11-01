import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import { getDistrictAssembly, listMyAssemblyDistricts } from "@/server/services/district-assembly-service";
import { DistrictAssemblyClient } from "@/components/civilization/district-assembly-client";

export const metadata: Metadata = { title: "My District Assembly | SIMVERSE", robots: { index: false } };
export default async function DistrictAssemblyPage() {
  const user = await requireUser();
  const available = await listMyAssemblyDistricts(user.id);
  const district = available.districts[0];
  const assembly = district ? await getDistrictAssembly(user.id, district.id) : null;
  return <main className="mx-auto max-w-5xl space-y-7">
    <Link href="/profile/civilization" className="text-sm font-semibold text-accent hover:underline">← My Civilization</Link>
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Phase 4 · Build Your Civilization</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">District Assembly</h1>
      <p className="mt-3 text-sm leading-7 text-secondary">
        Help decide what should exist in your district. Community proposals, discussions
        and advisory votes do not create land rights or authorize construction.
      </p>
    </div>
    {assembly ? <><DistrictAssemblyClient assembly={assembly} />
      {assembly.canModerate && <Link href="/profile/civilization/assembly/moderation"
        className="inline-block rounded-xl border border-border px-5 py-3 text-sm font-semibold text-accent">
        Moderator review queue
      </Link>}</>
      : <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">Your assembly is not active yet</h2>
        <p className="mt-3 text-sm leading-7 text-secondary">{available.explanation}
          Until a verified country and active district are approved, no assembly members,
          meetings, proposals, votes or development projects can be activated.</p>
        <Link href="/profile/civilization"
          className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
          View my nationality and district status
        </Link>
      </section>}
  </main>;
}
