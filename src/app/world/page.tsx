import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Compass, Flag, Globe2, MapPinned, ShieldCheck } from "lucide-react";
import { CONCEPT_CONTINENTS, CONCEPT_COUNTRY_SITES } from "@/lib/planet/concept-geography";
import { FOUNDING_COUNTRIES, plannedDistrictCount } from "@/lib/planet/founding-plan";
import { conceptGlobeHref, conceptMapHref } from "@/lib/planet/concept-navigation";

export const metadata: Metadata = {
  title: "Explore the Fictional World | KAVANDRO",
  description: "Discover KAVANDRO's original five-continent world concept and ten founding country planning profiles. No territories are published.",
  robots: { index: false, follow: false },
};

/** Public, non-publishing concept explorer: does not query citizenship, land
 * ownership, published country, districts, nor activity data.
 */
export default function WorldExplorerPage() {
  return (
    <main className="min-h-dvh bg-[#041022] px-4 py-8 text-slate-100 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-7xl space-y-9">
        <header className="max-w-3xl">
          <Link href="/" className="text-sm font-semibold text-cyan-100 underline-offset-4 hover:underline">KAVANDRO home</Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Build Your Civilization · K2 world explorer</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">A world waiting for its citizens.</h1>
          <p className="mt-5 text-base leading-8 text-slate-300">
            Discover our original, fictional planet concept. Compare the five proposed
            continents, focus any of ten founding countries, and explore proposed
            district planning slots. Boundaries and districts remain unapproved.
          </p>
        </header>

        <section aria-label="Choose a world view" className="grid gap-4 sm:grid-cols-2">
          <Link href={conceptMapHref()} className="group rounded-3xl border border-cyan-200/25 bg-[#0b2b45] p-6 hover:border-cyan-200/65">
            <Compass className="size-7 text-cyan-200" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Flat atlas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Compare all five landmasses, ten draft country outlines, terrain and study layers. Works without WebGL.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">Open atlas <ArrowRight className="size-4" aria-hidden /></span>
          </Link>
          <Link href={conceptGlobeHref()} className="group rounded-3xl border border-cyan-200/25 bg-[#0b2b45] p-6 hover:border-cyan-200/65">
            <Globe2 className="size-7 text-cyan-200" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">3D concept globe</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Rotate the fictional planet, focus a candidate nation and follow the same selection into the flat atlas.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">Open globe <ArrowRight className="size-4" aria-hidden /></span>
          </Link>
        </section>

        <section aria-labelledby="concept-countries-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="concept-countries-heading" className="text-2xl font-semibold">Ten founding-country concepts</h2>
              <p className="mt-1 text-sm text-slate-300">Grouped by the five proposed landmasses. Every entry is a design candidate, not a published country.</p>
            </div>
            <Link href="/planet/planning/audit" className="text-sm font-semibold text-cyan-100 underline-offset-4 hover:underline">Review coastline and boundary checks</Link>
          </div>
          <div className="space-y-6">
            {CONCEPT_CONTINENTS.map((continent) => (
              <section key={continent.id} aria-label={continent.label} className="rounded-3xl border border-white/10 bg-[#081b30] p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-xl font-semibold">
                  <MapPinned className="size-5 text-cyan-200" aria-hidden />{continent.label}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {CONCEPT_COUNTRY_SITES.filter((site) => site.continentId === continent.id).map((site) => {
                    const country = FOUNDING_COUNTRIES.find((item) => item.slug === site.slug)!;
                    return (
                      <div key={site.slug} className="rounded-2xl border border-white/10 bg-[#0b2942] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="flex items-center gap-2 text-lg font-semibold"><Flag className="size-4 text-cyan-200" aria-hidden />{country.name}</h4>
                          <span className="rounded-full border border-amber-200/20 px-2 py-1 text-[11px] font-semibold text-amber-100">Draft</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-300">
                          {country.plannedStates} proposed state slots · {plannedDistrictCount(country)} potential district slots
                          {country.capital ? ` · Proposed capital: ${country.capital}` : ""}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-cyan-100">
                          <Link href={conceptMapHref(country.slug)} className="hover:underline">Flat map</Link>
                          <Link href={conceptGlobeHref(country.slug)} className="hover:underline">Globe</Link>
                          <Link href={`/planet/planning/${country.slug}`} className="hover:underline">District plan</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <p className="flex items-start gap-3 rounded-2xl border border-amber-200/20 bg-amber-200/5 p-5 text-sm leading-6 text-amber-100">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          This explorer displays nonbinding fictional geography concepts only. No official
          jurisdiction, district location, citizenship, ownership, resource rights,
          3D construction or virtual funds are created by these views.
        </p>
      </div>
    </main>
  );
}
