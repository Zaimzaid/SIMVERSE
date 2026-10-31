"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Compass, Flag, Layers3 } from "lucide-react";
import {
  CONCEPT_CONTINENTS, CONCEPT_COUNTRY_SITES,
  CONCEPT_MAP_STATUS, conceptContinentPath, conceptMapPoint, conceptSiteName,
} from "@/lib/planet/concept-geography";

export function ConceptMapExplorer() {
  const [selected, setSelected] = useState(CONCEPT_COUNTRY_SITES[0]!.slug);
  const site = CONCEPT_COUNTRY_SITES.find((candidate) => candidate.slug === selected)!;
  const continent = CONCEPT_CONTINENTS.find((entry) => entry.id === site.continentId)!;
  const name = conceptSiteName(site);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[24px] border border-cyan-200/20 bg-[#071a31]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Compass className="size-4" aria-hidden /> Planet-local concept atlas
          </div>
          <span className="rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
            {CONCEPT_MAP_STATUS.replaceAll("_", " ").toLowerCase()}
          </span>
        </div>
        <div className="p-2 sm:p-4">
          <svg
            viewBox="0 0 1000 500"
            className="w-full"
            role="img"
            aria-label="An original five-continent fictional planet concept with ten candidate country markers; this is not published territory."
          >
            <defs>
              <radialGradient id="concept-sea">
                <stop offset="0" stopColor="#17426a" />
                <stop offset="1" stopColor="#061a32" />
              </radialGradient>
              <pattern id="concept-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M100 0H0V100" fill="none" stroke="#8ebdd5" strokeWidth="0.65" opacity="0.14" />
              </pattern>
            </defs>
            <rect width="1000" height="500" rx="14" fill="url(#concept-sea)" />
            <rect width="1000" height="500" fill="url(#concept-grid)" />
            {CONCEPT_CONTINENTS.map((land) => (
              <path
                key={land.id}
                d={conceptContinentPath(land)}
                fill={land.color}
                fillOpacity={land.id === continent.id ? 0.87 : 0.7}
                stroke={land.id === continent.id ? "#e0f8ff" : "#b5d8dd"}
                strokeWidth={land.id === continent.id ? 2.2 : 1.4}
                strokeLinejoin="round"
              />
            ))}
            {CONCEPT_COUNTRY_SITES.map((candidate) => {
              const [x, y] = conceptMapPoint(candidate.center);
              const active = candidate.slug === selected;
              return (
                <g key={candidate.slug}>
                  {active && <circle cx={x} cy={y} r={15} fill="none" stroke="#e9faff" strokeWidth="1.5" opacity="0.75" />}
                  <circle cx={x} cy={y} r={active ? 7.5 : 5.5} fill={active ? "#ffffff" : "#b8f2ff"} stroke="#062039" strokeWidth="2" />
                  <text x={x} y={y - 16} fill="#ffffff" textAnchor="middle" fontSize="12"
                    paintOrder="stroke" stroke="#0a2138" strokeWidth="3.5" fontWeight={active ? "bold" : "normal"}>
                    {conceptSiteName(candidate)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-xs text-slate-300 sm:px-6">
          <span>Five proposed landmasses · Original fictional geometry</span>
          <span>Country dots = possible sites, not sovereign borders</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
        <section className="rounded-2xl border border-cyan-200/15 bg-[#0b223b] p-4 sm:p-6" aria-labelledby="candidate-places">
          <h2 id="candidate-places" className="flex items-center gap-2 text-lg font-semibold">
            <Flag className="size-5 text-cyan-200" aria-hidden /> Candidate country locations
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Select a name to highlight its possible location. These are only first-design suggestions.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {CONCEPT_COUNTRY_SITES.map((candidate) => {
              const active = selected === candidate.slug;
              return (
                <button
                  key={candidate.slug}
                  type="button"
                  onClick={() => setSelected(candidate.slug)}
                  aria-pressed={active}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${active
                    ? "border-cyan-200 bg-cyan-200/15 text-white"
                    : "border-white/10 bg-[#071a31] text-slate-300 hover:border-cyan-200/40 hover:text-white"}`}
                >
                  {conceptSiteName(candidate)}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-2xl border border-cyan-200/20 bg-[#0b223b] p-5">
          <div className="flex items-center gap-2 text-cyan-200">
            <Layers3 className="size-4" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-[0.15em]">Selected concept</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold">{name}</h2>
          <p className="mt-2 text-sm text-slate-300">
            {continent.label} — proposed siting only
          </p>
          <p className="mt-3 text-xs leading-6 text-slate-400">
            The dot does not define a national boundary, capital, state, resources,
            ownership or a playable world. The country still needs original
            reviewed border geometry and official publication.
          </p>
          <Link href={`/planet/planning/${site.slug}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 underline-offset-4 hover:underline">
            View administrative plan <ArrowRight className="size-4" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
