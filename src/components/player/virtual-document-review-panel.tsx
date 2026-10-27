"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";

interface ReviewEntry {
  id: string; kind: string; statement: string; createdAt: string | Date;
  country: { name: string };
  identity: { username: string | null; simverseId: string; user: { displayName: string } };
}
export function VirtualDocumentReviewPanel({ initial }: { initial: ReviewEntry[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [queue, setQueue] = useState(initial);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  async function review(id: string, decision: "APPROVE" | "DENY") {
    const note = notes[id]?.trim() ?? "";
    if (note.length < 10) {
      toast({ variant: "error", title: "Review note required", description: "Provide at least ten characters explaining the decision." });
      return;
    }
    setBusyId(id);
    const { error } = await apiFetch(`/api/player-documents/reviews/${encodeURIComponent(id)}`, {
      method: "POST", body: JSON.stringify({ decision, note }),
    });
    setBusyId(null);
    if (error) {
      toast({ variant: "error", title: "Review was not saved", description: error.message });
      return;
    }
    setQueue((items) => items.filter((item) => item.id !== id));
    router.refresh();
    toast({ variant: "success", title: "Decision recorded", description: "SIMVERSE virtual application reviewed and audited." });
  }
  return <section className="space-y-4">
    {!queue.length && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">No pending applications in your authorized virtual countries.</p>}
    {queue.map((entry) => <article key={entry.id} className="rounded-2xl border border-border bg-surface p-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{entry.kind.replaceAll("_", " ")} · {entry.country.name}</p>
          <h2 className="mt-1 text-lg font-semibold">{entry.identity.user.displayName}</h2>
          <p className="text-xs text-secondary">@{entry.identity.username ?? "unset"} · {entry.identity.simverseId}</p>
        </div>
        <p className="text-xs text-muted sm:text-right">Submitted {new Date(entry.createdAt).toLocaleDateString()}</p>
      </div>
      {entry.statement ? <p className="my-3 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm text-secondary">{entry.statement}</p> : null}
      <label className="mt-3 block text-xs font-semibold text-secondary" htmlFor={`review-note-${entry.id}`}>Required decision rationale</label>
      <textarea id={`review-note-${entry.id}`} rows={3} minLength={10} maxLength={500}
        value={notes[entry.id] ?? ""} onChange={(e) => setNotes((current) => ({ ...current, [entry.id]: e.target.value }))}
        className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-accent"/>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busyId)} onClick={() => void review(entry.id, "APPROVE")}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">Approve virtual application</button>
        <button type="button" disabled={Boolean(busyId)} onClick={() => void review(entry.id, "DENY")}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Deny</button>
      </div>
    </article>)}
    <p className="text-xs text-muted">Country reviewer grants are not linked to workspace roles. You cannot review your own applications. Approvals are fictional SIMVERSE statuses only.</p>
  </section>;
}
