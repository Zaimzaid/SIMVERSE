import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, ClipboardList, ShieldAlert, XCircle } from "lucide-react";
import { buildConceptGeographyAudit } from "@/lib/planet/concept-audit";

export const metadata: Metadata = {
  title: "Geography Design Audit | SIMVERSE",
  description: "A non-publishing, concept-only technical review of proposed fictional country borders.",
  robots: { index: false, follow: false },
};

function formatArea(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export default function ConceptGeographyAuditPage() {
  const audit = buildConceptGeographyAudit();
  return (
    <main className="min-h-dvh bg-[#041022] px-4 py-8 text-slate-100 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/planet/planning/map" className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 px-4 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-300/10">
          <ArrowLeft className="size-4" aria-hidden /> Back to concept atlas
        </Link>
        <header className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <ClipboardList className="size-4" aria-hidden /> Phase 2C · Non-publishing geometry review
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Country boundary readiness</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            We check each proposed border against the coastline using all concept
            polygon vertices and edges, rather than a few sample points. All results
            apply to the current simple, non-wrapping draft shapes only — not to
            production-grade spherical GIS or approved sovereign territories.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Readiness overview">
          <div className="rounded-2xl border border-white/15 bg-[#0a2039] p-5">
            <p className="text-xs text-slate-300">Draft countries checked</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{audit.countries.length}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-[#0a2039] p-5">
            <p className="text-xs text-slate-300">Concept geometry checks</p>
            <p className="mt-2 inline-flex items-center gap-2 font-semibold">
              {audit.reviewPassesConceptChecks ? <CheckCircle2 className="size-5 text-emerald-300" aria-hidden /> : <XCircle className="size-5 text-rose-300" aria-hidden />}
              {audit.reviewPassesConceptChecks ? "Passed" : "Needs correction"}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/20 bg-amber-300/5 p-5">
            <p className="text-xs text-amber-100">Publication approval</p>
            <p className="mt-2 font-semibold text-amber-100">Not granted</p>
          </div>
        </section>

        <section aria-label="Publication limitations" className="rounded-2xl border border-amber-200/25 bg-[#192032] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-amber-100">
            <ShieldAlert className="size-5" aria-hidden /> These are not permanent borders
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-200">
            The report does not read, edit or publish the authoritative FictionalCountry
            database. Only the existing protected published-country API can confirm real
            publication status. This report does not create citizenship, state, district,
            property or mineral rights. Full GIS topology, design approval and steward
            authorization are still required.
          </p>
        </section>

        <section aria-labelledby="country-audit-heading">
          <h2 id="country-audit-heading" className="text-xl font-semibold">Country concept checks</h2>
          <p className="mt-1 text-sm text-slate-300">Measured draft areas are approximate km² on the 6,000-km-radius fictional planet.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/15">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#102d48] text-xs uppercase tracking-wide text-cyan-100">
                <tr>
                  <th scope="col" className="px-4 py-4">Country</th>
                  <th scope="col" className="px-4 py-4">Draft area</th>
                  <th scope="col" className="px-4 py-4">Coast containment</th>
                  <th scope="col" className="px-4 py-4">No overlap</th>
                  <th scope="col" className="px-4 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {audit.countries.map((country) => (
                  <tr key={country.slug} className="border-t border-white/10 bg-[#071a31] text-slate-200">
                    <th scope="row" className="px-4 py-3 font-semibold">{country.name}</th>
                    <td className="px-4 py-3 tabular-nums">{formatArea(country.draftAreaKm2)} km²</td>
                    <td className="px-4 py-3">{country.strictlyWithinContinent ? "Pass" : "Needs correction"}</td>
                    <td className="px-4 py-3">{!country.overlapsAnotherCountry ? "Pass" : "Conflict"}</td>
                    <td className="px-4 py-3 text-amber-100">Unapproved sketch</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="land-coverage-heading">
          <h2 id="land-coverage-heading" className="text-xl font-semibold">Unassigned continental land</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            National drafts cover only part of each continent. These percentages represent
            the nominal leftover area after subtracting sketch footprints, not reviewed
            official unclaimed-land boundaries or verified cadastral coverage.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {audit.continents.map((land) => (
              <div key={land.id} className="rounded-2xl border border-white/15 bg-[#0a2039] p-5">
                <h3 className="font-semibold">{land.name}</h3>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{land.nominalUnassignedPercent}%</p>
                <p className="mt-1 text-xs text-slate-300">Nominal land outside draft countries</p>
                <p className="mt-3 text-xs text-cyan-100">{land.proposedCountryCount} proposed countries</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-amber-100">
            {audit.resourceStudyMarkersUnassigned} resource study markers remain unassigned to any sovereign country or economic system.
          </p>
        </section>
      </div>
    </main>
  );
}
