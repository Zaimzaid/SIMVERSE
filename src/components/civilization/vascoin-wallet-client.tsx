"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type Overview = {
  currency: "VC"; balance: number; dailyReward: number;
  dailyClaimsEnabled: boolean; claimedToday: boolean;
  districtContributionsEnabled: boolean;
  district: { id: string; name: string; treasuryBalance: number } | null;
  recentEntries: { id: string; kind: string; amount: number; direction: "IN" | "OUT"; createdAt: Date | string }[];
  notice: string; availableForConstruction: false;
};
const number = new Intl.NumberFormat("en-NG");

export function VascoinWalletClient({ initial }: { initial: Overview }) {
  const router = useRouter();
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function claim() {
    setBusy(true);
    setMessage(null);
    const result = await apiFetch("/api/civilization/vascoin/claim", { method: "POST" });
    setBusy(false);
    if (result.error) { setSuccess(false); setMessage(result.error.message); return; }
    setSuccess(true);
    setMessage("Daily virtual Vascoin reward recorded in your wallet.");
    router.refresh();
  }

  async function contribute() {
    if (!Number.isInteger(amount) || amount < 1 || amount > 500) {
      setSuccess(false); setMessage("Enter a whole amount between 1 and 500 VC."); return;
    }
    setBusy(true);
    setMessage(null);
    const result = await apiFetch("/api/civilization/vascoin/contribute", {
      method: "POST",
      body: JSON.stringify({ amount, requestId: crypto.randomUUID() }),
    });
    setBusy(false);
    if (result.error) { setSuccess(false); setMessage(result.error.message); return; }
    setSuccess(true);
    setMessage("Virtual contribution recorded in your district treasury. This does not authorize construction.");
    router.refresh();
  }

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold text-secondary">My Vascoin balance</p>
        <p className="mt-3 font-display text-4xl font-bold tabular-nums text-foreground">
          {number.format(initial.balance)} <span className="text-xl text-accent">VC</span>
        </p>
        <p className="mt-3 text-sm leading-6 text-secondary">Earned and contributed virtual game credits. No cash value or redemption.</p>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold text-secondary">Daily check-in reward</p>
        <p className="mt-3 text-2xl font-bold text-foreground">+{initial.dailyReward} VC</p>
        <button type="button" onClick={claim}
          disabled={busy || !initial.dailyClaimsEnabled || initial.claimedToday}
          className="mt-4 min-h-11 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {initial.claimedToday ? "Already claimed today" : "Claim daily Vascoin"}
        </button>
        <p className="mt-3 text-sm leading-6 text-secondary">
          {!initial.dailyClaimsEnabled ? "Daily check-ins are locked until the pilot operator enables rewards."
            : initial.claimedToday ? "Your next check-in is available on the next UTC calendar day."
              : "One verified claim per UTC day. No game score can create credits through this button."}
        </p>
      </section>
    </div>

    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-xl font-semibold text-foreground">My district treasury</h2>
      {initial.district ? <>
        <p className="mt-2 text-sm text-secondary">{initial.district.name}</p>
        <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
          {number.format(initial.district.treasuryBalance)} VC
        </p>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Treasury balance is reserved for future staff-reviewed proposals. Nothing can be spent on buildings yet.
          A contribution is an in-game transfer, not a donation or a promise to construct something.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="vascoin-contribution" className="block text-sm font-semibold text-foreground">
              Contribute virtual VC
            </label>
            <input id="vascoin-contribution" type="number" min={1} max={500} step={1}
              value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-2 h-11 w-36 rounded-xl border border-border bg-background px-3 text-sm text-foreground" />
          </div>
          <button type="button" onClick={contribute}
            disabled={busy || !initial.districtContributionsEnabled || amount < 1 || amount > 500 || initial.balance < amount}
            className="min-h-11 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50">
            Contribute to district
          </button>
        </div>
        {!initial.districtContributionsEnabled && <p className="mt-3 text-sm text-secondary">
          Contributions are closed until the approved district economy pilot is activated.
        </p>}
      </> : <p className="mt-3 text-sm leading-7 text-secondary">
        You do not yet have an active, independently approved home district.
        Treasury contributions will appear after geography, citizenship and residence are activated.
      </p>}
    </section>

    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-xl font-semibold text-foreground">Recent wallet transactions</h2>
      {!initial.recentEntries.length
        ? <p className="mt-3 text-sm text-secondary">No virtual transactions recorded yet.</p>
        : <ol className="mt-4 divide-y divide-border">
          {initial.recentEntries.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {entry.kind === "DAILY_CLAIM" ? "Daily check-in" : "District contribution"}
              </p>
              <p className="mt-1 text-xs text-secondary">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
            <p className="font-semibold tabular-nums text-foreground">
              {entry.direction === "IN" ? "+" : "−"}{number.format(entry.amount)} VC
            </p>
          </li>)}
        </ol>}
    </section>

    <p className="rounded-xl border border-border bg-background p-4 text-sm leading-7 text-secondary">
      {initial.notice}
    </p>
    {message && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${success
      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
      : "border-rose-500/40 text-rose-700 dark:text-rose-300"}`}>{message}</p>}
  </div>;
}
