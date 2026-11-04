"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";

type Group = {
  id: string; title: string; description: string;
  memberCount: number; joined: boolean; createdBy: string;
};
type Listing = { district: { name: string }; groups: Group[] };
type Message = { id: string; body: string; isMine: boolean;
  authorDisplayName: string; createdAt: string };

export function DistrictClubInterestClient() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = listing?.groups.find(g => g.id === selected);

  const refreshGroups = useCallback(async () => {
    const result = await apiFetch<Listing>("/api/civilization/club/groups");
    if (result.data) {
      setListing(result.data);
      if (selectedRef.current && !result.data.groups.some(g => g.id === selectedRef.current && g.joined)) {
        setSelected(null); selectedRef.current = null; setMessages([]);
      }
    } else setError(result.error?.message ?? "Couldn't load district interest groups.");
  }, []);

  const refreshMessages = useCallback(async (groupId: string) => {
    const result = await apiFetch<{ messages: Message[] }>(
      "/api/civilization/club/groups/messages?groupId=" + encodeURIComponent(groupId));
    if (selectedRef.current !== groupId) return;
    if (result.data) setMessages(result.data.messages);
    else { setError(result.error?.message ?? "Couldn't load group chat."); setMessages([]); }
  }, []);

  useEffect(() => { void refreshGroups(); }, [refreshGroups]);
  useEffect(() => {
    if (!selected || !active?.joined) return;
    selectedRef.current = selected;
    void refreshMessages(selected);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshMessages(selected);
    }, 8_000);
    return () => window.clearInterval(interval);
  }, [selected, active?.joined, refreshMessages]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const result = await apiFetch<{ groupId: string }>("/api/civilization/club/groups", {
      method: "POST", body: JSON.stringify({ title, description }),
    });
    setBusy(false);
    if (!result.data) { setError(result.error?.message ?? "Could not create group."); return; }
    setTitle(""); setDescription(""); setNotice("Interest group created.");
    await refreshGroups();
  }

  async function membership(groupId: string, action: "JOIN" | "LEAVE") {
    setBusy(true); setError("");
    const result = await apiFetch<{ joined: boolean }>("/api/civilization/club/groups", {
      method: "PATCH", body: JSON.stringify({ groupId, action }),
    });
    setBusy(false);
    if (!result.data) { setError(result.error?.message ?? "Could not change group membership."); return; }
    if (action === "LEAVE" && selected === groupId) {
      selectedRef.current = null; setSelected(null); setMessages([]);
    }
    await refreshGroups();
  }

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setError("");
    const result = await apiFetch<{ messageId: string }>(
      "/api/civilization/club/groups/messages", {
        method: "POST", body: JSON.stringify({ groupId: selected, body }),
      });
    setBusy(false);
    if (!result.data) { setError(result.error?.message ?? "Could not post group message."); return; }
    setBody(""); await refreshMessages(selected);
  }

  async function report(messageId: string) {
    const reason = window.prompt("Describe the problem with this group message (10–350 characters):");
    if (!reason) return;
    setBusy(true); setError("");
    const result = await apiFetch<{ reportId: string }>("/api/civilization/club/groups/reports", {
      method: "POST", body: JSON.stringify({ messageId, reason }),
    });
    setBusy(false);
    if (!result.data) setError(result.error?.message ?? "Report not accepted.");
    else setNotice("Your report was sent to an independent Club moderator.");
  }

  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="font-display text-xl font-semibold text-foreground">Interest groups</h2>
    <p className="mt-2 text-sm text-secondary">
      Create or join a resident-only discussion group about shared interests.
      Groups remain within your approved home district; moderation rules still apply.
    </p>
    <form onSubmit={create} className="mt-5 grid gap-3 rounded-xl border border-border bg-background p-4">
      <h3 className="font-semibold text-foreground">Create an interest group</h3>
      <label className="text-sm text-secondary">Group title
        <input required minLength={4} maxLength={70} value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
      </label>
      <label className="text-sm text-secondary">What will the group discuss?
        <textarea required minLength={15} maxLength={400} rows={2} value={description}
          onChange={e => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
      </label>
      <button type="submit" disabled={busy}
        className="justify-self-start rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
        Create group
      </button>
    </form>
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,280px)_1fr]">
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">District groups</h3>
        {listing?.groups.length ? listing.groups.map(g => <article key={g.id}
          className="rounded-xl border border-border bg-background p-3">
          <p className="font-semibold text-foreground">{g.title}</p>
          <p className="mt-1 text-xs leading-5 text-secondary">{g.description}</p>
          <p className="mt-2 text-xs text-secondary">By {g.createdBy} · {g.memberCount} residents</p>
          {g.joined ? <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { selectedRef.current = g.id; setSelected(g.id); setMessages([]); }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent">
              Open group
            </button>
            <button type="button" disabled={busy} onClick={() => void membership(g.id, "LEAVE")}
              className="rounded-lg border border-border px-3 py-2 text-xs text-secondary">
              Leave
            </button>
          </div> : <button type="button" disabled={busy} onClick={() => void membership(g.id, "JOIN")}
            className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent">
            Join group
          </button>}
        </article>) : <p className="text-sm text-secondary">No interest groups yet.</p>}
      </div>
      <div aria-label="Interest group messages" className="rounded-xl border border-border bg-background p-4">
        {selected && active?.joined ? <>
          <h3 className="font-semibold text-foreground">{active.title}</h3>
          <div className="mt-3 max-h-96 space-y-3 overflow-y-auto" role="log">
            {messages.length ? messages.map(m => <article key={m.id} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-semibold text-foreground">{m.authorDisplayName}{m.isMine ? " · You" : ""}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">{m.body}</p>
              {!m.isMine && <button type="button" disabled={busy}
                className="mt-2 text-xs font-semibold text-accent"
                onClick={() => void report(m.id)}>Report</button>}
            </article>) : <p className="text-sm text-secondary">No messages yet.</p>}
          </div>
          <form className="mt-4 space-y-2" onSubmit={post}>
            <label htmlFor="club-interest-compose" className="text-sm text-secondary">Your message</label>
            <textarea id="club-interest-compose" value={body} rows={2} required minLength={2}
              maxLength={650} onChange={e => setBody(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground" />
            <button type="submit" disabled={busy || body.trim().length < 2}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
              Send
            </button>
          </form>
        </> : <p className="text-sm text-secondary">Choose a group you've joined to chat with its members.</p>}
      </div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-secondary">{notice}</p>}
  </section>;
}
