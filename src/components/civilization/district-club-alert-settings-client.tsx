"use client";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";
type Preferences = {
  chatAlerts: boolean; eventAlerts: boolean;
  quietStartHourUtc: number | null; quietEndHourUtc: number | null;
  capabilities: { sseInvalidation: boolean; browserPush: boolean; email: boolean };
};
export function DistrictClubAlertSettingsClient() {
  const [data, setData] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    void apiFetch<Preferences>("/api/civilization/club/alerts").then(r => {
      if (!alive) return;
      if (r.data) setData(r.data); else setError(r.error?.message ?? "Preferences unavailable.");
    });
    return () => { alive = false; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true); setError(""); setNotice("");
    const r = await apiFetch<{ saved: boolean }>("/api/civilization/club/alerts", {
      method: "PATCH", body: JSON.stringify({
        chatAlerts: data.chatAlerts, eventAlerts: data.eventAlerts,
        quietStartHourUtc: data.quietStartHourUtc,
        quietEndHourUtc: data.quietEndHourUtc,
      }),
    });
    setBusy(false);
    if (!r.data) setError(r.error?.message ?? "Couldn't save preferences.");
    else setNotice("Your in-app notification preferences were saved.");
  }
  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="font-display text-xl font-semibold text-foreground">Notification preferences</h2>
    <p className="mt-2 text-sm leading-6 text-secondary">
      Control in-app Club update alerts. External phone push and email aren't configured yet;
      these settings won't enable background delivery.
    </p>
    {data && <form onSubmit={save} className="mt-4 space-y-3">
      <label className="flex items-center gap-3 text-sm text-foreground">
        <input type="checkbox" checked={data.chatAlerts}
          onChange={e => setData({ ...data, chatAlerts: e.target.checked })} />
        Room message alerts
      </label>
      <label className="flex items-center gap-3 text-sm text-foreground">
        <input type="checkbox" checked={data.eventAlerts}
          onChange={e => setData({ ...data, eventAlerts: e.target.checked })} />
        Approved event alerts
      </label>
      <p className="text-xs text-secondary">Quiet hours (optional, UTC; applies to attention alerts, not message history).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["quietStartHourUtc", "quietEndHourUtc"] as const).map(field =>
          <label key={field} className="text-xs text-secondary">
            {field === "quietStartHourUtc" ? "Quiet from" : "Quiet until"}
            <select className="mt-1 block w-full rounded-lg border border-border bg-background p-2"
              value={data[field] ?? ""} onChange={e => setData({
                ...data, [field]: e.target.value ? Number(e.target.value) : null,
              })}>
              <option value="">Disabled</option>
              {Array.from({ length: 24 }, (_, hour) =>
                <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00 UTC</option>)}
            </select>
          </label>)}
      </div>
      <button disabled={busy} type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
        Save notifications
      </button>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-secondary">{notice}</p>}
  </section>;
}
