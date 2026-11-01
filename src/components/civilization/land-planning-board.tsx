"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type Area = {
  id: string; name: string; kind: string; zone: string;
  x: number; y: number; width: number; height: number;
};
type LandPlan = {
  district: { id: string; name: string };
  plan: { id: string; status: string; revision: number; areas: Area[] } | null;
  protectedPercent: number; realLandActivated: false; constructionAllowed: false;
};
const examples: Area[] = [
  { id: "demo-eco", name: "Protected forest (example)", kind: "PROTECTED", zone: "ECOLOGICAL",
    x: 500, y: 600, width: 3000, height: 2400 },
  { id: "demo-road", name: "Reserved mobility corridor (example)", kind: "PROTECTED", zone: "CORRIDOR",
    x: 4000, y: 0, width: 950, height: 10000 },
  { id: "demo-civic", name: "Public square (example)", kind: "PUBLIC_RESERVE", zone: "CIVIC",
    x: 5400, y: 1000, width: 3300, height: 2500 },
  { id: "demo-mixed", name: "Mixed-use block (example)", kind: "DEVELOPMENT", zone: "MIXED_USE",
    x: 5300, y: 4300, width: 3100, height: 3400 },
];
const styles: Record<string,string> = {
  PROTECTED: "border-emerald-500/70 bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
  PUBLIC_RESERVE: "border-sky-500/70 bg-sky-500/20 text-sky-900 dark:text-sky-100",
  DEVELOPMENT: "border-amber-500/70 bg-amber-500/20 text-amber-900 dark:text-amber-100",
};

export function LandPlanningBoard({ initial }: { initial: LandPlan | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"PROTECTED" | "PUBLIC_RESERVE" | "DEVELOPMENT">("PROTECTED");
  const [zone, setZone] = useState("ECOLOGICAL");
  const [x, setX] = useState(500);
  const [y, setY] = useState(500);
  const [width, setWidth] = useState(2000);
  const [height, setHeight] = useState(2000);
  const areas = initial?.plan?.areas ?? examples;
  const preview = !initial;

  async function send(payload: object) {
    setBusy(true); setMessage(null);
    const r = await apiFetch("/api/civilization/land", {
      method: "POST", body: JSON.stringify(payload),
    });
    setBusy(false);
    if (r.error) { setMessage(r.error.message); return false; }
    setMessage("Saved as a schematic planning draft. No real land was activated.");
    router.refresh();
    return true;
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!initial) return;
    const ok = await send({ action: "ADD_AREA", districtId: initial.district.id,
      name, kind, zone, x, y, width, height });
    if (ok) setName("");
  }
  function chooseKind(value: "PROTECTED" | "PUBLIC_RESERVE" | "DEVELOPMENT") {
    setKind(value);
    setZone(value === "PROTECTED" ? "ECOLOGICAL" : value === "PUBLIC_RESERVE" ? "CIVIC" : "RESIDENTIAL");
  }
  const zoneOptions = kind === "PROTECTED" ? ["ECOLOGICAL","CORRIDOR"]
    : kind === "PUBLIC_RESERVE" ? ["CIVIC"] : ["RESIDENTIAL","COMMERCIAL","MIXED_USE"];
  return <div className="space-y-6">
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{initial?.district.name ?? "Example district"}</h2>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-secondary">
          {preview ? "Example only — no district active" : "Schematic draft — not a real map"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-secondary">
        All positions use a normalized 0–10,000 planning grid. They do not represent surveyed
        parcels, geographic coordinates, land ownership or construction permissions.
      </p>
      <div className="mx-auto mt-6 w-full max-w-xl">
        <div role="img" aria-label={preview
          ? "Illustrative land planning board with example protected forest, mobility corridor, public square and mixed-use block"
          : "Schematic board showing draft district planning areas"}
          className="relative aspect-square overflow-hidden rounded-xl border-2 border-border bg-background"
          style={{ backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "10% 10%" }}>
          {areas.map((a) => <div key={a.id}
            className={`absolute flex items-center justify-center overflow-hidden border-2 p-1 text-center text-[10px] font-semibold leading-tight sm:text-xs ${styles[a.kind] ?? "border-border bg-surface text-foreground"}`}
            style={{ left: `${a.x / 100}%`, top: `${a.y / 100}%`,
              width: `${a.width / 100}%`, height: `${a.height / 100}%` }}
            title={`${a.name} · ${a.zone} · schematic only`}>
            <span className="line-clamp-3">{a.name}</span>
          </div>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-secondary">
          <span>🟢 Protected</span><span>🔵 Public reserve</span><span>🟠 Development</span>
        </div>
      </div>
      {!preview && <p className="mt-4 text-sm text-secondary">
        Draft revision {initial.plan?.revision ?? 0} · Protected planning coverage: {initial.protectedPercent.toFixed(1)}%.
        Nothing here can be sold, occupied or spent on.
      </p>}
    </section>
    {initial && <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      {!initial.plan ? <>
        <h2 className="text-lg font-semibold text-foreground">Start a schematic plan</h2>
        <p className="mt-2 text-sm text-secondary">
          This creates only a draft diagram. Official zoning requires approved Phase 2 geography.
        </p>
        <button type="button" disabled={busy} onClick={() => send({
          action: "CREATE_DRAFT", districtId: initial.district.id,
        })} className="mt-4 min-h-11 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
          Create schematic draft
        </button>
      </> : <>
        <h2 className="text-lg font-semibold text-foreground">Add a non-overlapping planning area</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Protected zones and public reserves cannot be overwritten or converted through this interface.
          No delete, land-sale or publication control is available.
        </p>
        <form onSubmit={add} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="land-name" className="block text-sm font-semibold">Area name</label>
            <input required minLength={3} maxLength={80} value={name} onChange={(e)=>setName(e.target.value)}
              id="land-name" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></div>
          <div><label htmlFor="land-kind" className="block text-sm font-semibold">Designation</label>
            <select id="land-kind" value={kind} onChange={(e)=>chooseKind(e.target.value as typeof kind)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
              <option value="PROTECTED">Protected</option><option value="PUBLIC_RESERVE">Public reserve</option>
              <option value="DEVELOPMENT">Future development</option>
            </select></div>
          <div><label htmlFor="land-zone" className="block text-sm font-semibold">Planning zone</label>
            <select id="land-zone" value={zone} onChange={(e)=>setZone(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
              {zoneOptions.map(z=><option key={z} value={z}>{z.replaceAll("_"," ").toLowerCase()}</option>)}
            </select></div>
          {([
            ["X coordinate", x, setX], ["Y coordinate", y, setY],
            ["Width", width, setWidth], ["Height", height, setHeight],
          ] as const).map(([label,value,set])=><div key={label}>
            <label htmlFor={`land-${label.replaceAll(" ","-")}`} className="block text-sm font-semibold">{label}</label>
            <input id={`land-${label.replaceAll(" ","-")}`} type="number" min={label==="Width"||label==="Height"?100:0}
              max={10000} step={100} value={value} onChange={(e)=>set(Number(e.target.value))}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
          </div>)}
          <button disabled={busy} type="submit"
            className="min-h-11 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50 sm:col-span-2">
            Add planning area
          </button>
        </form>
      </>}
      {message && <p role="status" className="mt-4 rounded-xl border border-border p-3 text-sm text-foreground">{message}</p>}
    </section>}
  </div>;
}
