"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type Proposal = {
  id: string; title: string; category: string; status: string; description: string;
  authorDisplayName: string; reviewReason: string | null; support: number; oppose: number;
  myVote: string | null;
  comments: { id: string; body: string; authorDisplayName: string }[];
};
type Assembly = {
  district: { id: string; name: string };
  canVote: boolean; canModerate: boolean;
  proposals: Proposal[];
  notices: { id: string; kind: string; title: string; body: string; scheduledFor: Date | string | null }[];
  warning: string;
};

export function DistrictAssemblyClient({ assembly }: { assembly: Assembly }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("INFRASTRUCTURE");
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [reportReason, setReportReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function act(payload: object) {
    setBusy(true);
    setFeedback(null);
    const result = await apiFetch("/api/civilization/assembly", {
      method: "POST", body: JSON.stringify(payload),
    });
    setBusy(false);
    if (result.error) { setFeedback(result.error.message); return false; }
    setFeedback("Request recorded. Content and votes remain subject to district policy and review.");
    router.refresh();
    return true;
  }
  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await act({ action: "PROPOSE", districtId: assembly.district.id, title, description, category })) {
      setTitle(""); setDescription("");
    }
  }
  const categories = ["INFRASTRUCTURE", "ENVIRONMENT", "RECREATION", "SERVICES", "CULTURE"];

  return <div className="space-y-7">
    <header>
      <h2 className="text-2xl font-semibold text-foreground">{assembly.district.name} Assembly</h2>
      <p className="mt-2 text-sm leading-7 text-secondary">{assembly.warning}</p>
      <p className="mt-1 text-sm text-secondary">
        {assembly.canVote ? "You meet the 14-day residence requirement for advisory voting." :
          "Voting becomes available after 14 days of approved residence in this district."}
      </p>
    </header>
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Propose what your district should become</h3>
      <p className="mt-1 text-sm text-secondary">Suggest an amenity, service or community improvement. This does not reserve land or order construction.</p>
      <form onSubmit={propose} className="mt-5 space-y-4">
        <div><label htmlFor="assembly-proposal-title" className="block text-sm font-semibold text-foreground">Project idea</label>
          <input id="assembly-proposal-title" required minLength={8} maxLength={110} value={title}
            onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A community sports court"
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></div>
        <div><label htmlFor="assembly-proposal-category" className="block text-sm font-semibold text-foreground">Category</label>
          <select id="assembly-proposal-category" value={category} onChange={(e) => setCategory(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
            {categories.map((c) => <option key={c} value={c}>{c.toLowerCase().replaceAll("_", " ")}</option>)}
          </select></div>
        <div><label htmlFor="assembly-proposal-description" className="block text-sm font-semibold text-foreground">Why does your community need it?</label>
          <textarea id="assembly-proposal-description" required rows={4} minLength={35} maxLength={2500}
            value={description} onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground" /></div>
        <button disabled={busy} type="submit"
          className="min-h-11 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          Submit for moderation
        </button>
      </form>
    </section>
    <section aria-label="District notices and meetings" className="space-y-3">
      <h3 className="text-xl font-semibold text-foreground">Announcements and meetings</h3>
      {!assembly.notices.length && <p className="text-sm text-secondary">No official district announcements or meetings have been scheduled.</p>}
      {assembly.notices.map((n) => <article key={n.id} className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{n.kind}</p>
        <h4 className="mt-1 font-semibold text-foreground">{n.title}</h4>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{n.body}</p>
        {n.scheduledFor && <p className="mt-2 text-sm text-foreground">Scheduled: {new Date(n.scheduledFor).toLocaleString()}</p>}
      </article>)}
    </section>
    <section aria-label="Community proposals" className="space-y-4">
      <h3 className="text-xl font-semibold text-foreground">Community proposals</h3>
      {!assembly.proposals.length && <p className="text-sm text-secondary">No published proposals yet. All new ideas require moderation.</p>}
      {assembly.proposals.map((p) => <article key={p.id}
        className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-accent">{p.category.replaceAll("_", " ")} · {p.status.replaceAll("_", " ")}</p>
          <h4 className="mt-2 text-lg font-semibold text-foreground">{p.title}</h4>
          <p className="mt-1 text-sm text-secondary">Suggested by {p.authorDisplayName}</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{p.description}</p>
          {p.reviewReason && <p className="mt-2 text-sm text-secondary">Moderator note: {p.reviewReason}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-foreground">
          <span>Support: {p.support}</span><span>Oppose: {p.oppose}</span>
          {p.myVote && <span>Your vote: {p.myVote.toLowerCase()}</span>}
          {p.status === "OPEN" && <><button type="button" disabled={busy || !assembly.canVote || Boolean(p.myVote)}
              onClick={() => act({ action: "VOTE", proposalId: p.id, choice: "SUPPORT" })}
              className="min-h-10 rounded-lg border border-border px-3 disabled:opacity-50">Support</button>
            <button type="button" disabled={busy || !assembly.canVote || Boolean(p.myVote)}
              onClick={() => act({ action: "VOTE", proposalId: p.id, choice: "OPPOSE" })}
              className="min-h-10 rounded-lg border border-border px-3 disabled:opacity-50">Oppose</button></>}
        </div>
        {p.status === "OPEN" && <div>
          <p className="text-sm font-semibold text-foreground">Discussion (moderated)</p>
          {p.comments.map((c) => <p key={c.id} className="mt-2 rounded-lg bg-background p-3 text-sm text-foreground">
            <strong>{c.authorDisplayName}:</strong> {c.body}
            <button type="button" disabled={busy || (reportReason[c.id] ?? "").trim().length < 8}
              onClick={() => act({ action: "REPORT", proposalId: p.id, commentId: c.id,
                reason: reportReason[c.id] })}
              className="ml-2 text-xs text-secondary underline disabled:opacity-50">Report comment</button>
            <input aria-label="Reason to report comment" value={reportReason[c.id] ?? ""}
              maxLength={350} onChange={(e) => setReportReason((old) => ({ ...old, [c.id]: e.target.value }))}
              placeholder="Reason to report (8+ characters)" className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-xs" />
          </p>)}
          <div className="mt-3 flex flex-wrap gap-2">
            <input aria-label={`Comment on ${p.title}`} value={commentText[p.id] ?? ""}
              onChange={(e) => setCommentText((old) => ({ ...old, [p.id]: e.target.value }))}
              maxLength={800} placeholder="Join the discussion (moderated)" className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" />
            <button disabled={busy || (commentText[p.id] ?? "").trim().length < 3}
              type="button" onClick={() => act({ action: "COMMENT", proposalId: p.id, body: commentText[p.id] })}
              className="min-h-11 rounded-xl border border-border px-4 text-sm disabled:opacity-50">Post comment</button>
          </div>
        </div>}
      </article>)}
    </section>
    {feedback && <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground">{feedback}</p>}
  </div>;
}
