"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck, BriefcaseBusiness, Coins, FilePlus2, GraduationCap,
  LockKeyhole, ShieldAlert, Wallet,
} from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";

type Profession = {
  code: string; label: string; startingCredits: number; intro: string; training: string;
};
type Business = {
  id: string; name: string; sector: string; description: string;
  status: string; createdAt: string | Date;
};
type Entry = {
  id: string; kind: string; amount: number; balanceAfter: number; createdAt: string | Date;
};
export interface MyEconomyData {
  profession: (Profession & { professionCode: string; selectedAt: string | Date }) | null;
  usernameSet: boolean;
  wallet: { balance: number; currency: string; entries: Entry[] };
  businesses: Business[];
  professionOptions: readonly Profession[];
  sectorOptions: readonly string[];
  notice: string;
}
const field = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-secondary";

export function PlayerEconomyCenter({ initial }: { initial: MyEconomyData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState(initial);
  const [professionCode, setProfessionCode] = useState(data.professionOptions[0]?.code ?? "");
  const [name, setName] = useState("");
  const [sector, setSector] = useState(data.sectorOptions[0] ?? "COMMERCE");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = data.professionOptions.find((option) => option.code === professionCode);
  const balance = data.wallet.balance.toLocaleString("en-NG");

  async function chooseProfession() {
    setBusy(true);
    const { data: next, error } = await apiFetch<MyEconomyData>("/api/player-economy/profession", {
      method: "POST", body: JSON.stringify({ professionCode }),
    });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: "Profession not selected", description: error.message });
      return;
    }
    if (next) {
      setData(next);
      router.refresh();
      toast({
        variant: "success", title: "SIMVERSE career established",
        description: "Your single, nonredeemable starter-credit grant was recorded.",
      });
    }
  }

  async function createBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const { data: created, error } = await apiFetch<{ business: Business }>("/api/player-economy/businesses", {
      method: "POST",
      body: JSON.stringify({ name, sector, description }),
    });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: "Draft business not created", description: error.message });
      return;
    }
    if (created?.business) {
      setData((current) => ({
        ...current, businesses: [created.business, ...current.businesses],
      }));
      setName(""); setDescription("");
      router.refresh();
      toast({ variant: "success", title: "Virtual business draft saved",
        description: "This draft is not a registered or licensed operating business." });
    }
  }

  return <div className="space-y-6">
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-secondary">
      <p className="flex items-start gap-2 font-semibold text-amber-200">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        SIMVERSE economic identity is part of a fictional world. No real money, financial account or trading rights exist here.
      </p>
      <p className="mt-2 text-xs">{data.notice}</p>
    </div>
    {!data.usernameSet && <div className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">
      <LockKeyhole className="mr-2 inline size-4 text-accent" aria-hidden />
      Set a unique username before choosing a starter profession or drafting a business.
      <Link href="/profile" className="ml-2 font-semibold text-accent underline">Edit My Profile</Link>
    </div>}

    <div className="grid gap-4 md:grid-cols-3">
      <section className="rounded-2xl border border-border bg-surface p-5 md:col-span-2">
        <div className="flex items-center gap-2 text-accent">
          <BriefcaseBusiness className="size-5" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-widest">Personal career</p>
        </div>
        <h2 className="mt-3 text-xl font-semibold">{data.profession?.label ?? "Choose your starter profession"}</h2>
        <p className="mt-2 text-sm text-secondary">
          {data.profession?.intro ?? "Start your journey with one profession and one starting allocation. This selection is locked for the pilot."}
        </p>
        {data.profession && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-secondary">
          <span className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 font-semibold text-accent">Career selected</span>
          <span>Since {new Date(data.profession.selectedAt).toLocaleDateString()}</span>
        </div>}
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-accent">
          <Wallet className="size-5" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-widest">My SIMVERSE wallet</p>
        </div>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{balance} <span className="text-base text-secondary">SVC</span></p>
        <p className="mt-2 text-xs text-secondary">
          {data.profession ? "One-time starter credits issued" : "Select your profession to unlock your one-time starter allocation."}
        </p>
        <p className="mt-3 text-xs text-muted">Nontransferable pilot points · no deposits or withdrawals</p>
      </section>
    </div>

    {!data.profession ? <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <GraduationCap className="size-5 text-accent" aria-hidden /> Choose one SIMVERSE profession
      </h2>
      <p className="mt-1 text-sm text-secondary">Starting credits are fixed by the profession policy and can only be awarded once per player.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {data.professionOptions.map((option) => (
          <label key={option.code} className={`cursor-pointer rounded-xl border p-4 transition hover:border-accent/60 ${professionCode === option.code ? "border-accent bg-accent-soft" : "border-border bg-background"}`}>
            <input type="radio" name="profession" value={option.code} checked={professionCode === option.code}
              onChange={() => setProfessionCode(option.code)} className="sr-only" />
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs text-secondary">{option.intro}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent">
              <Coins className="size-3.5" aria-hidden /> {option.startingCredits.toLocaleString("en-NG")} SVC starter allocation
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <p className="text-sm font-semibold">Suggested orientation</p>
        <p className="mt-1 text-sm text-secondary">{selected?.training ?? "Select a profession."}</p>
        <p className="mt-2 text-xs text-muted">
          This is guidance only. It does not create qualifications, employment or a professional license.
        </p>
      </div>
      <button type="button" disabled={!data.usernameSet || !professionCode || busy}
        onClick={() => void chooseProfession()}
        className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
        {busy ? "Saving…" : "Confirm permanent pilot profession & starter credits"}
      </button>
    </section> : <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <BadgeCheck className="size-5 text-accent" aria-hidden /> Career orientation & qualifications
      </h2>
      <p className="mt-2 text-sm text-secondary">{data.profession.training}</p>
      <p className="mt-2 text-xs text-muted">
        Certification, regulated profession approval, jobs and salary payments will be separate reviewed systems.
        The starter choice never grants medical, government or business licenses.
      </p>
    </section>}

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><FilePlus2 className="size-5 text-accent" aria-hidden /> My virtual business drafts</h2>
      <p className="mt-1 text-sm text-secondary">
        Reserve a fictional company name and save your plan. These drafts cannot trade, hire or claim a legal operating license.
      </p>
      <form onSubmit={(event) => void createBusiness(event)} className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="virtual-company-name" className={label}>Company name</label>
          <input id="virtual-company-name" value={name} onChange={(event) => setName(event.target.value)}
            className={field} required minLength={3} maxLength={64} placeholder="Marina Food Systems"/>
        </div>
        <div>
          <label htmlFor="virtual-company-sector" className={label}>Industry</label>
          <select id="virtual-company-sector" className={field} value={sector}
            onChange={(event) => setSector(event.target.value)}>
            {data.sectorOptions.map((option) => <option key={option} value={option}>{option.replaceAll("_"," ")}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="virtual-company-description" className={label}>Business concept (optional)</label>
          <textarea id="virtual-company-description" rows={3} className={field} maxLength={500}
            value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what this virtual company might do…" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={!data.profession || !data.usernameSet || busy || name.trim().length < 3}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
            {busy ? "Saving…" : "Save fictional business draft"}
          </button>
        </div>
      </form>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {data.businesses.length ? data.businesses.map((business) => (
          <article key={business.id} className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-semibold">{business.name}</h3>
            <p className="mt-1 text-xs text-secondary">{business.sector} · <strong>{business.status}</strong></p>
            {business.description && <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{business.description}</p>}
          </article>
        )) : <p className="text-sm text-muted">No virtual business drafts saved yet.</p>}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">SIMVERSE credit ledger</h2>
      <p className="mt-1 text-sm text-secondary">A read-only history of controlled fictional credit allocations.</p>
      {!data.wallet.entries.length ? <p className="mt-4 text-sm text-muted">No wallet transactions recorded.</p> :
        <div className="mt-4 divide-y divide-border">
          {data.wallet.entries.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <div><p className="font-semibold">{entry.kind === "STARTER_GRANT" ? "Starter allocation" : entry.kind}</p>
              <p className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</p></div>
            <div className="text-right"><p className="font-semibold text-accent">+{entry.amount.toLocaleString("en-NG")} SVC</p>
              <p className="text-xs text-muted">Balance: {entry.balanceAfter.toLocaleString("en-NG")} SVC</p></div>
          </div>)}
        </div>}
    </section>
  </div>;
}
