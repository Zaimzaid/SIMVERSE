"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban, Bell, Check, ChevronLeft, Clock3, Mail, MessageCircle, Phone,
  RefreshCw, Search, Send, UserPlus, Users, UsersRound, Video, X,
} from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { CommunityExtras } from "./community-extras";
import { PeerCallDock } from "./peer-call-dock";

type Player = { id: string; displayName: string; avatarUrl: string | null; playerIdentity: { username: string | null } | null };
type Friendship = { id: string; other: Player };
type SocialState = {
  friends: Friendship[]; incoming: Friendship[]; outgoing: Friendship[];
  blockedIds: string[]; blocked: { id: string; displayName: string }[];
};
type SearchResult = { userId: string; username: string | null; user: { displayName: string; avatarUrl: string | null } };
type Message = {
  id: string; senderId: string; recipientId: string; body: string;
  mediaUrl: string | null; createdAt: string; readAt: string | null;
  reactions?: { emoji: string; actorId: string }[];
};
type Conversation = {
  friendId: string; name: string; username: string | null; avatarUrl: string | null;
  unread: number; latest: { id: string; senderId: string; body: string; createdAt: string } | null;
};
type Section = "chats" | "friends" | "find" | "requests" | "groups" | "alerts";
type CallRequest = { peerId: string; mode: "VOICE" | "VIDEO"; nonce: number } | null;

function avatar(name: string, src: string | null, size = "size-11") {
  return <span className={`${size} relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-600 to-slate-800 text-sm font-bold text-white`}>
    {src ? <img src={src} alt="" className="size-full object-cover" /> : name.slice(0, 1).toUpperCase()}
  </span>;
}
function timestamp(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function Counter({ value }: { value: number }) {
  return value > 0 ? <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-cyan-500 px-1.5 py-0.5 text-[11px] font-bold text-slate-950" aria-label={`${value} unread`}>{value > 99 ? "99+" : value}</span> : null;
}

export function CommunityV3({ initial, userId }: { initial: SocialState; userId: string }) {
  const [social, setSocial] = useState(initial);
  const [section, setSection] = useState<Section>("chats");
  const [selected, setSelected] = useState<string | null>(null);
  const [inbox, setInbox] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState(0);
  const [groupInvites, setGroupInvites] = useState(0);
  const [alertUnread, setAlertUnread] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [callRequest, setCallRequest] = useState<CallRequest>(null);

  const refreshSocial = useCallback(async () => {
    const r = await apiFetch<SocialState>("/api/social");
    if (r.data) setSocial(r.data);
  }, []);
  const refreshInbox = useCallback(async () => {
    const r = await apiFetch<{ conversations: Conversation[]; unread: number }>("/api/social/inbox");
    if (r.data) { setInbox(r.data.conversations); setUnread(r.data.unread); }
  }, []);
  const refreshExtras = useCallback(async () => {
    const [g, n] = await Promise.all([
      apiFetch<{ groups: { status: string }[] }>("/api/social/groups"),
      apiFetch<{ unread: number }>("/api/social/notifications"),
    ]);
    if (g.data) setGroupInvites(g.data.groups.filter(item => item.status === "INVITED").length);
    if (n.data) setAlertUnread(n.data.unread);
  }, []);
  useEffect(() => {
    void Promise.all([refreshSocial(), refreshInbox(), refreshExtras()]);
    // Lightweight polling: this is not yet a WebSocket delivery guarantee.
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void Promise.all([refreshSocial(), refreshInbox(), refreshExtras()]);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshSocial, refreshInbox, refreshExtras]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const load = async () => {
      const r = await apiFetch<{ messages: Message[] }>(`/api/social/messages?peer=${encodeURIComponent(selected)}`);
      if (cancelled) return;
      if (r.data) {
        setMessages(r.data.messages);
        void refreshInbox();
      } else if (r.error) setError(r.error.message);
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 4000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selected, refreshInbox]);

  const friend = social.friends.find(item => item.other.id === selected)?.other;
  const tabs = [
    { key: "chats" as const, name: "Messages", icon: MessageCircle, count: unread },
    { key: "friends" as const, name: "Friends", icon: Users, count: 0 },
    { key: "find" as const, name: "Find a player", icon: Search, count: 0 },
    { key: "requests" as const, name: "Requests", icon: UserPlus, count: social.incoming.length },
    { key: "groups" as const, name: "Groups", icon: UsersRound, count: groupInvites },
    { key: "alerts" as const, name: "Notifications", icon: Bell, count: alertUnread },
  ];

  function openChat(peerId: string) {
    setSection("chats"); setSelected(peerId); setMessages([]); setError(""); setNotice("");
  }
  async function lookup(event: React.FormEvent) {
    event.preventDefault(); setError(""); setResults([]); setSearchPerformed(true);
    const value = search.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(value)) {
      setError("Enter an exact public username, 3–24 letters, numbers or underscores."); return;
    }
    const r = await apiFetch<{ players: SearchResult[] }>(`/api/social?username=${encodeURIComponent(value)}`);
    if (r.error) setError(r.error.message); else setResults(r.data?.players ?? []);
  }
  async function friendAction(method: "POST" | "PATCH" | "DELETE", path: string, payload: Record<string, string>, success: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    const suffix = method === "DELETE" ? `?userId=${encodeURIComponent(payload.userId ?? "")}` : "";
    const r = await apiFetch(path + suffix, { method, ...(method === "DELETE" ? {} : { body: JSON.stringify(payload) }) });
    if (r.error) setError(r.error.message);
    else {
      setNotice(success);
      if (path.includes("blocks") && payload.userId === selected) { setSelected(null); setMessages([]); }
      await Promise.all([refreshSocial(), refreshInbox(), refreshExtras()]);
    }
    setBusy(false);
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || busy || !(body.trim() || mediaUrl.trim())) return;
    setBusy(true); setError("");
    const r = await apiFetch<{ message: Message }>("/api/social/messages", {
      method: "POST", body: JSON.stringify({ recipientId: selected, body, mediaUrl: mediaUrl || undefined }),
    });
    if (r.error) setError(r.error.message);
    else {
      setBody(""); setMediaUrl("");
      if (r.data?.message) setMessages(items => [...items, { ...r.data!.message, reactions: [] }]);
      void refreshInbox();
    }
    setBusy(false);
  }
  async function react(id: string, emoji: string) {
    const r = await apiFetch("/api/social/reactions", {
      method: "POST", body: JSON.stringify({ kind: "DIRECT", messageId: id, emoji }),
    });
    if (r.error) setError(r.error.message);
    else if (selected) {
      const response = await apiFetch<{ messages: Message[] }>(`/api/social/messages?peer=${encodeURIComponent(selected)}`);
      if (response.data) setMessages(response.data.messages);
    }
  }
  const unreadMap = new Map(inbox.map(item => [item.friendId, item.unread]));

  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.19em] text-accent">SIMVERSE / Community</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Friends & Messages</h1>
        <p className="mt-1 text-sm text-secondary">Your conversations, calls and community in one place.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => void Promise.all([refreshSocial(), refreshInbox(), refreshExtras()])}>
        <RefreshCw className="size-4" /> Refresh
      </Button>
    </div>

    {error && <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">{notice}</div>}

    <div className="grid min-h-[68vh] min-w-0 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-xl lg:grid-cols-[218px_minmax(0,1fr)]">
      <nav aria-label="Friends and Messages sections" className="flex gap-1 overflow-x-auto border-b border-border bg-background/40 p-2 lg:flex-col lg:gap-2 lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3">
        {tabs.map(tab => <button key={tab.key} type="button" onClick={() => { setSection(tab.key); setError(""); setNotice(""); }}
          aria-current={section === tab.key ? "page" : undefined}
          className={`flex min-w-fit items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-surface-hover lg:w-full ${section === tab.key ? "bg-accent-soft text-accent" : "text-secondary"}`}>
          <tab.icon className="size-4 shrink-0" />
          <span className="whitespace-nowrap">{tab.name}</span>
          <Counter value={tab.count} />
        </button>)}
      </nav>

      <main className="min-w-0">
        {section === "chats" && <div className="grid min-h-[66vh] min-w-0 md:grid-cols-[minmax(220px,0.37fr)_minmax(0,1fr)]">
          <aside className={`min-w-0 border-r border-border ${selected ? "hidden md:block" : ""}`}>
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">Conversations <span className="text-xs text-muted">({inbox.length})</span></h2>
              <p className="mt-1 text-xs text-secondary">Select a friend to open a chat.</p>
            </div>
            <div className="max-h-[66vh] overflow-y-auto p-2">
              {inbox.map(c => <button key={c.friendId} type="button" onClick={() => openChat(c.friendId)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-surface-hover ${selected === c.friendId ? "bg-accent-soft" : ""}`}>
                {avatar(c.name, c.avatarUrl)}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-sm font-bold">{c.name}</span><span className="ml-auto shrink-0 text-[10px] text-muted">{timestamp(c.latest?.createdAt)}</span></span>
                  <span className="mt-1 block truncate text-xs text-secondary">{c.latest ? (c.latest.senderId === userId ? "You: " : "") + c.latest.body : "Start a conversation"}</span>
                </span>
                <Counter value={c.unread} />
              </button>)}
              {!inbox.length && <p className="p-5 text-sm text-secondary">No friends yet. Use Find a player to send an invitation.</p>}
            </div>
          </aside>
          <section aria-label="Conversation" className={`min-w-0 ${selected ? "" : "hidden md:block"}`}>
            {friend ? <div className="flex h-full min-h-[66vh] min-w-0 flex-col">
              <header className="flex items-center gap-3 border-b border-border p-3">
                <button type="button" aria-label="Back to conversations" onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-surface-hover md:hidden"><ChevronLeft className="size-5" /></button>
                {avatar(friend.displayName, friend.avatarUrl, "size-10")}
                <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{friend.displayName}</h2><p className="truncate text-xs text-secondary">@{friend.playerIdentity?.username ?? "simverse"}</p></div>
                <button type="button" aria-label={`Voice call ${friend.displayName}`} title="Voice call" onClick={() => setCallRequest({peerId: friend.id, mode: "VOICE", nonce: Date.now()})}
                  className="rounded-full p-3 text-accent hover:bg-accent-soft"><Phone className="size-5" /></button>
                <button type="button" aria-label={`Video call ${friend.displayName}`} title="Video call" onClick={() => setCallRequest({peerId: friend.id, mode: "VIDEO", nonce: Date.now()})}
                  className="rounded-full p-3 text-accent hover:bg-accent-soft"><Video className="size-5" /></button>
                <button type="button" aria-label="Block friend" title="Block friend" onClick={() => void friendAction("POST", "/api/social/blocks", {userId: friend.id}, "Friend blocked.")}
                  className="rounded-full p-2 text-secondary hover:bg-surface-hover"><Ban className="size-4" /></button>
              </header>
              <div aria-live="polite" className="flex min-h-[320px] max-h-[58vh] flex-1 flex-col gap-3 overflow-y-auto bg-background/30 p-4">
                {!messages.length && <p className="m-auto text-center text-sm text-secondary">Start your conversation with {friend.displayName}.</p>}
                {messages.map(msg => <div key={msg.id} className={`max-w-[87%] self-start rounded-2xl p-3 text-sm shadow-sm ${msg.senderId === userId ? "self-end rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm border border-border bg-surface"}`}>
                  {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                  {msg.mediaUrl && <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-xs underline">Open shared media</a>}
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {(["👍", "❤️", "😂"] as const).map(emoji => <button key={emoji} type="button" aria-label={`React ${emoji}`} onClick={() => void react(msg.id, emoji)}
                      className="rounded-md border border-current/20 px-1.5 py-0.5 text-[11px]">{emoji} {msg.reactions?.filter(r => r.emoji === emoji).length ?? 0}</button>)}
                    <time className="ml-auto text-[10px] opacity-70">{timestamp(msg.createdAt)}</time>
                  </div>
                </div>)}
              </div>
              <form onSubmit={event => void send(event)} className="sticky bottom-0 space-y-2 border-t border-border bg-surface p-3">
                <input type="url" aria-label="Optional media link" placeholder="Optional public HTTPS photo/video link"
                  maxLength={2048} value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs" />
                <div className="flex items-center gap-2">
                  <input aria-label="Write a message" value={body} onChange={e => setBody(e.target.value)}
                    maxLength={1500} placeholder="Write a message…" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent" />
                  <Button disabled={busy || !(body.trim() || mediaUrl.trim())} type="submit"><Send className="size-4" /> Send</Button>
                </div>
              </form>
            </div> : <div className="grid min-h-[66vh] place-items-center p-8 text-center text-secondary">
              <div><MessageCircle className="mx-auto mb-3 size-12 text-accent" /><p className="font-semibold text-foreground">Your conversations</p><p className="mt-1 text-sm">Choose a friend to message or call.</p></div>
            </div>}
          </section>
        </div>}

        {section === "friends" && <div className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Friends ({social.friends.length})</h2>
          <p className="text-sm text-secondary">Choose a friend to open your private conversation.</p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {social.friends.map(f => <button key={f.id} type="button" onClick={() => openChat(f.other.id)}
              className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-accent">
              {avatar(f.other.displayName, f.other.avatarUrl)}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{f.other.displayName}</span><span className="block truncate text-xs text-secondary">@{f.other.playerIdentity?.username ?? "simverse"}</span></span>
              <Counter value={unreadMap.get(f.other.id) ?? 0} />
            </button>)}
          </div>
          {!social.friends.length && <p className="text-sm text-muted">You haven't added any friends yet.</p>}
          {social.blocked.length > 0 && <div className="space-y-2 border-t border-border pt-4">
            <h3 className="font-semibold">Blocked players</h3>
            {social.blocked.map(p => <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm">{p.displayName}</span>
              <Button size="sm" variant="secondary" onClick={() => void friendAction("DELETE", "/api/social/blocks", {userId:p.id}, "Player unblocked; send a new invitation to reconnect.")}>Unblock</Button>
            </div>)}
          </div>}
        </div>}

        {section === "find" && <div className="mx-auto max-w-xl space-y-4 p-5">
          <h2 className="text-lg font-semibold">Find a player</h2>
          <p className="text-sm text-secondary">Search the exact username of a public SIMVERSE player.</p>
          <form onSubmit={event => void lookup(event)} className="flex gap-2">
            <input aria-label="Search public username" value={search} onChange={e => { setSearch(e.target.value); setSearchPerformed(false); }}
              placeholder="Enter username" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm" />
            <Button type="submit"><Search className="size-4" /> Find</Button>
          </form>
          {searchPerformed && !error && !results.length && <p className="text-sm text-muted">No matching public player found.</p>}
          {results.map(p => <div key={p.userId} className="flex items-center gap-3 rounded-xl border border-border p-3">
            {avatar(p.user.displayName, p.user.avatarUrl)}
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.user.displayName}</p><p className="text-xs text-secondary">@{p.username}</p></div>
            <Button size="sm" disabled={busy || social.blockedIds.includes(p.userId) || social.friends.some(f => f.other.id === p.userId)}
              onClick={() => void friendAction("POST", "/api/social/friends", {userId:p.userId}, "Friend request sent.")}>
              <UserPlus className="size-4" /> Invite
            </Button>
          </div>)}
        </div>}

        {section === "requests" && <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Friend requests <span className="text-sm text-accent">({social.incoming.length} pending)</span></h2>
          {social.incoming.map(f => <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
            {avatar(f.other.displayName, f.other.avatarUrl)}
            <div className="min-w-0 flex-1"><p className="font-semibold">{f.other.displayName}</p><p className="text-xs text-secondary">Wants to connect</p></div>
            <Button size="sm" disabled={busy} onClick={() => void friendAction("PATCH", "/api/social/friends", {id:f.id,action:"ACCEPT"}, "Friend request accepted.")}><Check className="size-4" /> Accept</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void friendAction("PATCH", "/api/social/friends", {id:f.id,action:"REMOVE"}, "Request declined.")}><X className="size-4" /> Decline</Button>
          </div>)}
          {!social.incoming.length && <p className="text-sm text-muted">No new requests.</p>}
          <h3 className="border-t border-border pt-4 text-sm font-semibold">Sent invitations</h3>
          {social.outgoing.map(f => <div key={f.id} className="flex items-center justify-between rounded-xl border border-border p-3">
            <span className="text-sm">{f.other.displayName} <span className="text-muted">· Pending</span></span>
            <Button size="sm" variant="ghost" onClick={() => void friendAction("PATCH", "/api/social/friends", {id:f.id,action:"REMOVE"}, "Invitation cancelled.")}>Cancel</Button>
          </div>)}
          {!social.outgoing.length && <p className="text-sm text-muted">No sent invitations.</p>}
        </div>}

        {section === "groups" && <div className="p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2"><UsersRound className="size-5 text-accent" /><h2 className="text-lg font-semibold">Group messaging</h2><Counter value={groupInvites} /></div>
          <CommunityExtras view="groups" userId={userId} friends={social.friends} />
        </div>}
        {section === "alerts" && <div className="p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2"><Mail className="size-5 text-accent" /><h2 className="text-lg font-semibold">Notifications</h2><Counter value={alertUnread} /></div>
          <CommunityExtras view="notifications" userId={userId} friends={social.friends} onUnreadChange={setAlertUnread} />
        </div>}
      </main>
    </div>
    <PeerCallDock userId={userId} friends={social.friends.map(f => ({id:f.other.id,name:f.other.displayName}))} request={callRequest} />
    <p className="flex items-center gap-2 text-xs text-muted"><Clock3 className="size-3.5" /> Messages refresh every few seconds while this page is open. Live sockets and push notifications are later milestones.</p>
  </div>;
}
