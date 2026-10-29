import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Globe2, MapPin, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { getPublicFictionalCountry } from "@/server/services/fictional-planet-service";

export const metadata: Metadata = {
  title: "Country Overview | SIMVERSE",
  description: "Discover an original published country on the SIMVERSE planet.",
  robots: { index: false, follow: false },
};

export default async function CountryOverviewPage({
  params,
}: { params: Promise<{ countryId: string }> }) {
  const { countryId } = await params;
  let country: Awaited<ReturnType<typeof getPublicFictionalCountry>>;
  try {
    country = await getPublicFictionalCountry(countryId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return (
    <main className="min-h-dvh bg-[#030b17] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/planet" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cyan-100 hover:bg-white/10">
          <ArrowLeft size={16} aria-hidden /> Back to planet
        </Link>
        <section className="mt-8 overflow-hidden rounded-3xl border border-white/15 bg-[#0c1d30]">
          <div className="h-2" style={{ backgroundColor: country.color }} aria-hidden />
          <div className="p-6 sm:p-10">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-200"><Globe2 size={16}/> SIMVERSE · Country overview</p>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">{country.name}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-200">{country.description || "An original country on the fictional SIMVERSE planet."}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#061528] p-4">
                <p className="flex items-center gap-2 text-sm text-slate-300"><MapPin size={16}/> Territory area</p>
                <strong className="mt-2 block text-2xl tabular-nums">{new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(country.areaKm2)} km²</strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#061528] p-4">
                <p className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck size={16}/> Publication</p>
                <strong className="mt-2 block text-lg">Published · v{country.publishedRevision}</strong>
              </div>
            </div>
            <p className="mt-7 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-sm text-slate-300">
              This country is discoverable on the orbital planet. A walkable 3D country environment, cities, activities and land are planned for Phase 5 and later. This page is an overview, not a simulated city.
            </p>
            <Link href="/planet" className="mt-6 inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#021521] hover:bg-cyan-200">
              Explore planet
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
