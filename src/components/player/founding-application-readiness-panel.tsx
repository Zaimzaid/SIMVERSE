"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import type { FoundingApplicationReadiness } from "@/lib/civilization/application-intake-contract";

type Props = {
  initial: FoundingApplicationReadiness & {
    application: {
      id: string;
      status: "PENDING_REVIEW" | "DENIED" | "WITHDRAWN";
      submittedNationSlug: string;
      submittedAt: Date | string;
      reviewedAt: Date | string | null;
      reviewNote: string | null;
    } | null;
    note: string;
  };
};

export function FoundingApplicationReadinessPanel({ initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function act(method: "POST" | "DELETE") {
    setBusy(true);
    setFeedback(null);
    const result = await apiFetch("/api/civilization/my-application", { method });
    setBusy(false);
    if (result.error) {
      setFeedback(result.error.message);
      setError(true);
      return;
    }
    setError(false);
    setFeedback(method === "POST"
      ? "Application submitted for review; no citizenship has been granted."
      : "Application withdrawn. Your application history remains recorded.");
    router.refresh();
  }

  const status = initial.application?.status;
  return (
    <div className="space-y-5">
      <p className="text-sm leading-7 text-secondary">{initial.note}</p>
      {status ? (
        <div className="rounded-xl border border-border bg-background/70 p-4">
          <p className="text-sm font-semibold text-foreground">Application status: {status.replaceAll("_", " ")}</p>
          <p className="mt-1 text-sm text-secondary">Requested nation: {initial.application?.submittedNationSlug}</p>
          {initial.application?.reviewNote && (
            <p className="mt-3 text-sm text-secondary">Review feedback: {initial.application.reviewNote}</p>
          )}
          {status === "PENDING_REVIEW" && (
            <button type="button" disabled={busy} onClick={() => act("DELETE")}
              className="mt-4 min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60">
              {busy ? "Updating…" : "Withdraw pending application"}
            </button>
          )}
          <p className="mt-3 text-sm text-secondary">
            This pilot does not issue citizenship even when an application is in review.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2" aria-label="Application prerequisites">
            {initial.checks.map((check) => (
              <li key={check.key} className="flex items-start gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm">
                <span aria-hidden className={check.met ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}>
                  {check.met ? "✓" : "○"}
                </span>
                <span className="text-foreground">{check.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-secondary">
            Country: <strong>{initial.countryName ?? "No draft country selected"}</strong>
            {" · "}Readiness: <strong>{initial.stage.replaceAll("_", " ").toLowerCase()}</strong>
          </p>
          <button type="button" disabled={busy || !initial.canSubmit} onClick={() => act("POST")}
            className="min-h-11 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Submitting…" : "Submit application for review"}
          </button>
          {!initial.canSubmit && <p className="text-sm text-secondary">
            Submission is unavailable until all requirements are met. Your private draft remains saved.
          </p>}
        </>
      )}
      {feedback && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-500/30 text-rose-700 dark:text-rose-300" : "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"}`}>{feedback}</p>}
    </div>
  );
}
