"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Venue = { id: string; name: string; zone: string; status: "preview" | "planned"; activity: string };
const venues: Venue[] = [
  { id: "arrival", name: "Arrival Plaza", zone: "Public", status: "preview", activity: "Orientation and meeting point" },
  { id: "war", name: "Anything War Headquarters", zone: "Gaming", status: "preview", activity: "Planned arena lobby, fighter inventory and AI battles" },
  { id: "homes", name: "Starter Apartments", zone: "Housing", status: "preview", activity: "Proposed property browsing and furnished interiors" },
  { id: "agent", name: "Property Agency", zone: "Housing", status: "preview", activity: "Proposed rental and purchase listings" },
  { id: "shop", name: "Convenience Store", zone: "Commerce", status: "preview", activity: "Proposed virtual item shopping" },
  { id: "bank", name: "SIMVERSE Bank", zone: "Commerce", status: "preview", activity: "Proposed wallet and transaction kiosk" },
  { id: "park", name: "Public Park", zone: "Public", status: "preview", activity: "Social gathering space" },
  { id: "transit", name: "Transport Terminal", zone: "Public", status: "preview", activity: "Proposed navigation and fast travel" },
  { id: "construction", name: "Construction Office", zone: "Housing", status: "planned", activity: "Custom home construction — future release" },
  { id: "racing", name: "Racing Stadium", zone: "Gaming", status: "planned", activity: "Racing game — future release" },
  { id: "government", name: "Government Complex", zone: "Public", status: "planned", activity: "Elections and public administration — future release" },
];
const zones = ["All", "Public", "Gaming", "Housing", "Commerce"] as const;

export default function AvenMvpPage() {
  const [zone, setZone] = useState<string>("All");
  const [selected, setSelected] = useState("war");
  const filtered = useMemo(() => venues.filter((venue) => zone === "All" || venue.zone === zone), [zone]);
  const venue = venues.find((item) => item.id === selected) ?? venues[1];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-cyan-300 hover:underline">← SIMVERSE home</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">Valdora · Aurelia · SIMVERSE</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">Aven Central District</h1>
        <p className="mt-4 max-w-3xl text-slate-300">MVP world directory — a first implementation of Aven's planned places and accessibility rules. This page is an interactive planning prototype, not a working 3D city, arena, property market, or wallet.</p>
        <div className="mt-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
          Development preview: “Preview” means a location is listed here for exploration of the MVP scope; it does not mean its gameplay or interior has been built. “Coming later” means excluded from MVP 1.0.
        </div>
        <div className="mt-8 flex flex-wrap gap-2" aria-label="Filter venues by zone">
          {zones.map((item) => <button key={item} type="button" onClick={() => setZone(item)} aria-pressed={zone === item} className={`rounded-full border px-4 py-2 text-sm transition ${zone === item ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-slate-700 text-slate-300 hover:border-slate-400"}`}>{item}</button>)}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section aria-label="Aven venue directory" className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item.id)} className={`rounded-xl border p-5 text-left transition hover:border-cyan-500 ${selected === item.id ? "border-cyan-400 bg-slate-800" : "border-slate-800 bg-slate-900"}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs uppercase tracking-wide text-slate-400">{item.zone}</span><span className={`rounded px-2 py-1 text-xs ${item.status === "preview" ? "bg-cyan-900 text-cyan-200" : "bg-slate-700 text-slate-300"}`}>{item.status === "preview" ? "MVP candidate" : "Coming later"}</span></div>
              <h2 className="mt-4 text-lg font-semibold">{item.name}</h2>
              <p className="mt-2 text-sm text-slate-400">{item.activity}</p>
            </button>)}
          </section>
          <aside className="h-fit rounded-2xl border border-slate-700 bg-slate-900 p-6" aria-live="polite">
            <p className="text-xs uppercase tracking-[.2em] text-cyan-300">Selected destination</p>
            <h2 className="mt-3 text-2xl font-bold">{venue.name}</h2>
            <p className="mt-2 text-slate-300">{venue.activity}</p>
            <dl className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-400">Zone</dt><dd>{venue.zone}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Implementation</dt><dd>{venue.status === "preview" ? "Proposed for MVP" : "Deferred"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Enter building</dt><dd>Not implemented</dd></div></dl>
            <div className="mt-8 rounded-lg bg-slate-800 p-4 text-sm text-slate-300">Next engineering step: connect this destination to an authenticated player session, an actual scene entrance and authoritative backend actions.</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
