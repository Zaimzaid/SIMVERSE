import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ConceptMapExplorer } from "@/components/planet/concept-map-explorer";

export const metadata: Metadata = {
  title: "Five-Continent Concept Map | SIMVERSE",
  description: "Original landmass sketches and candidate fictional-country positions, not published territories.",
  robots: { index: false, follow: false },
};

export default function ConceptPlanetMapPage() {
  return (
    <main className="min-h-dvh bg-[#041022] px-4 py-8 text-slate-100 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/planet/planning"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 px-4 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-300/10">
          <ArrowLeft className="size-4" aria-hidden /> Founding country plan
        </Link>
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            SIMVERSE · Geographic design laboratory · Phase 2B
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            A first look at our five continents
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
            Compare original fictional landmass silhouettes and proposed positions for the ten
            founding countries. No national borders or district boundaries are approved here.
            Your review of this geography should come before any steward-authorized publication.
          </p>
        </header>
        <Link href="/planet/planning/globe"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/30 bg-[#12304b] px-5 py-3 text-sm font-semibold text-cyan-100 hover:border-cyan-200/70">
          See these proposed continents on the rotating globe
        </Link>
        <ConceptMapExplorer />
        <p className="flex items-start gap-3 rounded-xl border border-cyan-200/15 bg-[#0b223b] p-5 text-sm text-slate-300">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-200" aria-hidden />
          This experimental atlas is not based on Earth coastlines, does not publish fictional
          countries, does not create resident or land-owner rights, and does not change any
          existing world or legacy geographic records.
        </p>
      </div>
    </main>
  );
}
