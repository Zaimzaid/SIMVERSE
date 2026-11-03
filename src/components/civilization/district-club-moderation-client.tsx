"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type Report = {
  id: string; messageId: string; messageBody: string; room: string;
  reportedAuthorId: string; reportedAuthorName: string;
  reason: string; createdAt: string; ownMessage: boolean; ownReport: boolean;
};
type Queue = { district: { id: string; name: string }; reports: Report[] };

export function DistrictClubModerationClient({ initial }: { initial: Queue }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function review(reportId: string, action: "DISMISS" | "HIDE") {
    setBusy(reportId); setError("");
    const response = await apiFetch<{ reviewed: boolean }>("/api/civilization/club/moderation", {
      method: "POST", body: JSON.stringify({ reportId, action }),
    });
    setBusy(null);
    if (!response.data) { setError(response.error?.message ?? "Review failed."); return; }
    const fresh = await apiFetch<Queue>("/api/civilization/club/moderation");
    if (fresh.data) setQueue(fresh.data);
    else router.refresh();
  }

  return <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="text-xl font-semibold text-foreground">
      Open reports · {queue.district.name}
    </h2>
    <p className="text-sm leading-6 text-secondary">
      Club moderation requires an independent grant. Reports do not automatically hide messages.
      Moderators cannot decide on their own messages or reports.
    </p>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {queue.reports.length === 0 ? <p className="text-sm text-secondary">No reports need review.</p> :
      queue.reports.map(report => <article key={report.id}
        className="rounded-xl border border-border bg-background p-4">
        <p className="text-xs uppercase tracking-wider text-accent">{report.room}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">{report.messageBody}</p>
        <p className="mt-2 text-xs text-secondary">
          Reported author: {report.reportedAuthorName} · ID {report.reportedAuthorId}
        </p>
        <p className="mt-3 text-sm text-secondary">Report reason: {report.reason}</p>
        {(report.ownMessage || report.ownReport) ? <p className="mt-2 text-xs text-secondary">
          Independent review required: you were involved in this message or report.
        </p> : <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy !== null}
            onClick={() => review(report.id, "DISMISS")}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-secondary disabled:opacity-50">
            Dismiss report
          </button>
          <button type="button" disabled={busy !== null}
            onClick={() => review(report.id, "HIDE")}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-rose-600 disabled:opacity-50">
            Hide message
          </button>
        </div>}
      </article>)}
  </section>;
}
