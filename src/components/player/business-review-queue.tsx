"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";

interface PendingBusiness {
  id: string; name: string; sector: string; description: string; createdAt: string | Date;
  identity: { userId: string; username: string | null; user: { displayName: string } };
}
export function BusinessReviewQueue({ initial }: { initial: PendingBusiness[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);

  async function review(id: string, decision: "APPROVE" | "DENY") {
    const note = notes[id]?.trim() ?? "";
    if (note.length < 10) {
      toast({ variant: "error", title: "Review note required", description: "At least ten characters are required." });
      return;
    }
    setBusy(true);
    const { error } = await apiFetch(`/api/player-work/businesses/${id}/review`, {
      method: "POST", body: JSON.stringify({ decision, note }),
    });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: "Review refused", description: error.message });
      return;
    }
    setQueue((items) => items.filter((item) => item.id !== id));
    toast({ variant: "success", title: "SIMVERSE business reviewed", description: "The decision was recorded in the audit trail." });
    router.refresh();
  }
  return <div className="space-y-4">
    {!queue.length ? <p className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">No virtual businesses awaiting review.</p> : null}
    {queue.map((business) => <article key={business.id} className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{business.sector}</p>
      <h2 className="mt-1 text-lg font-semibold">{business.name}</h2>
      <p className="text-sm text-secondary">Submitted by {business.identity.user.displayName} (@{business.identity.username ?? "unset"})</p>
      <p className="mt-3 whitespace-pre-wrap text-sm text-secondary">{business.description || "No description provided."}</p>
      <label htmlFor={`reason-${business.id}`} className="mt-4 block text-xs text-secondary">Review rationale (required)</label>
      <textarea id={`reason-${business.id}`} rows={3} maxLength={500} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
        value={notes[business.id] ?? ""} onChange={(event) => setNotes((n) => ({ ...n, [business.id]: event.target.value }))}/>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void review(business.id, "APPROVE")}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background disabled:opacity-50">Approve in-world business</button>
        <button type="button" disabled={busy} onClick={() => void review(business.id, "DENY")}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Deny</button>
      </div>
    </article>)}
    <p className="text-xs text-muted">Review authorization is separately provisioned. Self-review is prohibited. These approvals grant only the pilot's fictional job-posting capability.</p>
  </div>;
}
