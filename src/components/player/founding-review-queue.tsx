"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type ReviewItem = {
  id: string; status: string; submittedNationSlug: string; motivation: string;
  createdAt: Date | string;
  user: { displayName: string };
  country: { id: string; name: string };
};

export function FoundingReviewQueue({ applications }: { applications: ReviewItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  async function deny(applicationId: string) {
    const reviewNote = notes[applicationId]?.trim() ?? "";
    if (reviewNote.length < 8) {
      setFeedback("Please explain the denial in at least 8 characters.");
      return;
    }
    setBusyId(applicationId);
    setFeedback(null);
    const result = await apiFetch("/api/civilization/reviewer", {
      method: "PATCH",
      body: JSON.stringify({ applicationId, reviewNote }),
    });
    setBusyId(null);
    if (result.error) {
      setFeedback(result.error.message);
      return;
    }
    setFeedback("The application was denied and the applicant can see the review note. No citizenship was issued.");
    router.refresh();
  }

  return <section className="space-y-4">
    <p className="text-sm leading-7 text-secondary">
      This restricted Phase 3B pilot permits review and denial only. Approval,
      citizenship issuance and reviewer-grant administration are not available.
      Applicant statements are private and visible only to authorized country reviewers.
    </p>
    {applications.length === 0
      ? <p className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">No pending applications in your authorized country queues.</p>
      : applications.map((app) => <article key={app.id}
          className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div>
            <h2 className="font-semibold text-foreground">{app.user.displayName} · {app.country.name}</h2>
            <p className="mt-1 text-sm text-secondary">Application pending review · Submitted {new Date(app.createdAt).toLocaleDateString()}</p>
          </div>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-background p-3 text-sm leading-7 text-foreground">
            {app.motivation || "No personal statement provided."}
          </p>
          <div>
            <label htmlFor={`review-note-${app.id}`} className="block text-sm font-semibold text-foreground">
              Reason for denial
            </label>
            <textarea id={`review-note-${app.id}`} rows={3} maxLength={500}
              value={notes[app.id] ?? ""}
              onChange={(event) => setNotes((current) => ({ ...current, [app.id]: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground"
              placeholder="Give the applicant clear reasons..."/>
          </div>
          <button type="button" disabled={busyId !== null}
            onClick={() => deny(app.id)}
            className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-background disabled:opacity-50">
            {busyId === app.id ? "Saving decision…" : "Deny application"}
          </button>
        </article>)}
    {feedback && <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground">{feedback}</p>}
  </section>;
}
