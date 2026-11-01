import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft, ArrowRight, Compass, Flag, Globe2, Layers3, MapPinned, ShieldCheck,
} from "lucide-react";
import {
  FOUNDING_COUNTRIES, FOUNDING_TOTALS, plannedCityCount, plannedDistrictCount,
} from "@/lib/planet/founding-plan";

export const metadata: Metadata = {
  title: "Founding Geography Plan | SIMVERSE",
  description: "A proposed ten-country civilization planning blueprint. Territories are not yet published.",
  robots: { index: false, follow: false },
};

const summary = [
  { label: "Proposed continents", value: FOUNDING_TOTALS.continentsProposed, icon: Globe2 },
  { label: "Founding countries", value: FOUNDING_TOTALS.countries, icon: Flag },
  { label: "Planned states", value: FOUNDING_TOTALS.states, icon: Layers3 },
  { label: "Planned cities / towns", value: FOUNDING_TOTALS.cities, icon: MapPinned },
  { label: "Potential districts", value: FOUNDING_TOTALS.districts, icon: Compass },
] as const;

export default function FoundingGeographyPlanPage() {
  return (
    <main className="min-h-dvh bg-[#041022] px-4 py-8 text-slate-100 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/planet"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 px-4 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-300/10">
          <ArrowLeft className="size-4" /> Back to the planet
        </Link>

        <header className="mt-8 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
            SIMVERSE · Build Your Civilization · Geographic planning
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">The ten founding countries</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
            Explore our proposed hierarchy of countries, states, cities and districts.
            These are planning slots — not approved borders, published fictional countries,
            assigned property, or active citizen districts.
          </p>
        </header>

        <section aria-label="World planning totals" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          {summary.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-cyan-200/15 bg-[#0a2039] p-4">
              <Icon aria-hidden className="size-5 text-cyan-200" />
              <p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{label}</p>
            </div>
          ))}
        </section>

        <section aria-label="Continent concept previews" className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/planet/planning/map" className="group flex items-center justify-between rounded-2xl border border-cyan-200/25 bg-[#0a2039] p-5 text-cyan-100 hover:border-cyan-200/60">
            <div>
              <h2 className="font-semibold">View five-continent concept map</h2>
              <p className="mt-1 text-xs text-slate-300">Original landmasses and ten suggested country positions</p>
            </div>
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link href="/planet/planning/globe" className="group flex items-center justify-between rounded-2xl border border-cyan-200/25 bg-[#0a2039] p-5 text-cyan-100 hover:border-cyan-200/60">
            <div>
              <h2 className="font-semibold">Preview the concept on the 3D globe</h2>
              <p className="mt-1 text-xs text-slate-300">Unapproved coastlines on a reversible globe preview</p>
            </div>
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </section>

        <section aria-labelledby="planned-nations-heading" className="mt-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="planned-nations-heading" className="text-2xl font-semibold">Country planning cards</h2>
              <p className="mt-1 text-sm text-slate-400">Select a country to inspect every proposed state and district slot.</p>
            </div>
            <span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
              Blueprint only · No land is published
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FOUNDING_COUNTRIES.map((country) => (
              <Link href={`/planet/planning/${country.slug}`} key={country.slug}
                className="group rounded-2xl border border-cyan-200/15 bg-[#0a2039] p-5 transition hover:border-cyan-300/45 hover:bg-[#103050] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-lg bg-cyan-200/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-100">{country.size.toLowerCase()} plan</span>
                  <ArrowRight aria-hidden className="size-4 text-cyan-200 transition group-hover:translate-x-1" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{country.name}</h3>
                {country.capital && <p className="mt-1 text-xs text-cyan-100">Planned capital: {country.capital}</p>}
                {country.proposedTeamManaged && <p className="mt-1 text-xs text-amber-100">Proposed staff-managed showcase country</p>}
                {country.slug === "arandia" && <p className="mt-1 text-xs text-emerald-200">Proposed citizen-led pilot location</p>}
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                  <div><p className="text-lg font-semibold">{country.plannedStates}</p><p className="text-[11px] text-slate-400">States</p></div>
                  <div><p className="text-lg font-semibold">{plannedCityCount(country)}</p><p className="text-[11px] text-slate-400">Cities</p></div>
                  <div><p className="text-lg font-semibold">{plannedDistrictCount(country)}</p><p className="text-[11px] text-slate-400">Districts</p></div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section aria-label="Planning rules" className="mt-10 rounded-2xl border border-cyan-200/15 bg-[#081b30] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-cyan-100"><ShieldCheck aria-hidden className="size-5" /><h2 className="font-semibold">What happens next?</h2></div>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Before any country appears as sovereign territory on the globe, SIMVERSE must design
            and validate original boundaries, check overlaps, and publish reviewed geometry
            through the existing fictional-country approval system. District activation and
            land allocations will be separate, later steps.
          </p>
        </section>
      </div>
    </main>
  );
}
