"use client";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";
type GrantRoster = { districtName: string; grants: {
  userId: string; name: string; active: boolean; since: string;
}[] };
export function DistrictClubStewardClient() {
  const [districtId, setDistrictId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState("");
  const [roster, setRoster] = useState<GrantRoster | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function fetchRoster() {
    setError("");
    const response = await apiFetch<GrantRoster>(
      "/api/civilization/club/operations/staff?districtId=" + encodeURIComponent(districtId));
    if (response.data) setRoster(response.data);
    else setError(response.error?.message ?? "Staff list unavailable.");
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const response = await apiFetch<{ active: boolean }>(
      "/api/civilization/club/safety/stewards", {
        method: "POST", body: JSON.stringify({ districtId, targetUserId, active, reason }),
      });
    setBusy(false);
    if (!response.data) { setError(response.error?.message ?? "Grant update failed."); return; }
    setNotice(response.data.active ? "Moderator assigned." : "Moderator grant revoked.");
    await fetchRoster();
  }
  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="font-display text-xl font-semibold text-foreground">Club moderator provisioning</h2>
    <p className="mt-2 text-sm text-secondary">
      Platform publishing stewards only. A staff grant does not authorize an Assembly vote or virtual construction.
    </p>
    <form onSubmit={update} className="mt-4 space-y-3">
      <label className="block text-sm text-secondary">Approved district ID
        <input required value={districtId} onChange={e => setDistrictId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground" />
      </label>
      <label className="block text-sm text-secondary">Approved resident's account ID
        <input required value={targetUserId} onChange={e => setTargetUserId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground" />
      </label>
      <label className="block text-sm text-secondary">Grant action
        <select value={String(active)} onChange={e => setActive(e.target.value === "true")}
          className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground">
          <option value="true">Assign moderation role</option>
          <option value="false">Revoke moderation role</option>
        </select>
      </label>
      <label className="block text-sm text-secondary">Reason
        <textarea required minLength={10} maxLength={350} value={reason}
          onChange={e => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground" />
      </label>
      <button type="submit" disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
        Save staff assignment
      </button>
      <button type="button" disabled={busy || !districtId}
        onClick={() => void fetchRoster()}
        className="ml-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-accent">
        View moderators
      </button>
    </form>
    {roster && <ul className="mt-4 space-y-2">{roster.grants.map(g =>
      <li key={g.userId} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
        {g.name} · {g.active ? "active" : "inactive"} · {g.userId}
      </li>)}</ul>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-secondary">{notice}</p>}
  </section>;
}
