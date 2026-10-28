"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";

interface PendingVisa {
  id: string; purpose: string; submittedAt: Date | string;
  originCountry: { name: string }; destinationCountry: { name: string };
  identity: { username: string | null; simverseId: string;
    user: { displayName: string } };
}

export function PlayerTravelReviewPanel({ initial }: { initial: PendingVisa[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [applications, setApplications] = useState(initial);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function decide(id: string, decision: "APPROVE" | "DENY") {
    const note = notes[id]?.trim() ?? "";
    if (note.length < 10) {
      toast({ variant: "error", title: "Review note required", description: "Use at least 10 characters." });
      return;
    }
    setBusy(id);
    const { error } = await apiFetch(`/api/player-travel/reviews/${encodeURIComponent(id)}`, {
      method: "POST", body: JSON.stringify({ decision, note }),
    });
    setBusy(null);
    if (error) {
      toast({ variant: "error", title: "Visa review not saved", description: error.message });
      return;
    }
    setApplications((rows) => rows.filter((row) => row.id !== id));
    toast({ variant: "success", title: "SIMVERSE virtual travel visa reviewed", description: decision === "APPROVE" ? "Fictional entry visa issued." : "Application denied." });
    router.refresh();
  }
  return <section className="space-y-4">
    {!applications.length && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">No pending virtual visas in your authorized countries.</p>}
    {applications.map((application) => <article key={application.id} className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">SIMVERSE-only entry visa</p>
      <h2 className="mt-1 text-lg font-semibold">{application.originCountry.name} → {application.destinationCountry.name}</h2>
      <p className="text-sm text-secondary">{application.identity.user.displayName} (@{application.identity.username ?? "unset"})</p>
      <p className="mt-1 text-xs text-muted">Submitted {new Date(application.submittedAt).toLocaleDateString()}</p>
      {application.purpose ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm text-secondary">{application.purpose}</p> : null}
      <label className="mt-3 block text-xs font-semibold text-secondary" htmlFor={`travel-note-${application.id}`}>Review rationale (10–500 characters)</label>
      <textarea id={`travel-note-${application.id}`} rows={3} minLength={10} maxLength={500}
        className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
        value={notes[application.id] ?? ""} onChange={(e) => setNotes((notes) => ({ ...notes, [application.id]: e.target.value }))}/>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy !== null} onClick={() => void decide(application.id, "APPROVE")}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background disabled:opacity-50">Approve virtual visa</button>
        <button type="button" disabled={busy !== null} onClick={() => void decide(application.id, "DENY")}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Deny</button>
      </div>
    </article>)}
    <p className="text-xs text-secondary">Approval requires an active country reviewer grant and current, valid SIMVERSE document prerequisites. No real visa is issued.</p>
  </section>;
}
