"use client";

import { useState } from "react";
import { Coins, Landmark, Sprout, Store, Truck, Users } from "lucide-react";
import {
  BUSINESS_ACCOUNTS, ECONOMY_LAB_NOTICE, type EconomyLabState,
} from "@/lib/economy/economy-lab";

interface Lab {
  id: string; name: string; revision: number; state: EconomyLabState; totalSupply: number;
}
interface Detail extends Lab {
  recent: Array<{ day: number; fromAccount: string; toAccount: string; amount: number; kind: string }>;
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
  return json.data as T;
}
function money(value: number) { return new Intl.NumberFormat("en-NG").format(value) + " GFC"; }
function label(id: string) {
  if (id === "SYSTEM_GENESIS") return "Opening allocation";
  if (id === "treasury") return "Government";
  const company = BUSINESS_ACCOUNTS.find((x) => x.id === id);
  return company?.name ?? (id.startsWith("citizen-") ? "AI Citizen " + id.slice(-2) : id);
}
const card = "rounded-2xl border border-border bg-surface p-4";
const btn = "rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50";
export function EconomyLabPanel({ initialLabs }: { initialLabs: Lab[] }) {
  const [labs, setLabs] = useState(initialLabs);
  const [selected, setSelected] = useState<Detail | null>(initialLabs[0] ? { ...initialLabs[0], recent: [] } : null);
  const [name, setName] = useState("Greenfield Republic");
  const [tax, setTax] = useState(initialLabs[0]?.state.taxBps ?? 1000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function open(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<Detail>("/api/economy-labs/" + id);
      setSelected(result);
      setTax(result.state.taxBps);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open town"); }
    finally { setBusy(false); }
  }
  async function create() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<Lab>("/api/economy-labs", { name });
      setLabs((prev) => [result, ...prev]);
      const detail = await api<Detail>("/api/economy-labs/" + result.id);
      setSelected(detail); setTax(detail.state.taxBps);
      setMessage("Your town is ready. Advance one day to begin.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create town"); }
    finally { setBusy(false); }
  }
  async function perform(body: { kind: "ADVANCE"; revision: number } |
      { kind: "SET_TAX"; revision: number; taxBps: number }) {
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<Lab>("/api/economy-labs/" + selected.id, body);
      const latest = await api<Detail>("/api/economy-labs/" + selected.id);
      setSelected(latest); setTax(latest.state.taxBps);
      setLabs((prev) => prev.map((x) => x.id === latest.id ? latest : x));
      setMessage(body.kind === "ADVANCE" ? "One simulated day completed." : "Tax policy updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  }
  const state = selected?.state, summary = state?.summary;
  return <div className="space-y-5">
    <section className={card}>
      <h2 className="text-lg font-semibold">Create your private economy</h2>
      <p className="mt-1 max-w-2xl text-sm text-secondary">
        Try a real simulated supply chain with fictional money. This is a small management prototype,
        not a complete 3D living-world game.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="lab-name">Town name</label>
        <input id="lab-name" className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          value={name} maxLength={80} onChange={(e) => setName(e.target.value)}/>
        <button className={btn} disabled={busy || name.trim().length < 3 || labs.length >= 3}
          onClick={() => void create()}>Create town</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {labs.map((lab) => <button key={lab.id} disabled={busy}
          aria-pressed={selected?.id === lab.id} onClick={() => void open(lab.id)}
          className={btn}>{lab.name} · Day {lab.state.day}</button>)}
        {labs.length === 0 ? <p className="text-sm text-secondary">No town yet. Create one above.</p> : null}
      </div>
    </section>
    {error ? <p role="alert" className="rounded-xl border border-red-500/50 p-3 text-sm text-red-500">{error}</p> : null}
    {message ? <p role="status" className="rounded-xl border border-border p-3 text-sm text-accent">{message}</p> : null}
    {state && selected ? <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs text-secondary">Private GFC economy</p>
          <h2 className="text-2xl font-semibold">{selected.name} — Day {state.day}</h2></div>
        <button className="rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50"
          disabled={busy || state.day >= 3650}
          onClick={() => void perform({ kind: "ADVANCE", revision: selected.revision })}>Advance one day</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Fixed total money", value: money(selected.totalSupply), icon: Coins },
          { label: "AI citizens", value: String(state.citizens.length), icon: Users },
          { label: "Government treasury", value: money(state.balances.treasury ?? 0), icon: Landmark },
          { label: "Road contracts completed", value: String(state.roadsBuilt), icon: Truck },
        ].map((item) => <div key={item.label} className={card}>
          <item.icon className="mb-3 size-5 text-accent"/>
          <p className="text-xs text-secondary">{item.label}</p>
          <p className="mt-1 text-lg font-semibold">{item.value}</p>
        </div>)}
      </div>
      <section className={card}>
        <h3 className="text-lg font-semibold">How the town works</h3>
        <p className="mt-1 text-sm text-secondary">The farm grows food, factories process it, the store sells it, and AI citizens buy it.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-green-500/10 p-4"><Sprout className="mb-2 size-5 text-green-600"/>
            <strong>Farm</strong><p className="text-sm text-secondary">Water {state.resources.water} · Seeds {state.resources.seeds}</p></div>
          <div className="rounded-xl border border-border p-4"><Truck className="mb-2 size-5"/>
            <strong>Processor & delivery</strong><p className="text-sm text-secondary">Flour stock {state.inventory.flour}</p></div>
          <div className="rounded-xl bg-accent-soft p-4"><Store className="mb-2 size-5 text-accent"/>
            <strong>Grocery store</strong><p className="text-sm text-secondary">Food stock {state.inventory.food}</p></div>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h3 className="text-lg font-semibold">Daily economy</h3>
          {summary ? <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              ["Food sold", summary.sold], ["Harvested", summary.harvested],
              ["Wages paid (GFC)", summary.wages], ["Unpaid wages", summary.unpaidWages],
              ["Taxes received (GFC)", summary.taxes], ["Public spending (GFC)", summary.publicSpending],
            ].map(([item, value]) => <div key={item} className="rounded-xl bg-background p-3">
              <p className="text-xs text-secondary">{item}</p>
              <p className="font-semibold">{value}</p></div>)}
          </div> : <p className="mt-3 text-sm text-secondary">Advance one day to see economic activity.</p>}
        </section>
        <section className={card}>
          <h3 className="text-lg font-semibold">Government tax policy</h3>
          <p className="mt-1 text-sm text-secondary">Adjust future retail taxes in this private sandbox.</p>
          <label className="mt-4 block text-sm font-medium" htmlFor="lab-tax">Sales tax</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <select id="lab-tax" value={tax} onChange={(e) => setTax(Number(e.target.value))}
              className="rounded-xl border border-border bg-background px-3 py-2">
              {[0, 500, 1000, 1500, 2000, 2500].map((rate) =>
                <option key={rate} value={rate}>{rate / 100}%</option>)}
            </select>
            <button className={btn} disabled={busy || tax === state.taxBps}
              onClick={() => void perform({ kind: "SET_TAX", revision: selected.revision, taxBps: tax })}>
              Apply change
            </button>
          </div>
          <p className="mt-4 text-xs text-secondary">Private demo policy only; it grants no public political office.</p>
        </section>
      </div>
      <section className={card}>
        <h3 className="text-lg font-semibold">Business account balances</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BUSINESS_ACCOUNTS.map((b) => <div key={b.id} className="rounded-xl border border-border bg-background p-3">
            <p className="font-semibold text-sm">{b.name}</p>
            <p className="text-xs text-secondary">{b.activity}</p>
            <p className="mt-3 font-semibold">{money(state.balances[b.id] ?? 0)}</p>
          </div>)}
        </div>
      </section>
      <section className={card}>
        <h3 className="text-lg font-semibold">Recent financial transfers</h3>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto">
          {selected.recent.map((entry, index) => <div key={index}
            className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-sm">
            <span><span className="text-secondary">Day {entry.day} · </span>
              {label(entry.fromAccount)} → {label(entry.toAccount)}
              <span className="ml-1 text-xs text-secondary">({entry.kind.toLowerCase().replaceAll("_", " ")})</span>
            </span>
            <strong>{money(entry.amount)}</strong>
          </div>)}
        </div>
      </section>
      <p className="text-xs text-secondary">{ECONOMY_LAB_NOTICE}</p>
    </> : null}
  </div>;
}
