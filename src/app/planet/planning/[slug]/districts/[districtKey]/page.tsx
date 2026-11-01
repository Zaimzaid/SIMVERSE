import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, MapPinned, ShieldCheck } from "lucide-react";
import { conceptGlobeHref, conceptMapHref, getPlannedDistrictLocation } from "@/lib/planet/concept-navigation";

type PageProps = { params: Promise<{ slug: string; districtKey: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, districtKey } = await params;
  const item = getPlannedDistrictLocation(slug, districtKey);
  return {
    title: item ? `${item.district.label} · ${item.country.name} Planning | KAVANDRO` : "Unknown District Plan | KAVANDRO",
    robots: { index: false, follow: false },
  };
}

/**
 * Static planned hierarchy, NOT a published district or a district map.
 * Country-level polygon is only a draft, and no internal district boundaries
 * are yet available or assigned.
 */
export default async function DraftDistrictPlanPage({ params }: PageProps) {
  const { slug, districtKey } = await params;
  const item = getPlannedDistrictLocation(slug, districtKey);
  if (!item) notFound();
  const { country, state, city, district } = item;
  const status = district.status === "PILOT_CANDIDATE"
    ? "Candidate for initial pilot"
    : district.status === "EXPANSION_CANDIDATE"
      ? "Potential pilot expansion"
      : "Future planning slot";

  return (
    <main className="min-h-dvh bg-[#041022] px-4 py-8 text-slate-100 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href={`/planet/planning/${country.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
          <ArrowLeft className="size-4" aria-hidden /> Back to {country.name}
        </Link>
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">KAVANDRO · Concept district profile</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{district.label}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            This is a planning slot in a proposed founding nation, not an active
            jurisdiction or an accessible 3D neighborhood. Its exact location,
            boundary, name and facilities will be decided through future review.
          </p>
        </header>
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Proposed district hierarchy">
          {[
            ["Country concept", country.name],
            ["State slot", state.label],
            ["City / town slot", city.label],
            ["District status", status],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/15 bg-[#0a2039] p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-2 font-semibold text-white">{value}</p>
            </div>
          ))}
        </section>
        <div className="rounded-2xl border border-cyan-200/20 bg-[#0b223b] p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><MapPinned className="size-5 text-cyan-200" aria-hidden /> Where is this district?</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            No district-level geometry is approved. The links below highlight only the
            proposed <strong>country</strong> location; they do not place this district
            within the country or authorize land, planning, citizenship or voting rights.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={conceptMapHref(country.slug)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
              <Compass className="size-4" aria-hidden /> View country on flat atlas
            </Link>
            <Link href={conceptGlobeHref(country.slug)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
              View country on globe <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-xl border border-amber-200/20 bg-amber-200/5 p-5 text-sm leading-6 text-amber-100">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          No residency, nationality, district assembly membership, wallet credits,
          funding, real-world property or virtual ownership is granted by viewing this planning page.
        </p>
      </div>
    </main>
  );
}
