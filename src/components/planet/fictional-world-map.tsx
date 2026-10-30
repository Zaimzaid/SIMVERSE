"use client";

import { useState } from "react";
import Link from "next/link";

type Country = { name: string; capital: string; continent: string; x: number; y: number };
const countries: Country[] = [
  { name: "Valdora", capital: "Aven", continent: "Aurelia", x: 26, y: 34 },
  { name: "Novara", capital: "Novaris", continent: "Aurelia", x: 34, y: 28 },
  { name: "Arandia", capital: "Greenhaven", continent: "Ardessa", x: 18, y: 65 },
  { name: "Dravonia", capital: "Draven", continent: "Ardessa", x: 27, y: 73 },
  { name: "Marovia", capital: "Port Azure", continent: "Meridia", x: 53, y: 45 },
  { name: "Solandia", capital: "Solara", continent: "Meridia", x: 62, y: 55 },
  { name: "Vestria", capital: "Vesper", continent: "Vespera", x: 78, y: 29 },
  { name: "Altavia", capital: "Altair", continent: "Vespera", x: 84, y: 41 },
  { name: "Eldoria", capital: "Elden", continent: "Eldara", x: 73, y: 75 },
  { name: "Terranova", capital: "Newhaven", continent: "Eldara", x: 85, y: 79 },
];
const regions = [
  { name: "Aurelia", color: "#388c79", path: "M105 95 L260 60 350 115 338 205 280 240 215 200 145 225 90 160 Z" },
  { name: "Ardessa", color: "#7c9b54", path: "M95 290 L255 265 335 335 298 450 215 480 135 405 85 355 Z" },
  { name: "Meridia", color: "#b89c59", path: "M425 200 L575 175 650 245 610 360 535 385 435 315 Z" },
  { name: "Vespera", color: "#6586ac", path: "M715 75 L895 90 940 180 870 275 750 235 700 160 Z" },
  { name: "Eldara", color: "#9c7ab0", path: "M690 325 L840 300 960 365 920 475 800 500 700 435 Z" },
];
const districts = [
  { name: "Central", x: 50, y: 49, color: "#f87171", activity: "Arrival plaza and civic center" },
  { name: "Financial", x: 70, y: 46, color: "#60a5fa", activity: "Banking and commerce — planned" },
  { name: "Anything War", x: 28, y: 54, color: "#c084fc", activity: "Headquarters and arena — planned" },
  { name: "Entertainment", x: 30, y: 26, color: "#f472b6", activity: "Events and attractions — planned" },
  { name: "Residential", x: 50, y: 20, color: "#4ade80", activity: "Housing and property — planned" },
  { name: "Innovation", x: 76, y: 22, color: "#facc15", activity: "Technology and research — planned" },
  { name: "Transport", x: 48, y: 78, color: "#fb923c", activity: "Transit connections — planned" },
  { name: "Industrial", x: 77, y: 74, color: "#94a3b8", activity: "Industry and logistics — planned" },
];
type Level = "planet" | "continent" | "country" | "city";
export function FictionalWorldMap() {
  const [level, setLevel] = useState<Level>("planet");
  const [continent, setContinent] = useState("Aurelia");
  const [country, setCountry] = useState("Valdora");
  const [district, setDistrict] = useState("Central");
  const selectedCountry = countries.find((c) => c.name === country) ?? countries[0];
  const selectCountry = (item: Country) => { setContinent(item.continent); setCountry(item.name); setLevel("country"); };
  const selectedRegion = regions.find((r) => r.name === continent) ?? regions[0];
  const heading = level === "planet" ? "SIMVERSE Planet" : level === "continent" ? continent : level === "country" ? country : selectedCountry.capital;
  return <div className="min-h-dvh bg-[#051322] text-slate-100">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <Link href="/" className="text-sm text-cyan-300 hover:underline">← SIMVERSE home</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">SIMVERSE · Fictional world atlas</p><h1 className="mt-2 text-4xl font-bold">{heading}</h1><p className="mt-2 text-slate-300">Map navigation only. 3D environments and playable locations will be added in later development.</p></div>
        <span className="rounded-full border border-cyan-600 bg-cyan-950 px-4 py-2 text-sm">Geography concept · Not to scale</span>
      </div>
      <nav aria-label="World hierarchy" className="my-6 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setLevel("planet")} className="rounded bg-slate-800 px-3 py-2 hover:bg-slate-700">Planet</button><span>›</span>
        <button onClick={() => setLevel("continent")} className="rounded bg-slate-800 px-3 py-2 hover:bg-slate-700">{continent}</button><span>›</span>
        <button onClick={() => setLevel("country")} className="rounded bg-slate-800 px-3 py-2 hover:bg-slate-700">{country}</button><span>›</span>
        <button onClick={() => setLevel("city")} className="rounded bg-slate-800 px-3 py-2 hover:bg-slate-700">{selectedCountry.capital}</button>
      </nav>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="overflow-hidden rounded-2xl border border-slate-700 bg-[#09263a]">
          {level === "planet" || level === "continent" ? <svg viewBox="0 0 1000 560" role="img" aria-label="Illustrative fictional SIMVERSE continents and country locations" className="w-full">
            <defs><pattern id="ocean" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 14 Q7 7 14 14 T28 14" fill="none" stroke="#25627a" strokeOpacity=".25" strokeWidth="1"/></pattern></defs>
            <rect width="1000" height="560" fill="#0b3852"/><rect width="1000" height="560" fill="url(#ocean)"/>
            {regions.map((r) => <g key={r.name} onClick={() => { setContinent(r.name); setLevel("continent"); }} className="cursor-pointer"><path d={r.path} fill={r.color} stroke={level === "continent" && r.name === continent ? "#fff" : "#b9dfca"} strokeWidth={level === "continent" && r.name === continent ? 5 : 2} /><text x={r.name === "Aurelia" ? 205 : r.name === "Ardessa" ? 185 : r.name === "Meridia" ? 525 : r.name === "Vespera" ? 805 : 820} y={r.name === "Aurelia" ? 145 : r.name === "Ardessa" ? 370 : r.name === "Meridia" ? 290 : r.name === "Vespera" ? 145 : 410} textAnchor="middle" fill="#fff" fontSize="23" fontWeight="bold" stroke="#17354b" strokeWidth="3" paintOrder="stroke">{r.name}</text></g>)}
            {countries.filter((c) => level === "planet" || c.continent === continent).map((c) => <g key={c.name} onClick={() => selectCountry(c)} className="cursor-pointer"><circle cx={c.x * 10} cy={c.y * 5.6} r="8" fill="#ffdf79" stroke="#082033" strokeWidth="3"/><text x={c.x * 10 + 11} y={c.y * 5.6 - 9} fontSize="15" fontWeight="bold" fill="#fff" stroke="#09263a" strokeWidth="4" paintOrder="stroke">{c.name}</text></g>)}
          </svg> : level === "country" ? <div className="relative aspect-[16/10] p-8">
            <svg viewBox="0 0 800 500" className="h-full w-full" role="img" aria-label={country + " conceptual country map"}><rect width="800" height="500" fill="#103c58"/><path d={selectedRegion.path} transform="translate(45 20) scale(.75 1)" fill={selectedRegion.color} stroke="#c4f2dc" strokeWidth="3"/><path d="M120 280 Q290 100 500 220 T700 290" fill="none" stroke="#d4e3b3" strokeWidth="5" strokeDasharray="9 10"/><circle cx="380" cy="255" r="12" fill="#fcd34d"/><text x="400" y="248" fontSize="27" fill="white" fontWeight="bold">{selectedCountry.capital}</text></svg>
            <button onClick={() => setLevel("city")} className="absolute bottom-6 left-6 rounded-lg bg-cyan-500 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-400">Explore {selectedCountry.capital} →</button>
          </div> : country === "Valdora" ? <div className="relative aspect-[16/10] min-h-[350px] bg-gradient-to-br from-[#1e5360] via-[#294c58] to-[#16364a]">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(90deg, transparent 49%, #9ac8c8 50%, transparent 51%), linear-gradient(transparent 49%, #9ac8c8 50%, transparent 51%)", backgroundSize: "12% 12%" }} />
            {districts.map((d) => <button key={d.name} onClick={() => setDistrict(d.name)} style={{ left: d.x + "%", top: d.y + "%", borderColor: d.color }} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-2 py-2 text-xs font-semibold shadow-lg sm:px-4 sm:text-sm ${district === d.name ? "bg-slate-950 text-white ring-2 ring-white" : "bg-slate-900/90 text-white hover:bg-slate-800"}`}>{d.name}</button>)}
            <span className="absolute bottom-3 left-4 text-xs text-slate-200">Conceptual district layout · No surveyed boundaries</span>
          </div> : <div className="flex aspect-[16/10] items-center justify-center p-8 text-center text-slate-200">Detailed city districts for {selectedCountry.capital} are planned. Aven is the first capital with an MVP district directory.</div>}
        </section>
        <aside className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-xl font-bold">{level === "planet" ? "Continents" : level === "continent" ? "Countries" : level === "country" ? "Capital city" : "Districts"}</h2>
          <div className="mt-4 space-y-2">
            {level === "planet" && regions.map((r) => <button key={r.name} onClick={() => { setContinent(r.name); setLevel("continent"); }} className="flex w-full justify-between rounded-lg bg-slate-800 px-4 py-3 text-left hover:bg-slate-700">{r.name}<span>→</span></button>)}
            {level === "continent" && countries.filter((c) => c.continent === continent).map((c) => <button key={c.name} onClick={() => selectCountry(c)} className="flex w-full justify-between rounded-lg bg-slate-800 px-4 py-3 text-left hover:bg-slate-700"><span>{c.name}<small className="block text-slate-400">Capital: {c.capital}</small></span><span>→</span></button>)}
            {level === "country" && <button onClick={() => setLevel("city")} className="w-full rounded-lg bg-slate-800 px-4 py-3 text-left hover:bg-slate-700">{selectedCountry.capital} · Capital →</button>}
            {level === "city" && country === "Valdora" && districts.map((d) => <button key={d.name} onClick={() => setDistrict(d.name)} className={`w-full rounded-lg px-4 py-3 text-left ${district === d.name ? "bg-cyan-900 ring-1 ring-cyan-400" : "bg-slate-800 hover:bg-slate-700"}`}><span className="font-semibold">{d.name}</span><small className="mt-1 block text-slate-300">{d.activity}</small></button>)}
            {level === "city" && country !== "Valdora" && <p className="text-sm text-slate-300">District details coming later.</p>}
          </div>
          <p className="mt-6 border-t border-slate-700 pt-4 text-xs leading-relaxed text-slate-400">Illustrative geography only. Country borders, districts, roads and coordinates are conceptual; no real-world Earth dataset or 3D scene is used.</p>
        </aside>
      </div>
    </div>
  </div>;
}
