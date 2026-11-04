"use client";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";
type Appeal = { id: string; reason: string; authorDisplayName: string; kind: string;
  sanctionReason: string; expiresAt: string; conflict: boolean };
type Sanction = { id: string; kind: string; reason: string;
  targetDisplayName: string; expiresAt: string; ownDecision: boolean };
type Queue = { district: { id: string; name: string }; overview: {
  messages: number; openReports: number; publishedEvents: number;
  activeRestrictions: number; pendingAppeals: number;
}; appeals: Appeal[]; sanctions: Sanction[] };
export function DistrictClubSafetyModerationClient({ initial }: { initial: Queue }) {
  const [queue, setQueue] = useState(initial);
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState("MUTE");
  const [duration, setDuration] = useState(12);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(input: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    const result = await apiFetch<Record<string, unknown>>(
      "/api/civilization/club/safety/moderation", {
        method: "POST", body: JSON.stringify(input),
      });
    setBusy(false);
    if (!result.data) { setError(result.error?.message ?? "Could not save this safety decision."); return false; }
    const refreshed = await apiFetch<Queue>("/api/civilization/club/safety/moderation");
    if (refreshed.data) setQueue(refreshed.data);
    setNotice("Decision saved and audited.");
    return true;
  }
  async function createSanction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await submit({ action: "SANCTION", targetUserId: target, kind,
      durationHours: duration, reason })) { setTarget(""); setReason(""); }
  }
  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="font-display text-xl font-semibold text-foreground">Safety and moderation operations</h2>
    <p className="mt-2 text-sm text-secondary">District: {queue.district.name}. Restrictions are temporary and audited;
      appeals require another moderator to review the original issuer's action.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {Object.entries(queue.overview).map(([key, count]) => <p key={key}
        className="rounded-lg border border-border p-3 text-sm text-secondary">
        {key.replaceAll(/([A-Z])/g, " $1")}: <strong className="text-foreground">{count}</strong>
      </p>)}
    </div>
    <form onSubmit={createSanction} className="mt-6 space-y-3 rounded-xl border border-border bg-background p-4">
      <h3 className="font-semibold text-foreground">Restrict disruptive behavior</h3>
      <p className="text-xs text-secondary">Enter the reported player's ID from the private message report queue above.
        Never use this for a development vote or civic disagreement.</p>
      <label className="block text-sm text-secondary">Resident account ID
        <input value={target} onChange={e => setTarget(e.target.value)} required
          className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-secondary">Action
          <select value={kind} onChange={e => setKind(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground">
            <option value="MUTE">Temporary posting mute</option>
            <option value="BAN">Temporary Club suspension</option>
          </select>
        </label>
        <label className="block text-sm text-secondary">Hours (1–720)
          <input type="number" min={1} max={720} value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
        </label>
      </div>
      <label className="block text-sm text-secondary">Specific moderation reason
        <textarea required minLength={15} maxLength={500} rows={2} value={reason}
          onChange={e => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
        Issue restriction
      </button>
    </form>
    <h3 className="mt-6 font-semibold text-foreground">Open appeals</h3>
    {queue.appeals.length === 0 ? <p className="mt-2 text-sm text-secondary">No appeals awaiting review.</p> :
      <ul className="mt-3 space-y-3">{queue.appeals.map(item =>
        <li key={item.id} className="rounded-xl border border-border bg-background p-4">
          <p className="font-semibold text-foreground">{item.authorDisplayName} · {item.kind}</p>
          <p className="mt-2 text-sm text-secondary">Original reason: {item.sanctionReason}</p>
          <p className="mt-2 text-sm text-secondary">Appeal: {item.reason}</p>
          {item.conflict ? <p className="mt-2 text-xs text-secondary">Another moderator must review this appeal.</p> :
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => {
                const reason = window.prompt("Explain why you are upholding this action:");
                if (reason && reason.trim().length >= 15) void submit({ action: "DECIDE_APPEAL",
                  appealId: item.id, decision: "UPHOLD", reason });
              }} className="rounded-lg border border-border px-3 py-2 text-sm text-accent">Uphold</button>
              <button type="button" disabled={busy} onClick={() => {
                const reason = window.prompt("Explain why the action should be overturned:");
                if (reason && reason.trim().length >= 15) void submit({ action: "DECIDE_APPEAL",
                  appealId: item.id, decision: "OVERTURN", reason });
              }} className="rounded-lg border border-border px-3 py-2 text-sm text-accent">Overturn</button>
            </div>}
        </li>)}</ul>}
    <h3 className="mt-6 font-semibold text-foreground">Current restrictions</h3>
    {queue.sanctions.length === 0 ? <p className="mt-2 text-sm text-secondary">No active restrictions.</p> :
      <ul className="mt-3 space-y-3">{queue.sanctions.map(item =>
        <li key={item.id} className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-foreground">{item.targetDisplayName} · {item.kind}</p>
          <p className="mt-2 text-xs text-secondary">{item.reason} · Expires {new Date(item.expiresAt).toLocaleString()}</p>
          {!item.ownDecision && <button type="button" disabled={busy}
            onClick={() => {
              const reason = window.prompt("Reason for independent revocation:");
              if (reason && reason.trim().length >= 10) void submit({ action: "REVOKE",
                sanctionId: item.id, reason });
            }} className="mt-2 text-sm font-semibold text-accent">Revoke after review</button>}
        </li>)}</ul>}
    {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-secondary">{notice}</p>}
  </section>;
}
