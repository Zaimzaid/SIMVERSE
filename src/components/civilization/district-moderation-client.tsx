"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type ReviewQueue = {
  proposals: { id: string; title: string; description: string }[];
  comments: { id: string; body: string; proposalId: string }[];
  reports: { id: string; reason: string; proposalId: string; commentId: string | null }[];
};

export function DistrictModerationClient({ districtId, queue }: { districtId: string; queue: ReviewQueue }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [kind, setKind] = useState<"ANNOUNCEMENT" | "MEETING">("ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  async function act(payload: object) {
    setBusy(true); setFeedback(null);
    const result = await apiFetch("/api/civilization/assembly/moderate", {
      method: "POST", body: JSON.stringify(payload),
    });
    setBusy(false);
    if (result.error) { setFeedback(result.error.message); return false; }
    setFeedback("Moderation action saved. This is not staff construction approval.");
    router.refresh();
    return true;
  }
  async function notice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const at = kind === "MEETING" && scheduledFor ? new Date(scheduledFor).toISOString() : null;
    if (await act({ action: "NOTICE", districtId, kind, title, body, scheduledFor: at })) {
      setTitle(""); setBody(""); setScheduledFor("");
    }
  }
  return <div className="space-y-7">
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-foreground">Review proposed improvements ({queue.proposals.length})</h2>
      {queue.proposals.map((p) => <article key={p.id} className="mt-4 space-y-2 rounded-xl border border-border p-4">
        <h3 className="font-semibold">{p.title}</h3><p className="whitespace-pre-wrap text-sm text-secondary">{p.description}</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => act({ action: "PROPOSAL", proposalId: p.id, decision: "OPEN", reason: "" })}
            className="min-h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Open discussion</button>
          <button disabled={busy} onClick={() => act({ action: "PROPOSAL", proposalId: p.id, decision: "REJECT", reason: "Not suitable for community review" })}
            className="min-h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Reject proposal</button>
        </div>
      </article>)}
    </section>
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-foreground">Moderate comments ({queue.comments.length})</h2>
      {queue.comments.map((c) => <div key={c.id} className="mt-3 rounded-xl border border-border p-4">
        <p className="text-sm text-secondary">{c.body}</p>
        <div className="mt-3 flex gap-3">
          <button disabled={busy} onClick={() => act({ action: "COMMENT", commentId: c.id, decision: "SHOW" })}
            className="min-h-10 rounded-lg border border-border px-3 text-sm">Show</button>
          <button disabled={busy} onClick={() => act({ action: "COMMENT", commentId: c.id, decision: "HIDE" })}
            className="min-h-10 rounded-lg border border-border px-3 text-sm">Hide</button>
        </div>
      </div>)}
    </section>
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-foreground">Community reports ({queue.reports.length})</h2>
      {queue.reports.map((r) => <div key={r.id} className="mt-3 rounded-xl border border-border p-4">
        <p className="text-sm text-secondary">{r.reason}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["RESOLVE", "HIDE_PROPOSAL", ...(r.commentId ? ["HIDE_COMMENT"] : [])] as string[]).map((decision) =>
            <button key={decision} disabled={busy} onClick={() => act({ action: "REPORT", reportId: r.id, decision })}
              className="min-h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-50">
              {decision.replaceAll("_", " ").toLowerCase()}
            </button>)}
        </div>
      </div>)}
    </section>
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-foreground">Publish an announcement or meeting</h2>
      <p className="mt-1 text-sm text-secondary">Meeting notices are scheduled information only; attendance is not fabricated or guaranteed.</p>
      <form onSubmit={notice} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold" htmlFor="notice-kind">Type</label>
        <select id="notice-kind" value={kind} onChange={(e) => setKind(e.target.value as "ANNOUNCEMENT" | "MEETING")}
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm">
          <option value="ANNOUNCEMENT">Announcement</option><option value="MEETING">Meeting</option>
        </select>
        <label className="block text-sm font-semibold" htmlFor="notice-title">Title</label>
        <input id="notice-title" required minLength={5} maxLength={110} value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"/>
        <label className="block text-sm font-semibold" htmlFor="notice-body">Details</label>
        <textarea id="notice-body" required minLength={10} maxLength={1500} rows={3} value={body} onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-xl border border-border bg-background p-3 text-sm"/>
        {kind === "MEETING" && <><label className="block text-sm font-semibold" htmlFor="notice-time">Meeting time</label>
          <input id="notice-time" type="datetime-local" required value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm" /></>}
        <button disabled={busy} type="submit" className="min-h-11 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          Publish district notice</button>
      </form>
    </section>
    {feedback && <p role="status" className="rounded-xl border border-border p-4 text-sm">{feedback}</p>}
  </div>;
}
