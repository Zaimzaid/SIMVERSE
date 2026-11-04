"use client";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";

type Sanction = {
  id: string; kind: string; reason: string; districtName: string; isActive: boolean;
  status: string; createdAt: string; expiresAt: string;
  appeal: { id: string; status: string; reason: string;
    decisionReason: string | null; reviewedAt: string | null } | null;
};
type Safety = { sanctions: Sanction[] };

export function DistrictClubSafetyClient({ initial }: { initial: Safety }) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function appeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || busy) return;
    setBusy(true); setError(""); setNotice("");
    const response = await apiFetch<{ appealId: string }>("/api/civilization/club/safety", {
      method: "POST", body: JSON.stringify({ sanctionId: open, reason }),
    });
    setBusy(false);
    if (!response.data) { setError(response.error?.message ?? "Appeal could not be submitted."); return; }
    setOpen(null); setReason(""); setNotice("Your appeal was submitted for independent review.");
    const updated = await apiFetch<Safety>("/api/civilization/club/safety");
    if (updated.data) setData(updated.data);
  }
  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    {data.sanctions.length === 0 ? <p className="text-sm text-secondary">No Club sanctions recorded for your account.</p> :
      <ul className="space-y-4">{data.sanctions.map(item => <li key={item.id}
        className="rounded-xl border border-border bg-background p-4">
        <p className="font-semibold text-foreground">{item.kind === "BAN" ? "Temporary Club suspension" : "Temporary posting mute"}
          {" · "}{item.districtName}</p>
        <p className="mt-2 text-xs text-secondary">
          {item.isActive ? "Active until " : "Inactive · scheduled expiry "}{new Date(item.expiresAt).toLocaleString()}
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">{item.reason}</p>
        {item.appeal ? <p className="mt-3 text-sm text-secondary">
          Appeal {item.appeal.status.toLowerCase()}.
          {item.appeal.decisionReason ? " Decision: " + item.appeal.decisionReason : ""}
        </p> : <div className="mt-3">
          <button type="button" className="text-sm font-semibold text-accent"
            onClick={() => { setOpen(open === item.id ? null : item.id); setReason(""); }}>
            {open === item.id ? "Close appeal" : "Appeal this restriction"}
          </button>
          {open === item.id && <form onSubmit={appeal} className="mt-3 space-y-2">
            <label htmlFor={"club-appeal-" + item.id}
              className="block text-sm font-semibold text-secondary">Why should this be reconsidered?</label>
            <textarea id={"club-appeal-" + item.id} required minLength={20} maxLength={1000} rows={3}
              value={reason} onChange={e => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
            <button type="submit" disabled={busy || reason.trim().length < 20}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
              {busy ? "Submitting…" : "Submit appeal"}
            </button>
          </form>}
        </div>}
      </li>)}</ul>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-secondary">{notice}</p>}
  </section>;
}
