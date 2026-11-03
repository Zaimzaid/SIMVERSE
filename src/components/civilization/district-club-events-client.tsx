"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";
import { CLUB_EVENT_CATEGORIES } from "@/lib/civilization/district-club-event-contract";

type ClubEvent = {
  id: string; title: string; description: string; category: string;
  startsAt: string; endsAt: string; organizerDisplayName: string;
  status: string; attendanceCount: number; myRsvp: boolean; mine: boolean;
};
type EventListing = {
  district: { id: string; name: string };
  notice: string;
  events: ClubEvent[];
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" :
    date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function DistrictClubEventsClient() {
  const [listing, setListing] = useState<EventListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SOCIAL");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = useCallback(async () => {
    const response = await apiFetch<EventListing>("/api/civilization/club/events");
    if (response.data) {
      setListing(response.data);
      setError("");
    } else {
      setListing(null);
      setError(response.error?.message ?? "Club activities could not be loaded.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Choose valid event start and end times."); return;
    }
    setBusy("PROPOSE"); setError(""); setNotice("");
    const response = await apiFetch<{ status: string }>("/api/civilization/club/events", {
      method: "POST",
      body: JSON.stringify({
        action: "PROPOSE", title, description, category,
        startsAt: start.toISOString(), endsAt: end.toISOString(),
      }),
    });
    setBusy(null);
    if (!response.data) {
      setError(response.error?.message ?? "The proposed event could not be sent.");
      return;
    }
    setTitle(""); setDescription(""); setStartsAt(""); setEndsAt("");
    setNotice("Your event proposal is pending an independent club moderator review.");
    await load();
  }

  async function rsvp(eventId: string, action: "JOIN" | "LEAVE") {
    setBusy(eventId); setError(""); setNotice("");
    const response = await apiFetch<{ attending: boolean }>("/api/civilization/club/events", {
      method: "POST", body: JSON.stringify({ action: "RSVP", eventId, rsvpAction: action }),
    });
    setBusy(null);
    if (!response.data) {
      setError(response.error?.message ?? "Could not update your attendance.");
      return;
    }
    setNotice(response.data.attending ? "You're on this event's attendance list." :
      "You've withdrawn from this event.");
    await load();
  }

  return <section aria-labelledby="club-events-heading" className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <div>
      <h2 id="club-events-heading" className="font-display text-xl font-semibold text-foreground">
        Community events & activities
      </h2>
      <p className="mt-2 text-sm leading-7 text-secondary">
        Suggest an online activity for your district, or join one approved by a club moderator.
        These are social events, not official development meetings or world locations.
      </p>
    </div>

    <form onSubmit={propose} className="space-y-3 rounded-xl border border-border bg-background p-4">
      <h3 className="font-semibold text-foreground">Suggest an event</h3>
      <div>
        <label htmlFor="club-event-title" className="text-sm font-semibold text-foreground">Event title</label>
        <input id="club-event-title" required minLength={8} maxLength={100} value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="e.g. District trivia evening"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground" />
      </div>
      <div>
        <label htmlFor="club-event-category" className="text-sm font-semibold text-foreground">Type</label>
        <select id="club-event-category" value={category} onChange={event => setCategory(event.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground">
          {CLUB_EVENT_CATEGORIES.map(item => <option key={item.value} value={item.value}>
            {item.title}
          </option>)}
        </select>
      </div>
      <div>
        <label htmlFor="club-event-description" className="text-sm font-semibold text-foreground">
          What will residents do?
        </label>
        <textarea id="club-event-description" rows={3} minLength={20} maxLength={1000}
          required value={description} onChange={event => setDescription(event.target.value)}
          placeholder="Tell neighbors what the gathering is about and how to take part."
          className="mt-1 w-full rounded-xl border border-border bg-surface p-3 text-sm text-foreground" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="club-event-start" className="text-sm font-semibold text-foreground">
            Start (your local time)
          </label>
          <input id="club-event-start" type="datetime-local" required value={startsAt}
            onChange={event => setStartsAt(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground" />
        </div>
        <div>
          <label htmlFor="club-event-end" className="text-sm font-semibold text-foreground">
            End (your local time)
          </label>
          <input id="club-event-end" type="datetime-local" required value={endsAt}
            onChange={event => setEndsAt(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground" />
        </div>
      </div>
      <p className="text-xs leading-6 text-secondary">
        The event must start 30 minutes to 90 days from now and last at most six hours.
        Up to three proposals per person every seven days; review is required before publication.
      </p>
      <button disabled={busy !== null} type="submit"
        className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
        {busy === "PROPOSE" ? "Submitting…" : "Submit event for review"}
      </button>
    </form>

    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Upcoming district activities</h3>
        <button type="button" onClick={() => { setLoading(true); void load(); }}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent">
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-sm text-secondary">Loading activities…</p> :
        listing?.events.length ? <ul className="mt-4 space-y-3">
          {listing.events.map(event => <li key={event.id}
            className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-foreground">{event.title}</h4>
              <span className="text-xs font-semibold text-accent">
                {event.status === "PUBLISHED" ? "Approved" : "Pending review"}
              </span>
            </div>
            <p className="mt-2 text-xs text-secondary">{event.category.replaceAll("_", " ")}
              {" · Hosted by "}{event.organizerDisplayName}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-secondary">{event.description}</p>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {dateLabel(event.startsAt)} — {dateLabel(event.endsAt)}
            </p>
            {event.status === "PUBLISHED" && <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-secondary">{event.attendanceCount} attending</span>
              <button type="button" disabled={busy !== null}
                onClick={() => void rsvp(event.id, event.myRsvp ? "LEAVE" : "JOIN")}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-accent disabled:opacity-50">
                {busy === event.id ? "Updating…" : event.myRsvp ? "Withdraw RSVP" : "I'll attend"}
              </button>
            </div>}
            {event.status !== "PUBLISHED" && event.mine &&
              <p className="mt-3 text-xs text-secondary">Only you and moderators can see this pending proposal.</p>}
          </li>)}
        </ul> :
          <p className="mt-3 rounded-xl bg-background p-4 text-sm text-secondary">
            No upcoming published events yet. Propose a friendly gathering for your neighbors.
          </p>}
    </div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="text-sm text-secondary">{notice}</p>}
  </section>;
}
