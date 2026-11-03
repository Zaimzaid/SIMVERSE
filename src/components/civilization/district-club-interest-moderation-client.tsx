"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
type Review = { id: string; body: string; groupId: string; reason: string; conflict: boolean };
type Queue = { district: { name: string }; reports: Review[] };
export function DistrictClubInterestModerationClient({ initial }: { initial: Queue }) {
  const [queue, setQueue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(payload: Record<string, string>) {
    setBusy(true); setError("");
    const result = await apiFetch<{ reviewed: boolean }>("/api/civilization/club/groups/moderation", {
      method: "POST", body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!result.data) { setError(result.error?.message ?? "Moderation failed."); return; }
    const fresh = await apiFetch<Queue>("/api/civilization/club/groups/moderation");
    if (fresh.data) setQueue(fresh.data);
  }
  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="font-display text-xl font-semibold text-foreground">Interest group reports</h2>
    <p className="mt-2 text-sm text-secondary">Message reports from resident-only groups, reviewed by independent Club moderators.</p>
    {queue.reports.length === 0 ? <p className="mt-4 text-sm text-secondary">No open group-message reports.</p> :
      <ul className="mt-4 space-y-3">{queue.reports.map(item =>
        <li key={item.id} className="rounded-xl border border-border bg-background p-4">
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{item.body}</p>
          <p className="mt-2 text-xs text-secondary">Report reason: {item.reason}</p>
          {item.conflict ? <p className="mt-2 text-xs text-secondary">Independent reviewer required.</p> :
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy}
                onClick={() => void review({ action: "HIDE", reportId: item.id })}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-accent">
                Hide reported message
              </button>
              <button type="button" disabled={busy}
                onClick={() => void review({ action: "DISMISS", reportId: item.id })}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-secondary">
                Dismiss report
              </button>
            </div>}
        </li>)}</ul>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
  </section>;
}
