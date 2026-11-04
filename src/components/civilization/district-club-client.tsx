"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";

type Room = { key: string; title: string; description: string };
type ChatMessage = {
  id: string; room: string; body: string; createdAt: string;
  authorDisplayName: string; isMine: boolean;
};
type Home = {
  active: boolean; district: { id: string; name: string } | null;
  rooms: Room[]; canModerate: boolean; explanation: string | null; notice: string;
};
type Conversation = {
  room: string; district: { id: string; name: string }; messages: ChatMessage[];
};
type Activity = {
  roomUnread: Record<string, number>;
  eventUnread: number;
  totalUnread: number;
  transport: string;
};

export function DistrictClubClient({ home }: { home: Home }) {
  const [room, setRoom] = useState("GENERAL");
  const roomRef = useRef(room);
  const lastAcknowledged = useRef<Record<string, string>>({});
  const [activity, setActivity] = useState<Activity | null>(null);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(home.active);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const refreshActivity = useCallback(async () => {
    if (!home.active || document.visibilityState !== "visible") return;
    const status = await apiFetch<Activity>("/api/civilization/club/activity");
    if (status.data) {
      setActivity(status.data);
      setConnectionNotice("");
    } else {
      setActivity(null);
      setConnectionNotice("Club updates are unavailable. Check your connection or membership.");
    }
  }, [home.active]);

  const refresh = useCallback(async (chosen: string, silent = false) => {
    if (!home.active) return;
    if (!silent) setLoading(true);
    const response = await apiFetch<Conversation>(
      "/api/civilization/club?room=" + encodeURIComponent(chosen),
    );
    if (roomRef.current !== chosen) return;
    if (response.data) {
      setMessages(response.data.messages);
      if (!silent) setError("");
      // Server verifies the message belongs to this private room before moving
      // the caller's read cursor. Never acknowledge beyond what was received.
      const last = response.data.messages.at(-1);
      if (last && document.visibilityState === "visible" && lastAcknowledged.current[chosen] !== last.id) {
        const ack = await apiFetch<{ accepted: boolean }>("/api/civilization/club/activity", {
          method: "POST",
          body: JSON.stringify({ channel: chosen, itemId: last.id }),
        });
        if (ack.data) {
          lastAcknowledged.current[chosen] = last.id;
          await refreshActivity();
        }
      }
    } else if (response.error) {
      setError(response.error.message);
      setMessages([]);
      setConnectionNotice("Club chat could not refresh.");
    }
    if (!silent) setLoading(false);
  }, [home.active, refreshActivity]);

  useEffect(() => {
    if (!home.active) return;
    roomRef.current = room;
    void refresh(room);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(room, true);
    }, 5_000);
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh(room, true);
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [home.active, room, refresh]);

  useEffect(() => {
    if (!home.active) return;
    void refreshActivity();
    const id = window.setInterval(() => { void refreshActivity(); }, 7_000);
    return () => window.clearInterval(id);
  }, [home.active, refreshActivity]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || body.trim().length < 2) return;
    setBusy(true);
    setError("");
    const result = await apiFetch<{ accepted: boolean }>("/api/civilization/club", {
      method: "POST", body: JSON.stringify({ action: "MESSAGE", room, body }),
    });
    setBusy(false);
    if (!result.data) {
      setError(result.error?.message ?? "Could not send this message.");
      return;
    }
    setBody("");
    setNotice("Message sent to your district.");
    await refresh(room, true);
  }

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportId || busy) return;
    setBusy(true);
    setError("");
    const result = await apiFetch<{ status: string }>("/api/civilization/club", {
      method: "POST",
      body: JSON.stringify({ action: "REPORT", messageId: reportId, reason: reportReason }),
    });
    setBusy(false);
    if (!result.data) {
      setError(result.error?.message ?? "Could not submit your report.");
      return;
    }
    setReportId(null);
    setReportReason("");
    setNotice("Your report was sent for independent club moderation.");
  }

  if (!home.active || !home.district) {
    return <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-foreground">Your club has not opened</h2>
      <p className="mt-3 text-sm leading-7 text-secondary">
        {home.explanation ?? "An approved district residence is required."}
      </p>
      <p className="mt-3 text-sm leading-7 text-secondary">
        A founding-country preference or temporary district visit does not unlock residents-only chat.
        Your existing account and general social messages remain available.
      </p>
    </section>;
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Residents-only · Social club</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">
        {home.district.name} Club
      </h2>
      <p className="mt-2 text-sm leading-7 text-secondary">{home.notice}</p>
      <p className="mt-2 text-xs leading-6 text-secondary">
        Updates refresh while this page is open. Instant push and WebSockets are not enabled.
      </p>
      {activity && activity.totalUnread > 0 && <div className="mt-4 flex flex-wrap items-center gap-3">
        <p role="status" className="text-sm font-semibold text-accent">
          {activity.totalUnread} unread club update{activity.totalUnread === 1 ? "" : "s"}
        </p>
        {activity.eventUnread > 0 &&
          <a href="#club-events-heading" className="text-sm font-semibold text-accent hover:underline">
            {activity.eventUnread} new approved event{activity.eventUnread === 1 ? "" : "s"}
          </a>}
      </div>}
      {connectionNotice && <p role="status" className="mt-2 text-xs text-secondary">{connectionNotice}</p>}
      {home.canModerate && <a href="/profile/civilization/club/moderation"
        className="mt-4 inline-block rounded-xl border border-border px-4 py-2 text-sm font-semibold text-accent">
        Club moderation queue
      </a>}
    </section>
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6" aria-label="District Club chat rooms">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Choose a club room">
        {home.rooms.map(item => <button key={item.key} type="button" aria-pressed={room === item.key}
          onClick={() => { roomRef.current = item.key; setRoom(item.key); setMessages([]); setError(""); setNotice(""); setReportId(null); }}
          className={"min-h-14 rounded-xl border px-3 py-3 text-left text-xs font-semibold transition " +
            (room === item.key ? "border-accent bg-accent-soft text-accent" :
              "border-border bg-background text-secondary hover:border-accent")}>
          <span>{item.title}</span>
          {(activity?.roomUnread[item.key] ?? 0) > 0 &&
            <span aria-label={activity!.roomUnread[item.key] + " unread messages"}
              className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent">
              {activity!.roomUnread[item.key]}
            </span>}
        </button>)}
      </div>
      <p className="mt-4 text-sm text-secondary">
        {home.rooms.find(item => item.key === room)?.description}
      </p>
      <div className="mt-5 space-y-3" role="log" aria-live="polite" aria-label="District messages">
        {loading ? <p className="text-sm text-secondary">Loading resident messages…</p> :
          messages.length === 0 ? <p className="rounded-xl bg-background p-4 text-sm text-secondary">
            No messages in this room yet. Say hello to your neighbors.
          </p> : messages.map(message => <article key={message.id}
            className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <strong className="text-foreground">
                {message.authorDisplayName}{message.isMine ? " · You" : ""}
              </strong>
              <time className="text-muted" dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{message.body}</p>
            {!message.isMine && <button type="button"
              onClick={() => { setReportId(reportId === message.id ? null : message.id); setReportReason(""); }}
              className="mt-3 text-xs font-semibold text-secondary hover:text-accent">
              {reportId === message.id ? "Cancel report" : "Report message"}
            </button>}
            {reportId === message.id && <form onSubmit={report} className="mt-3 space-y-2">
              <label htmlFor={"club-report-" + message.id} className="block text-xs font-semibold text-secondary">
                Why are you reporting this message?
              </label>
              <textarea id={"club-report-" + message.id} required minLength={8} maxLength={350}
                value={reportReason} onChange={event => setReportReason(event.target.value)} rows={2}
                className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
              <button type="submit" disabled={busy || reportReason.trim().length < 8}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50">
                Send to moderators
              </button>
            </form>}
          </article>)}
      </div>
      <form onSubmit={send} className="mt-6 space-y-3">
        <label htmlFor="club-compose" className="block text-sm font-semibold text-foreground">
          Message to {home.rooms.find(item => item.key === room)?.title}
        </label>
        <textarea id="club-compose" rows={3} minLength={2} maxLength={650} required
          value={body} onChange={event => setBody(event.target.value)}
          placeholder="Introduce yourself or share something with your neighbors…"
          className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-secondary">{body.length}/650 characters</p>
          <button type="submit" disabled={busy || body.trim().length < 2}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
            {busy ? "Sending…" : "Send to room"}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-500/30 p-3 text-sm text-rose-600">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-xl border border-border p-3 text-sm text-secondary">{notice}</p>}
    </section>
  </div>;
}
