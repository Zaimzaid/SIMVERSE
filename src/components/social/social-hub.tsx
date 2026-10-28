"use client";

import { useCallback, useState } from "react";
import { Ban, Check, Mail, MessageCircle, RefreshCw, Search, Send, UserPlus, Users, X } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type Player = { id: string; displayName: string; avatarUrl: string | null; playerIdentity: { username: string | null } | null };
type Request = { id: string; other: Player };
type SocialState = { friends: Request[]; incoming: Request[]; outgoing: Request[]; blockedIds: string[] };
type Result = { userId: string; username: string | null; user: { displayName: string; avatarUrl: string | null } };
type Message = { id: string; senderId: string; recipientId: string; body: string; createdAt: string; readAt: string | null };

export function SocialHub({ initial, userId }: { initial: SocialState; userId: string }) {
  const [social, setSocial] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Result[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedFriend = social.friends.find((f) => f.other.id === selected);

  const refresh = useCallback(async () => {
    const res = await apiFetch<SocialState>("/api/social");
    if (res.data) setSocial(res.data);
    else if (res.error) setError(res.error.message);
  }, []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    const q = search.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(q)) { setError("Enter an exact public username (3–24 letters, numbers or underscores)."); return; }
    const res = await apiFetch<{ players: Result[] }>(`/api/social?username=${encodeURIComponent(q)}`);
    if (res.error) setError(res.error.message);
    else setFound(res.data?.players ?? []);
  }

  async function action(path: string, method: "POST" | "PATCH" | "DELETE", payload: Record<string,string>, message: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    const query = method === "DELETE" ? `?userId=${encodeURIComponent(payload.userId ?? "")}` : "";
    const res = await apiFetch(path + query, { method, ...(method !== "DELETE" ? { body: JSON.stringify(payload) } : {}) });
    if (res.error) setError(res.error.message);
    else { setNotice(message); await refresh(); if (payload.userId === selected && (path.includes("blocks"))) { setSelected(null); setMessages([]); } }
    setBusy(false);
  }

  async function openChat(id: string) {
    setSelected(id); setError(""); setNotice("");
    const res = await apiFetch<{ messages: Message[] }>(`/api/social/messages?peer=${encodeURIComponent(id)}`);
    if (res.error) setError(res.error.message);
    setMessages(res.data?.messages ?? []);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy || !body.trim()) return;
    setBusy(true); setError("");
    const res = await apiFetch<{ message: Message }>("/api/social/messages", {
      method: "POST", body: JSON.stringify({ recipientId: selected, body }),
    });
    if (res.error) setError(res.error.message);
    else {
      setBody("");
      if (res.data?.message) setMessages((old) => [...old, res.data!.message]);
    }
    setBusy(false);
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.95fr)_minmax(0,1.45fr)]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Search className="size-5 text-accent"/> Find a player</h2>
        <p className="mt-1 text-xs text-secondary">Search exact usernames of players who have made their profiles public.</p>
        <form className="mt-4 flex gap-2" onSubmit={(e) => void lookup(e)}>
          <input className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            aria-label="SIMVERSE username" placeholder="username" maxLength={25} value={search} onChange={e => setSearch(e.target.value)} />
          <Button type="submit" size="sm"><Search className="size-4"/> Find</Button>
        </form>
        {found.length === 0 && search.trim().length > 2 && <p className="mt-3 text-xs text-muted">Only matching public profiles will be shown.</p>}
        {found.map(player => <div key={player.userId} className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-background p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{player.user.displayName}</p>
            <p className="truncate text-xs text-muted">@{player.username}</p>
          </div>
          <Button size="sm" disabled={busy || social.blockedIds.includes(player.userId)}
            onClick={() => void action("/api/social/friends", "POST", { userId: player.userId }, "Invitation sent.")}><UserPlus className="size-4" /> Invite</Button>
        </div>)}
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Mail className="size-5 text-accent"/> Requests</h2>
        {!social.incoming.length && !social.outgoing.length ? <p className="mt-3 text-sm text-muted">No friend requests yet.</p> : null}
        {social.incoming.map(item => <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3" key={item.id}>
          <span className="text-sm">{item.other.displayName} <span className="text-xs text-muted">invited you</span></span>
          <div className="flex gap-1"><Button size="sm" disabled={busy} onClick={() => void action("/api/social/friends", "PATCH", {id:item.id,action:"ACCEPT"}, "Friend request accepted.")}><Check className="size-4" /> Accept</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action("/api/social/friends", "PATCH", {id:item.id,action:"REMOVE"}, "Request removed.")}><X className="size-4" /> Decline</Button></div>
        </div>)}
        {social.outgoing.map(item => <div key={item.id} className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
          <span className="truncate">To {item.other.displayName} · Pending</span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void action("/api/social/friends", "PATCH", {id:item.id,action:"REMOVE"}, "Invitation cancelled.")}>Cancel</Button>
        </div>)}
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-accent"/> Friends ({social.friends.length})</h2>
          <Button size="sm" variant="ghost" onClick={() => void refresh()} aria-label="Refresh friends"><RefreshCw className="size-4"/></Button>
        </div>
        {!social.friends.length && <p className="mt-3 text-sm text-muted">Accepted friends appear here. Only friends can exchange direct messages.</p>}
        {social.friends.map(item => <button key={item.id} type="button" onClick={() => void openChat(item.other.id)}
          className={`mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:border-accent/60 ${selected === item.other.id ? "border-accent bg-accent-soft" : "border-border"}`}>
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent"><MessageCircle className="size-4"/></span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.other.displayName}</span>
          <span className="block truncate text-xs text-muted">{item.other.playerIdentity?.username ? `@${item.other.playerIdentity.username}` : "SIMVERSE player"}</span></span>
        </button>)}
      </section>
    </div>

    <section aria-label="Private conversation" className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <div><h2 className="text-lg font-semibold">{selectedFriend?.other.displayName ?? "Messages"}</h2>
        <p className="text-xs text-muted">{selectedFriend ? "Private direct conversation" : "Select a friend to begin chatting"}</p></div>
        <div className="flex gap-2">
          {selected && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void openChat(selected)}><RefreshCw className="size-4"/> Refresh</Button>}
          {selected && <Button size="sm" variant="danger" disabled={busy} onClick={() => void action("/api/social/blocks", "POST", {userId:selected}, "Player blocked; friendship removed.")}><Ban className="size-4"/> Block</Button>}
        </div>
      </div>
      {error && <p role="alert" className="m-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
      {notice && <p role="status" className="m-3 rounded-lg border border-accent/40 p-3 text-sm text-accent">{notice}</p>}
      <div aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {selected && messages.length === 0 && <p className="text-sm text-muted">No messages yet. Say hello!</p>}
        {!selected && <div className="grid flex-1 place-items-center text-center text-sm text-muted"><div><MessageCircle className="mx-auto mb-3 size-10 text-accent"/><p>Messages stay between accepted SIMVERSE friends.</p><p className="mt-1 text-xs">Refresh to retrieve new messages; real-time delivery comes later.</p></div></div>}
        {messages.map(msg => <div key={msg.id} className={`max-w-[88%] self-${msg.senderId === userId ? "end" : "start"} rounded-2xl px-4 py-3 text-sm ${msg.senderId === userId ? "bg-accent text-accent-foreground" : "border border-border bg-background text-foreground"}`}>
          <p className="whitespace-pre-wrap break-words">{msg.body}</p><p className="mt-2 text-right text-[10px] opacity-70">{new Date(msg.createdAt).toLocaleString()}</p>
        </div>)}
      </div>
      <form onSubmit={(e) => void send(e)} className="flex gap-2 border-t border-border p-4">
        <input aria-label="Write private message" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-accent"
          placeholder={selected ? "Write a message…" : "Choose a friend first"} maxLength={1500} value={body} onChange={e=>setBody(e.target.value)} disabled={!selected || busy}/>
        <Button type="submit" disabled={!selected || !body.trim() || busy}><Send className="size-4"/> Send</Button>
      </form>
    </section>
  </div>;
}
