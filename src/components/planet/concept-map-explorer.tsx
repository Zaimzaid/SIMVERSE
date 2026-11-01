"use client";

import Link from "next/link";
import { useState } from "react";
import { conceptGlobeHref, conceptMapHref, resolveConceptCountrySlug } from "@/lib/planet/concept-navigation";
import { ArrowRight, Compass, Flag, Layers3 } from "lucide-react";
import { CONCEPT_COUNTRY_BOUNDARIES, countryBoundaryPath } from "@/lib/planet/concept-country-boundaries";
import {
  CONCEPT_BIOMES, CONCEPT_BIOME_COLORS, CONCEPT_ISLANDS, CONCEPT_LAKES,
  CONCEPT_MOUNTAINS, CONCEPT_RESOURCE_SITES, CONCEPT_RIVERS,
  CONCEPT_TERRAIN_STATUS, conceptIslandPath, conceptLinePath,
} from "@/lib/planet/concept-terrain";
import {
  CONCEPT_CONTINENTS, CONCEPT_COUNTRY_SITES,
  CONCEPT_MAP_STATUS, conceptContinentPath, conceptMapPoint, conceptSiteName,
} from "@/lib/planet/concept-geography";

export function ConceptMapExplorer({ initialCountrySlug }: { initialCountrySlug?: string }) {
  const [selected, setSelected] = useState(resolveConceptCountrySlug(initialCountrySlug));
  function chooseCountry(slug: string) {
    if (!CONCEPT_COUNTRY_SITES.some((site) => site.slug === slug)) return;
    setSelected(slug);
    // Keep a shareable, safe deep link without remounting the atlas and losing layer settings.
    window.history.replaceState(null, "", conceptMapHref(slug));
  }
  const [showBoundarySketches, setShowBoundarySketches] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showResources, setShowResources] = useState(false);
  const site = CONCEPT_COUNTRY_SITES.find((candidate) => candidate.slug === selected)!;
  const continent = CONCEPT_CONTINENTS.find((entry) => entry.id === site.continentId)!;
  const name = conceptSiteName(site);
  const boundary = CONCEPT_COUNTRY_BOUNDARIES.find((item) => item.slug === selected)!;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[24px] border border-cyan-200/20 bg-[#071a31]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Compass className="size-4" aria-hidden /> Planet-local concept atlas
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button"
              onClick={() => setShowBoundarySketches((current) => !current)}
              aria-pressed={showBoundarySketches}
              className="rounded-full border border-cyan-200/40 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-200/20">
              {showBoundarySketches ? "Hide draft borders" : "Show draft borders"}
            </button>
            <button type="button" onClick={() => setShowTerrain((current) => !current)}
              aria-pressed={showTerrain}
              className="rounded-full border border-cyan-200/40 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-200/20">
              {showTerrain ? "Hide terrain" : "Show terrain"}
            </button>
            <button type="button" onClick={() => setShowResources((current) => !current)}
              aria-pressed={showResources}
              className="rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-200/20">
              {showResources ? "Hide study sites" : "Show study sites"}
            </button>
            <span className="rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
              {CONCEPT_MAP_STATUS.replaceAll("_", " ").toLowerCase()}
            </span>
          </div>
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
            {CONCEPT_ISLANDS.map((island) => (
              <path key={island.id} d={conceptIslandPath(island)}
                fill={CONCEPT_CONTINENTS.find((land) => land.id === island.continentId)?.color ?? "#93b4bd"}
                fillOpacity={0.82} stroke="#c8e6e7" strokeWidth={1.25} strokeLinejoin="round" />
            ))}
            {showBoundarySketches && CONCEPT_COUNTRY_BOUNDARIES.map((country) => (
              <path
                key={country.slug}
                d={countryBoundaryPath(country)}
                fill={country.color}
                fillOpacity={country.slug === selected ? 0.86 : 0.58}
                stroke={country.slug === selected ? "#ffffff" : "#d1e5ef"}
                strokeWidth={country.slug === selected ? 3 : 1.4}
                strokeLinejoin="round"
              />
            ))}
            {showTerrain && (
              <g aria-label="Unapproved natural terrain sketch" pointerEvents="none">
                {CONCEPT_BIOMES.map((patch) => {
                  const [x, y] = conceptMapPoint(patch.center);
                  return <ellipse key={patch.id} cx={x} cy={y}
                    rx={patch.longitudeRadius * (1000 / 360)}
                    ry={patch.latitudeRadius * (500 / 180)}
                    fill={CONCEPT_BIOME_COLORS[patch.biome]} fillOpacity={0.34}
                    stroke={CONCEPT_BIOME_COLORS[patch.biome]} strokeOpacity={0.55} strokeWidth={1.4} />;
                })}
                {CONCEPT_MOUNTAINS.map((ridge) => (
                  <g key={ridge.id}>
                    <path d={conceptLinePath(ridge.points)} fill="none" stroke="#192d33" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.75} />
                    <path d={conceptLinePath(ridge.points)} fill="none" stroke="#e9d5b1" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
                  </g>
                ))}
                {CONCEPT_RIVERS.map((river) => (
                  <path key={river.id} d={conceptLinePath(river.points)}
                    fill="none" stroke="#69ddff" strokeWidth={3.8}
                    strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {CONCEPT_LAKES.map((lake) => {
                  const [x,y] = conceptMapPoint(lake.center);
                  return <ellipse key={lake.id} cx={x} cy={y}
                    rx={lake.longitudeRadius * (1000 / 360)}
                    ry={lake.latitudeRadius * (500 / 180)}
                    fill="#47c4e1" stroke="#cefaff" strokeWidth={1.4} />;
                })}
              </g>
            )}
            {showResources && CONCEPT_RESOURCE_SITES.map((resource) => {
              const [x,y] = conceptMapPoint(resource.center);
              return <g key={resource.id} pointerEvents="none">
                <circle cx={x} cy={y} r={8.5} fill="#112e43" stroke="#ffe4a0" strokeWidth={1.8} />
                <text x={x} y={y + 3} textAnchor="middle" fill="#ffebaf"
                  fontSize={8} fontWeight={700}>{resource.resource.slice(0,2)}</text>
              </g>;
            })}
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
          <span>Islands, waterways and resource surveys are proposals only</span>
                    <span>{showBoundarySketches ? "Colored shapes = unapproved country boundary sketches" : "Country dots = candidate locations"}</span>
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
                  onClick={() => chooseCountry(candidate.slug)}
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
            {showBoundarySketches ? "The colored outline is a reversible design sketch, not a published border or land claim." : "The location marker is exploratory and not a national boundary."}
            Neither view creates a capital, state, resource allocation, ownership or a playable world.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 border-y border-white/10 py-4">
            <div><dt className="text-xs text-slate-400">Draft area</dt><dd className="mt-1 font-semibold tabular-nums">{Math.round(boundary.areaKm2).toLocaleString("en-US")} km²</dd></div>
            <div><dt className="text-xs text-slate-400">Size class</dt><dd className="mt-1 font-semibold">{boundary.size.toLowerCase()}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-amber-100">Area is measured on the fictional planet from an unapproved polygon. It is not an official national size.</p>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-100">Continental terrain study</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {CONCEPT_RIVERS.find((feature) => feature.continentId === site.continentId)?.name ?? "Rivers under review"}
              {" · "}
              {CONCEPT_MOUNTAINS.find((feature) => feature.continentId === site.continentId)?.name ?? "Highlands under review"}
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-100">
              {CONCEPT_RESOURCE_SITES.filter((feature) => feature.continentId === site.continentId).length} resource study markers on this continent.
              These are not assigned to {name} or any other country.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">{CONCEPT_TERRAIN_STATUS.replaceAll("_"," ").toLowerCase()}</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={conceptGlobeHref(selected)}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-200/10">
            See {name} on the 3D concept globe <ArrowRight className="size-4" aria-hidden />
          </Link>
          </div>
          <Link href={`/planet/planning/${site.slug}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 underline-offset-4 hover:underline">
            View administrative plan <ArrowRight className="size-4" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
