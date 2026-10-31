import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { SignaturePlanetExplorer } from "@/components/planet/signature-planet-explorer";

export const metadata: Metadata = {
  title: "Five-Continent Concept Globe | SIMVERSE",
  description: "A rotating globe with unapproved original landform design, not published sovereign territory.",
  robots: { index: false, follow: false },
};

export default function ConceptGlobePage() {
  return (
    <main className="min-h-dvh bg-[#020812] p-0 sm:p-5">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-slate-200 sm:px-0 sm:pt-0">
          <Link href="/planet/planning/map" className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 px-3 py-2 font-semibold text-cyan-100 hover:bg-cyan-300/10">
            <ArrowLeft className="size-4" /> Back to concept atlas
          </Link>
          <span className="inline-flex items-center gap-2 text-amber-100">
            <ShieldAlert className="size-4" /> Original fictional design · Unapproved preview only
          </span>
        </div>
        <SignaturePlanetExplorer conceptPreview />
      </div>
    </main>
  );
}
