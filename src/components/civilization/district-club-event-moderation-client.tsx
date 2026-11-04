"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client/api";

type ReviewEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  startsAt: string;
  endsAt: string;
  organizerDisplayName: string;
  mine: boolean;
};
type Queue = { district: { id: string; name: string }; events: ReviewEvent[] };

export function DistrictClubEventModerationClient({ initial }: { initial: Queue }) {
  const [queue, setQueue] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function review(eventId: string, action: "PUBLISH" | "REJECT" | "CANCEL") {
    setError(""); setFeedback(""); setBusy(eventId);
    const response = await apiFetch<{ status: string }>(
      "/api/civilization/club/events/moderation", {
        method: "POST",
        body: JSON.stringify({ eventId, action, reason: reasons[eventId] ?? "" }),
      },
    );
    setBusy(null);
    if (!response.data) {
      setError(response.error?.message ?? "Could not review this event.");
      return;
    }
    setFeedback("Event review recorded: " + response.data.status.toLowerCase().replaceAll("_", " ") + ".");
    const fresh = await apiFetch<Queue>("/api/civilization/club/events/moderation");
    if (fresh.data) setQueue(fresh.data);
    else setError(fresh.error?.message ?? "Could not refresh the moderation queue.");
  }

  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7"
    aria-label="District social event moderation">
    <h2 className="font-display text-xl font-semibold text-foreground">District social event review</h2>
    <p className="mt-2 text-sm leading-7 text-secondary">
      Review online-only social events before neighbors see them. Cancel a published event if needed.
      You cannot approve, reject or cancel your own proposals.
    </p>
    {queue.events.length === 0 ?
      <p className="mt-4 rounded-xl bg-background p-4 text-sm text-secondary">
        No event proposals or published activities need attention.
      </p> : <ul className="mt-4 space-y-3">
        {queue.events.map(event => <li key={event.id}
          className="rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-foreground">{event.title}</p>
            <span className="text-xs font-semibold text-accent">
              {event.status === "PUBLISHED" ? "Published" : "Needs review"}
            </span>
          </div>
          <p className="mt-2 text-xs text-secondary">
            {event.category} · Proposed by {event.organizerDisplayName}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">
            {event.description}
          </p>
          <p className="mt-2 text-xs text-secondary">
            {new Date(event.startsAt).toLocaleString()} — {new Date(event.endsAt).toLocaleString()}
          </p>
          {event.mine ? <p className="mt-3 text-xs text-secondary">
            Independent moderator required: this is your own event.
          </p> : <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-secondary" htmlFor={"club-event-reason-" + event.id}>
                Review reason (optional)
              </label>
              <input id={"club-event-reason-" + event.id} maxLength={300}
                value={reasons[event.id] ?? ""}
                onChange={e => setReasons(current => ({ ...current, [event.id]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
            </div>
            <div className="flex flex-wrap gap-2">
              {event.status === "PENDING_REVIEW" ? <>
                <button type="button" disabled={busy !== null}
                  onClick={() => void review(event.id, "PUBLISH")}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-accent disabled:opacity-50">
                  Publish event
                </button>
                <button type="button" disabled={busy !== null}
                  onClick={() => void review(event.id, "REJECT")}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50">
                  Reject
                </button>
              </> : <button type="button" disabled={busy !== null}
                onClick={() => void review(event.id, "CANCEL")}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50">
                Cancel published event
              </button>}
            </div>
          </div>}
        </li>)}
      </ul>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    {feedback && <p role="status" className="mt-3 text-sm text-secondary">{feedback}</p>}
  </section>;
}
