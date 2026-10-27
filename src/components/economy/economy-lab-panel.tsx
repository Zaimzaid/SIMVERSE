"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, Landmark, Sprout, Store, Truck, Users, BriefcaseBusiness } from "lucide-react";
import {
  BUSINESS_ACCOUNTS, ECONOMY_LAB_NOTICE, PLAYER_STOCK_COST,
  type EconomyLabState,
} from "@/lib/economy/economy-lab";

interface Lab {
  id: string; name: string; revision: number; state: EconomyLabState;
  totalSupply: number; owner: boolean; access: string; joined: boolean; myAccount: number | null;
}
interface Detail extends Lab {
  recent: Array<{ day: number; fromAccount: string; toAccount: string; amount: number; kind: string }>;
  approvedBusinesses: Array<{ id: string; name: string; sector: string }>;
  activeEmployments: Array<{ id: string; businessId: string; businessName: string; title: string }>;
}
interface Action {
  kind: "ADVANCE" | "SET_TAX" | "SET_ACCESS" | "JOIN" | "OPEN_SHOP" | "BUY_STOCK"
    | "INVEST" | "TAKE_PROFIT" | "WORK_SHIFT";
  revision: number; taxBps?: number; access?: string; businessId?: string;
  units?: number; amount?: number; employmentId?: string;
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
const card = "rounded-2xl border border-border bg-surface p-4";
const btn = "rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50";
export function EconomyLabPanel({ initialLabs, initialDetail, canCreate }: {
  initialLabs: Lab[]; initialDetail: Detail | null; canCreate: boolean;
}) {
  const [labs, setLabs] = useState(initialLabs);
  const [selected, setSelected] = useState<Detail | null>(initialDetail);
  const [name, setName] = useState("Greenfield Republic");
  const [tax, setTax] = useState(initialDetail?.state.taxBps ?? 1000);
  const [chosenBusiness, setChosenBusiness] = useState("");
  const [amount, setAmount] = useState(20);
  const [units, setUnits] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function open(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<Detail>("/api/economy-labs/" + id);
      setSelected(result); setTax(result.state.taxBps); setChosenBusiness("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open town"); }
    finally { setBusy(false); }
  }
  async function create() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<Lab>("/api/economy-labs", { name });
      setLabs((prev) => [result, ...prev]);
      const detail = await api<Detail>("/api/economy-labs/" + result.id);
      setSelected(detail); setTax(detail.state.taxBps); setChosenBusiness("");
      setMessage("Town created. Join it as a player or advance a day.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create town"); }
    finally { setBusy(false); }
  }
  async function perform(body: Action) {
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<Lab>("/api/economy-labs/" + selected.id, body);
      const latest = await api<Detail>("/api/economy-labs/" + selected.id);
      setSelected(latest); setTax(latest.state.taxBps);
      setLabs((prev) => prev.map((x) => x.id === latest.id ? latest : x));
      setMessage("Town updated successfully. Check the money and inventory changes below.");
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed. Refresh and retry."); }
    finally { setBusy(false); }
  }
  const state = selected?.state, summary = state?.summary;
  const myShops = (state?.companies ?? []).filter(c =>
    selected?.approvedBusinesses.some(b => b.id === c.businessId));
  const canOpenShop = selected?.approvedBusinesses.filter(b =>
    !(state?.companies ?? []).some(c => c.businessId === b.id)) ?? [];
  function ledgerLabel(id: string) {
    if (id === "SYSTEM_GENESIS") return "Initial allocation";
    if (id === "treasury") return "Government";
    const company = BUSINESS_ACCOUNTS.find(c => c.id === id);
    if (company) return company.name;
    if (id.startsWith("citizen-")) return "AI Citizen " + id.slice(-2);
    const shop = state?.companies?.find(c => c.accountId === id);
    if (shop) return shop.name;
    if (id.startsWith("player:")) return "Player account " + id.slice(-4);
    return id;
  }
  return <div className="space-y-5">
    <section className={card}>
      <h2 className="text-lg font-semibold">Your Economy Lab towns</h2>
      <p className="mt-1 max-w-2xl text-sm text-secondary">
        A private simulation by default. Town owners may share it with their workspace;
        workspace members can join with a career and operate approved businesses.
      </p>
      {canCreate ? <div className="mt-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="lab-name">Town name</label>
        <input id="lab-name" className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          value={name} maxLength={80} onChange={e => setName(e.target.value)}/>
        <button className={btn} disabled={busy || name.trim().length < 3 ||
          labs.filter(x => x.owner).length >= 3} onClick={() => void create()}>Create town</button>
      </div> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {labs.map(lab => <button key={lab.id} disabled={busy}
          aria-pressed={selected?.id === lab.id} onClick={() => void open(lab.id)}
          className={btn}>{lab.name} · Day {lab.state.day} · {lab.owner ? "Your town" : "Workspace town"}</button>)}
        {labs.length === 0 ? <p className="text-sm text-secondary">No visible towns. Create one if you have creator access.</p> : null}
      </div>
    </section>
    {error ? <p role="alert" className="rounded-xl border border-red-500/50 p-3 text-sm text-red-500">{error}</p> : null}
    {message ? <p role="status" className="rounded-xl border border-border p-3 text-sm text-accent">{message}</p> : null}
    {state && selected ? <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs text-secondary">{selected.access === "PRIVATE" ? "Private" : "Shared with workspace"} · Fictional GFC</p>
          <h2 className="text-2xl font-semibold">{selected.name} — Day {state.day}</h2></div>
        {selected.owner ? <button className="rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50"
          disabled={busy || state.day >= 3650}
          onClick={() => void perform({ kind: "ADVANCE", revision: selected.revision })}>Advance one day</button> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Fixed money supply", value: money(selected.totalSupply), icon: Coins },
          { label: "AI citizens", value: String(state.citizens.length), icon: Users },
          { label: "Government treasury", value: money(state.balances.treasury ?? 0), icon: Landmark },
          { label: "Completed road contracts", value: String(state.roadsBuilt), icon: Truck },
        ].map(item => <div key={item.label} className={card}>
          <item.icon className="mb-3 size-5 text-accent"/>
          <p className="text-xs text-secondary">{item.label}</p>
          <p className="mt-1 text-lg font-semibold">{item.value}</p>
        </div>)}
      </div>
      <section className={card}>
        <h3 className="text-lg font-semibold">Your life in this town</h3>
        <p className="mt-1 text-sm text-secondary">
          Choosing a SIMVERSE career unlocks one starter GFC allocation from this town's treasury.
          It never creates more total money or changes your SVC wallet.
        </p>
        {selected.joined ? <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-accent-soft p-3">
            <p className="text-xs text-secondary">Your local GFC wallet</p>
            <p className="text-2xl font-semibold">{money(selected.myAccount ?? 0)}</p>
          </div>
          <p className="text-sm text-secondary">
            {(state.participants ?? []).length} player(s) joined · {(state.companies ?? []).length} player shop(s)
          </p>
        </div> : <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy} onClick={() => void perform({ kind: "JOIN", revision: selected.revision })}>
            Join this town
          </button>
          <Link href="/profile/career" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
            Choose my career first
          </Link>
        </div>}
      </section>
      {selected.joined ? <section className={card}>
        <h3 className="flex items-center gap-2 text-lg font-semibold"><BriefcaseBusiness className="size-5 text-accent"/> Operate a business</h3>
        <p className="mt-1 text-sm text-secondary">
          Open one approved fictional company for 30 GFC of your own capital.
          Buy shop goods at {PLAYER_STOCK_COST} GFC each; AI households can buy them on future days.
        </p>
        {myShops.length === 0 ? <div className="mt-4 space-y-3">
          <label htmlFor="lab-business" className="block text-sm font-medium">Approved company</label>
          <select id="lab-business" value={chosenBusiness} onChange={e => setChosenBusiness(e.target.value)}
            className="max-w-lg rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">Select an approved company</option>
            {canOpenShop.map(b => <option key={b.id} value={b.id}>{b.name} ({b.sector})</option>)}
          </select>
          <div className="flex flex-wrap gap-3">
            <button className={btn} disabled={busy || !chosenBusiness}
              onClick={() => void perform({ kind: "OPEN_SHOP", revision: selected.revision, businessId: chosenBusiness })}>
              Open local shop · 30 GFC
            </button>
            <Link href="/profile/work" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
              Business approval and jobs
            </Link>
          </div>
          {canOpenShop.length === 0 ? <p className="text-xs text-secondary">
            No approved business is available yet. A separate authorized reviewer must approve your company.
          </p> : null}
        </div> : myShops.map(shop => <div key={shop.businessId} className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
          <h4 className="font-semibold">{shop.name}</h4>
          <p className="text-sm text-secondary">Operating cash: {money(state.balances[shop.accountId] ?? 0)} · Inventory: {shop.stock} food units</p>
          <div className="flex flex-wrap items-end gap-3">
            <div><label htmlFor="lab-units" className="block text-xs">Food units to purchase</label>
              <select id="lab-units" className="mt-1 rounded-xl border border-border bg-surface px-3 py-2"
                value={units} onChange={e => setUnits(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} units</option>)}
              </select></div>
            <button className={btn} disabled={busy}
              onClick={() => void perform({ kind: "BUY_STOCK", revision: selected.revision,
                businessId: shop.businessId, units })}>
              Buy stock · {money(units * PLAYER_STOCK_COST)}
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div><label htmlFor="lab-amount" className="block text-xs">Transfer amount (GFC)</label>
              <input id="lab-amount" type="number" min={1} max={1000} value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="mt-1 w-32 rounded-xl border border-border bg-surface px-3 py-2"/></div>
            <button className={btn} disabled={busy || amount < 1 || amount > 1000}
              onClick={() => void perform({ kind: "INVEST", revision: selected.revision,
                businessId: shop.businessId, amount })}>Invest my GFC</button>
            <button className={btn} disabled={busy || amount < 1 || amount > 1000}
              onClick={() => void perform({ kind: "TAKE_PROFIT", revision: selected.revision,
                businessId: shop.businessId, amount })}>Withdraw GFC to my local wallet</button>
          </div>
        </div>)}
        {selected.activeEmployments.filter(job =>
          (state.companies ?? []).some(c => c.businessId === job.businessId)).map(job =>
            <div key={job.id} className="mt-3 rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{job.title} at {job.businessName}</p>
              <p className="text-xs text-secondary">Your accepted virtual job is linked to an operating town company.</p>
              <button className={btn} disabled={busy} onClick={() => void perform({
                kind: "WORK_SHIFT", revision: selected.revision, employmentId: job.id,
              })}>Work shift · earn 4 GFC</button>
            </div>)}
      </section> : null}
      <section className={card}>
        <h3 className="text-lg font-semibold">Town supply chain</h3>
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
              ["Food sold", summary.sold], ["Player shop sales", summary.playerSales ?? 0],
              ["Harvested", summary.harvested], ["AI wages paid", summary.wages],
              ["Retail taxes", summary.taxes], ["Public spending", summary.publicSpending],
            ].map(([item, value]) => <div key={item} className="rounded-xl bg-background p-3">
              <p className="text-xs text-secondary">{item}</p><p className="font-semibold">{value}</p></div>)}
          </div> : <p className="mt-3 text-sm text-secondary">Advance a day to see economic activity.</p>}
        </section>
        <section className={card}>
          <h3 className="text-lg font-semibold">Town governance</h3>
          <p className="mt-1 text-sm text-secondary">Only the town creator controls these private pilot settings.</p>
          {selected.owner ? <>
            <label className="mt-4 block text-sm font-medium" htmlFor="lab-tax">Retail tax rate</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <select id="lab-tax" value={tax} onChange={e => setTax(Number(e.target.value))}
                className="rounded-xl border border-border bg-background px-3 py-2">
                {[0, 500, 1000, 1500, 2000, 2500].map(rate =>
                  <option key={rate} value={rate}>{rate / 100}%</option>)}
              </select>
              <button className={btn} disabled={busy || tax === state.taxBps}
                onClick={() => void perform({ kind: "SET_TAX", revision: selected.revision, taxBps: tax })}>Set tax</button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <p className="text-sm">Access: <strong>{selected.access === "PRIVATE" ? "Private" : "Workspace members"}</strong></p>
              <button className={btn} disabled={busy} onClick={() => void perform({
                kind: "SET_ACCESS", revision: selected.revision,
                access: selected.access === "PRIVATE" ? "WORKSPACE" : "PRIVATE",
              })}>{selected.access === "PRIVATE" ? "Share with my workspace" : "Make private"}</button>
            </div>
          </> : <p className="mt-3 text-sm">Current fictional tax: {state.taxBps / 100}%</p>}
        </section>
      </div>
      <section className={card}>
        <h3 className="text-lg font-semibold">Business account balances</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BUSINESS_ACCOUNTS.map(b => <div key={b.id} className="rounded-xl border border-border bg-background p-3">
            <p className="font-semibold text-sm">{b.name}</p>
            <p className="text-xs text-secondary">{b.activity}</p>
            <p className="mt-3 font-semibold">{money(state.balances[b.id] ?? 0)}</p>
          </div>)}
        </div>
      </section>
      <section className={card}>
        <h3 className="text-lg font-semibold">Recent money transfers</h3>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto">
          {selected.recent.map((entry, index) => <div key={index}
            className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-sm">
            <span><span className="text-secondary">Day {entry.day} · </span>
              {ledgerLabel(entry.fromAccount)} → {ledgerLabel(entry.toAccount)}
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
