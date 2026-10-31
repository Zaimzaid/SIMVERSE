import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Flag, MapPinned, ShieldCheck, Users } from "lucide-react";
import {
  FOUNDING_COUNTRIES, getFoundingCountry, plannedCityCount,
  plannedDistrictCount, plannedStateSlots,
} from "@/lib/planet/founding-plan";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return FOUNDING_COUNTRIES.map((country) => ({ slug: country.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const country = getFoundingCountry(slug);
  return {
    title: country ? `${country.name} Planning | SIMVERSE` : "Country not found | SIMVERSE",
    robots: { index: false, follow: false },
  };
}

export default async function PlannedCountryPage({ params }: PageProps) {
  const { slug } = await params;
  const country = getFoundingCountry(slug);
  if (!country) notFound();
  const states = plannedStateSlots(country);
  return (
    <main className="min-h-dvh bg-[#041022] px-4 py-8 text-slate-100 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/planet/planning" className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 px-4 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-300/10">
          <ArrowLeft className="size-4" /> All founding countries
        </Link>
        <header className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
            SIMVERSE geographic blueprint · Proposed, not published
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{country.name}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            This country currently has {country.plannedStates} proposed state slots, {plannedCityCount(country)} city/town slots,
            and {plannedDistrictCount(country)} potential district slots. Locations, names and boundaries are not approved yet.
            Country publishing is a separate steward-authorized process.
          </p>
          {country.capital && (
            <p className="mt-3 text-sm text-cyan-100">
              Planned capital: <strong>{country.capital}</strong> — its state and precise location remain undecided.
            </p>
          )}
        </header>

        <section aria-label="Country overview" className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { title: "States", count: country.plannedStates, icon: Flag },
            { title: "Cities / towns", count: plannedCityCount(country), icon: Building2 },
            { title: "District slots", count: plannedDistrictCount(country), icon: MapPinned },
            { title: "Active districts", count: 0, icon: Users },
          ].map(({ title, count, icon: Icon }) => (
            <div key={title} className="rounded-xl border border-cyan-200/15 bg-[#0a2039] p-4">
              <Icon className="size-5 text-cyan-200" aria-hidden />
              <p className="mt-3 text-2xl font-semibold tabular-nums">{count}</p>
              <p className="mt-1 text-xs text-slate-400">{title}</p>
            </div>
          ))}
        </section>

        {country.slug === "arandia" && (
          <p className="mt-6 rounded-xl border border-emerald-200/20 bg-emerald-300/10 p-4 text-sm text-emerald-50">
            The first district shown in State 1 / City 1 is a <strong>pilot candidate</strong>,
            with two expansion candidates. They are not active and the locations can still change.
          </p>
        )}
        {country.proposedTeamManaged && (
          <p className="mt-6 rounded-xl border border-amber-200/20 bg-amber-300/10 p-4 text-sm text-amber-50">
            A team-managed showcase in this country is proposed; it does not yet have allocated land or a working country scene.
          </p>
        )}

        <section aria-labelledby="proposed-hierarchy" className="mt-10">
          <h2 id="proposed-hierarchy" className="text-2xl font-semibold">Proposed state, city and district hierarchy</h2>
          <p className="mt-2 text-sm text-slate-400">Expand any state to inspect its two city slots and six district slots.</p>
          <div className="mt-5 grid items-start gap-3 md:grid-cols-2">
            {states.map((state) => (
              <details key={state.key} className="group overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#0a2039] open:border-cyan-300/35">
                <summary className="cursor-pointer px-5 py-4 font-semibold marker:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
                  {state.label}
                  <span className="ml-2 text-xs font-normal text-slate-400">2 cities · 6 districts</span>
                </summary>
                <div className="space-y-4 border-t border-white/10 px-5 py-4">
                  {state.cities.map((city) => (
                    <section key={city.key}>
                      <h3 className="text-sm font-semibold text-cyan-100">{city.label}</h3>
                      <div className="mt-2 grid gap-2">
                        {city.districts.map((district) => (
                          <div key={district.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#06182d] px-3 py-2 text-xs">
                            <span className="text-slate-200">{district.label}</span>
                            <span className="text-cyan-100">
                              {district.status === "PILOT_CANDIDATE" ? "Pilot candidate" :
                                district.status === "EXPANSION_CANDIDATE" ? "Expansion candidate" :
                                  "Future planning slot"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-10 flex items-start gap-2 rounded-xl border border-cyan-200/15 bg-[#081b30] p-5 text-sm text-slate-300">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-200" aria-hidden />
          Planning keys are not real-world locations, published fictional borders, virtual property,
          citizenship or voting rights. A district becomes active only after approved geographic,
          governance and population checks.
        </p>
      </div>
    </main>
  );
}
