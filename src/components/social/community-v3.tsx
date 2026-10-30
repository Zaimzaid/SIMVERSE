"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Ban, Bell, Check, ChevronLeft, Mail, MessageCircle, Phone,
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
  mediaUrl: string | null; createdAt: string; deliveredAt: string | null; readAt: string | null;
  reactions?: { emoji: string; actorId: string }[];
};
type Conversation = {
  friendId: string; name: string; username: string | null; avatarUrl: string | null;
  unread: number; latest: { id: string; senderId: string; body: string; createdAt: string } | null;
};
type Section = "chats" | "friends" | "find" | "requests" | "groups" | "alerts";
type CallRequest = { peerId: string; mode: "VOICE" | "VIDEO"; nonce: number } | null;

function mergeMessages(previous: Message[], incoming: Message[]): Message[] {
  const unique = new Map<string, Message>(previous.map(message => [message.id, message]));
  for (const message of incoming) unique.set(message.id, message);
  return [...unique.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function avatar(name: string, src: string | null, size = "size-11") {
  return <span className={`${size} relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-600 to-slate-800 text-sm font-bold text-white`}>
    {src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-full object-cover" />
    ) : name.slice(0, 1).toUpperCase()}
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

export function CommunityV3({ initial, userId, initialPeerId = null }: { initial: SocialState; userId: string; initialPeerId?: string | null }) {
  const [social, setSocial] = useState(initial);
  const [section, setSection] = useState<Section>("chats");
  const [selected, setSelected] = useState<string | null>(initialPeerId);
  const selectedRef = useRef<string | null>(null);
  const chatReloadRef = useRef<(() => void) | null>(null);
  const pendingSendRef = useRef<{ recipientId: string; body: string; mediaUrl?: string; clientId: string } | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "fallback">("connecting");
  const [inbox, setInbox] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState(0);
  const [groupInvites, setGroupInvites] = useState(0);
  const [alertUnread, setAlertUnread] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [search, setSearch] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [callRequest, setCallRequest] = useState<CallRequest>(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const refreshSocial = useCallback(async () => {
    const r = await apiFetch<SocialState>("/api/social");
    if (r.data) setSocial(r.data);
  }, []);
  const refreshInbox = useCallback(async () => {
    const r = await apiFetch<{ conversations: Conversation[]; unread: number; pendingDeliveryIds: string[] }>("/api/social/inbox");
    if (r.data) {
      setInbox(r.data.conversations); setUnread(r.data.unread);
      // A message is "Delivered" only after the receiving browser confirms it.
      // This is separate from opening a conversation ("Read").
      if (r.data.pendingDeliveryIds.length) {
        void apiFetch("/api/social/delivery", {
          method: "POST",
          body: JSON.stringify({ messageIds: r.data.pendingDeliveryIds }),
        });
      }
    }
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
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshSocial, refreshInbox, refreshExtras]);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      setConnection("fallback");
      return;
    }
    const events = new EventSource("/api/social/events");
    const onSync = () => {
      if (document.visibilityState !== "visible") return;
      void Promise.all([refreshSocial(), refreshInbox(), refreshExtras()]);
      chatReloadRef.current?.();
    };
    events.addEventListener("sync", onSync);
    events.onopen = () => setConnection("live");
    events.onerror = () => setConnection("fallback");
    const onVisible = () => {
      if (document.visibilityState === "visible") onSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      events.removeEventListener("sync", onSync);
      document.removeEventListener("visibilitychange", onVisible);
      events.close();
    };
  }, [refreshSocial, refreshInbox, refreshExtras]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    let firstPage = true;
    const load = async () => {
      const r = await apiFetch<{ messages: Message[] }>(`/api/social/messages?peer=${encodeURIComponent(selected)}`);
      if (cancelled) return;
      if (r.data) {
        const latest = r.data.messages;
        // Polling must not discard older pages the player already loaded.
        setMessages(existing => mergeMessages(existing, latest));
        if (firstPage) {
          setHasOlder(latest.length === 100);
          firstPage = false;
        }
        void refreshInbox();
      } else if (r.error) setError(r.error.message);
    };
    chatReloadRef.current = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    // Safety fallback during SSE outages or constrained hosting.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => {
      cancelled = true;
      chatReloadRef.current = null;
      window.clearInterval(timer);
    };
  }, [selected, refreshInbox]);

  const friend = social.friends.find(item => item.other.id === selected)?.other;
  const tabs = [
    { key: "chats" as const, name: "Chats", icon: MessageCircle, count: unread },
    { key: "friends" as const, name: "Friends", icon: Users, count: 0 },
    { key: "find" as const, name: "Find Player", icon: Search, count: 0 },
    { key: "requests" as const, name: "Requests", icon: UserPlus, count: social.incoming.length },
    { key: "groups" as const, name: "Groups", icon: UsersRound, count: groupInvites },
    { key: "alerts" as const, name: "Alerts", icon: Bell, count: alertUnread },
  ];

  function openChat(peerId: string) {
    setSection("chats"); setSelected(peerId); setMessages([]); setHasOlder(false);
    pendingSendRef.current = null; setError(""); setNotice("");
  }
  async function loadOlder() {
    if (!selected || loadingOlder || !hasOlder || !messages.length) return;
    setLoadingOlder(true); setError("");
    const oldest = messages[0];
    if (!oldest) { setLoadingOlder(false); return; }
    const oldestId = oldest.id;
    const url = `/api/social/messages?peer=${encodeURIComponent(selected)}&before=${encodeURIComponent(oldestId)}`;
    const r = await apiFetch<{ messages: Message[] }>(url);
    if (selectedRef.current !== selected) {
      setLoadingOlder(false);
      return;
    }
    if (r.data) {
      const older = r.data.messages;
      setMessages(current => mergeMessages(current, older));
      setHasOlder(older.length === 100);
      void refreshInbox();
    } else if (r.error) setError(r.error.message);
    setLoadingOlder(false);
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
    const current = { recipientId: selected, body: body.trim(), mediaUrl: mediaUrl || undefined };
    const previous = pendingSendRef.current;
    const clientId = previous &&
      previous.recipientId === current.recipientId &&
      previous.body === current.body && previous.mediaUrl === current.mediaUrl
      ? previous.clientId : crypto.randomUUID();
    const payload = { ...current, clientId };
    pendingSendRef.current = payload;
    const r = await apiFetch<{ message: Message }>("/api/social/messages", {
      method: "POST", body: JSON.stringify(payload),
    });
    if (r.error) setError(r.error.message + " Your message was kept; press Send to retry.");
    else {
      pendingSendRef.current = null;
      setBody(""); setMediaUrl("");
      if (r.data?.message) setMessages(items => mergeMessages(items, [{ ...r.data!.message, reactions: [] }]));
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
      if (response.data) setMessages(current => mergeMessages(current, response.data!.messages));
    }
  }
  const unreadMap = new Map(inbox.map(item => [item.friendId, item.unread]));


  const [chatQuery, setChatQuery] = useState("");
  const [chatFilter, setChatFilter] = useState<"all" | "unread">("all");
  const filteredConversations = inbox.filter(c => {
    if (chatFilter === "unread" && !c.unread) return false;
    const q = chatQuery.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.username ?? "").toLowerCase().includes(q);
  });
  const primaryTabs = tabs.filter(tab => tab.key === "chats" || tab.key === "friends" ||
    tab.key === "requests" || tab.key === "groups");
  function selectSection(next: Section) {
    setSection(next); setSelected(null); setMessages([]); setError(""); setNotice("");
  }

  return <div className="min-w-0 space-y-4">
    {error && <div role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
    {notice && <div role="status" className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">{notice}</div>}
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent"><MessageCircle className="size-4"/> Your community</p>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Friends &amp; Messages</h1>
        <p className="mt-1 text-sm leading-6 text-secondary">Catch up with friends, meet players and stay connected—right here.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" title="Notifications" aria-label="View notifications" onClick={() => selectSection("alerts")}
          className="relative grid size-10 place-items-center rounded-xl border border-border text-secondary hover:bg-surface-hover hover:text-foreground">
          <Bell className="size-5"/>{alertUnread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">{alertUnread > 99 ? "99+" : alertUnread}</span>}
        </button>
        <button type="button" title="Refresh" aria-label="Refresh messages and community"
          onClick={() => void Promise.all([refreshSocial(),refreshInbox(),refreshExtras()])}
          className="grid size-10 place-items-center rounded-xl border border-border text-secondary hover:bg-surface-hover hover:text-foreground">
          <RefreshCw className="size-5"/>
        </button>
      </div>
    </header>
    <div className="grid min-w-0 overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-xl lg:min-h-[700px] lg:grid-cols-[minmax(270px,345px)_minmax(0,1fr)]">
      <aside aria-label="Messaging navigation and conversations"
        className={section === "chats" && friend
          ? "hidden min-w-0 flex-col border-r border-border bg-surface-elevated/40 lg:flex"
          : "flex min-w-0 flex-col border-b border-border bg-surface-elevated/40 lg:border-b-0 lg:border-r"}>
        <div className="border-b border-border px-4 pb-4 pt-5 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{section === "chats" ? "Your inbox" : section === "friends" ? "Your connections" : section === "find" ? "Discover players" : section === "requests" ? "Friend requests" : section === "groups" ? "Your groups" : "Activity"}</h2>
              <p className="mt-1 text-sm leading-5 text-secondary">{section === "chats"
                ? (unread ? unread + " unread messages" : "You're all caught up")
                : section === "friends" ? (social.friends.length ? social.friends.length + " friends" : "Make your first connection")
                : section === "requests" ? (social.incoming.length ? social.incoming.length + " invitations to review" : "Manage your invitations")
                : section === "groups" ? "Create and join conversations"
                : section === "find" ? "Connect with new people" : "Your latest updates"}</p>
            </div>
            <button type="button" title="Find a player" aria-label="Find a player"
              onClick={() => selectSection("find")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-xs font-semibold text-accent-foreground hover:opacity-90">
              <UserPlus className="size-4"/> Find player
            </button>
          </div>
          <nav aria-label="Messaging sections" className="mt-5 grid grid-cols-4 gap-1 rounded-xl bg-background/70 p-1">
            {primaryTabs.map(tab => {
              const Icon = tab.icon;
              return <button type="button" key={tab.key} aria-pressed={section === tab.key}
                onClick={() => selectSection(tab.key)}
                className={section === tab.key
                  ? "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg bg-surface px-1 py-2.5 text-accent shadow-sm ring-1 ring-border"
                  : "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-secondary hover:bg-surface-hover hover:text-foreground"}>
                <span className="relative"><Icon className="size-4"/>{tab.count > 0 && <span className="absolute -right-2 -top-1 size-2 rounded-full bg-accent"/>}</span>
                <span className="truncate text-xs font-semibold">{tab.name}</span>
                <span className="sr-only">{tab.count ? "(" + tab.count + " pending)" : ""}</span>
              </button>;
            })}
          </nav>
        </div>
        {section === "chats" && <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 px-4 pb-3 pt-4 sm:px-5">
            <label className="relative block">
              <span className="sr-only">Search your conversations</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"/>
              <input value={chatQuery} onChange={e => setChatQuery(e.target.value)}
                placeholder="Search your conversations"
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"/>
            </label>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5" role="group" aria-label="Filter conversations">
                {(["all","unread"] as const).map(filter =>
                  <button key={filter} type="button" aria-pressed={chatFilter === filter}
                    onClick={() => setChatFilter(filter)}
                    className={chatFilter === filter ? "rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent" : "rounded-full px-3 py-1.5 text-xs text-secondary hover:bg-surface-hover"}>
                    {filter === "all" ? "All chats" : "Unread"}
                  </button>)}
              </div>
              <span className="text-xs text-secondary">{filteredConversations.length} shown</span>
            </div>
          </div>
          <div className="max-h-[58vh] min-h-[220px] flex-1 space-y-1 overflow-y-auto px-2 pb-4 sm:px-3 lg:max-h-[65vh]">
            {filteredConversations.map(c =>
              <button key={c.friendId} type="button" aria-current={selected === c.friendId ? "true" : undefined}
                onClick={() => openChat(c.friendId)}
                className={selected === c.friendId
                  ? "flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-3 text-left"
                  : "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:bg-surface-hover"}>
                {avatar(c.name,c.avatarUrl)}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={c.unread ? "truncate text-sm font-bold" : "truncate text-sm font-semibold"}>{c.name}</span>
                    {c.latest && <time className="ml-auto shrink-0 text-[10px] text-muted">{timestamp(c.latest.createdAt)}</time>}
                  </span>
                  <span className="mt-1 block truncate text-xs text-secondary">{c.latest
                    ? (c.latest.senderId === userId ? "You: " : "") + c.latest.body
                    : "Say hello to @" + (c.username ?? "player")}</span>
                </span>
                <Counter value={c.unread}/>
              </button>)}
            {!filteredConversations.length && <div className="mx-2 my-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent"><MessageCircle className="size-7"/></div>
              <p className="text-base font-semibold">{inbox.length ? "No matching chats" : "Ready for your first chat?"}</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-secondary">{inbox.length ? "Try a different name or switch to All chats." : "Find a player, send a friend request and say hello once they accept."}</p>
              {!inbox.length && <button type="button" onClick={() => selectSection("find")}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent hover:bg-surface-hover lg:hidden"><UserPlus className="size-4"/> Find a player</button>}
            </div>}
          </div>
        </div>}
        {section !== "chats" && <div className="hidden flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center lg:flex">
          <div className="grid size-16 place-items-center rounded-2xl border border-accent/20 bg-accent-soft text-accent"><Users className="size-8"/></div>
          <p className="text-base font-semibold">Your community is here</p>
          <p className="max-w-[240px] text-sm leading-6 text-secondary">Open a section to see friends, invitations or group conversations.</p>
          <button type="button" onClick={() => selectSection("chats")}
            className="min-h-11 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-accent hover:bg-surface-hover">Back to chats</button>
        </div>}
        <div className="hidden items-center gap-2 border-t border-border px-5 py-3 text-xs text-secondary lg:flex">
          <span className={connection === "live" ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-warning"}/>
          {connection === "live" ? "Connected" : connection === "fallback" ? "Reconnecting · refresh is on" : "Connecting"}
        </div>
      </aside>
      <main aria-label="Messaging workspace" className={section === "chats" && !friend ? "hidden min-w-0 flex-col lg:flex" : "flex min-w-0 flex-col"}>
        {section === "chats" && (friend ? <section aria-label="Conversation" className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-[62vh] min-w-0 flex-1 flex-col lg:min-h-[700px]">
            <header className="flex items-center gap-2 border-b border-border bg-surface-elevated/60 px-3 py-4 sm:gap-3 sm:px-6">
              <button type="button" aria-label="Back to recent conversations" title="Back to recent conversations"
                onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-surface-hover lg:hidden">
                <ChevronLeft className="size-5" />
              </button>
              {avatar(friend.displayName, friend.avatarUrl, "size-10")}
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{friend.displayName}</h2>
                <p className="truncate text-xs text-secondary">@{friend.playerIdentity?.username ?? "simverse"}</p>
                {friend.playerIdentity?.username && <Link
                  href={"/u/" + encodeURIComponent(friend.playerIdentity.username)}
                  className="mt-1 inline-block text-xs font-semibold text-accent hover:underline">View profile</Link>}
              </div>
              <button type="button" aria-label={`Voice call ${friend.displayName}`} title="Voice call"
                onClick={() => setCallRequest({peerId: friend.id, mode: "VOICE", nonce: Date.now()})}
                className="grid size-10 shrink-0 place-items-center rounded-full text-accent hover:bg-accent-soft">
                <Phone className="size-5" />
              </button>
              <button type="button" aria-label={`Video call ${friend.displayName}`} title="Video call"
                onClick={() => setCallRequest({peerId: friend.id, mode: "VIDEO", nonce: Date.now()})}
                className="grid size-10 shrink-0 place-items-center rounded-full text-accent hover:bg-accent-soft">
                <Video className="size-5" />
              </button>
              <button type="button" aria-label="Block friend" title="Block friend"
                onClick={() => void friendAction("POST", "/api/social/blocks", {userId: friend.id}, "Friend blocked.")}
                className="grid size-9 shrink-0 place-items-center rounded-full text-secondary hover:bg-surface-hover">
                <Ban className="size-4" />
              </button>
            </header>
            <div aria-live="polite" className="flex min-h-[370px] max-h-[68vh] flex-1 flex-col gap-4 overflow-y-auto bg-background/40 p-4 sm:p-7">
              {hasOlder && messages.length > 0 && <button type="button" disabled={loadingOlder}
                onClick={() => void loadOlder()}
                className="self-center rounded-lg border border-border px-4 py-2 text-xs font-semibold text-accent hover:bg-surface-hover disabled:opacity-50">
                {loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}
              </button>}
              {!messages.length && <div className="m-auto max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-6 text-center"><MessageCircle className="mx-auto size-8 text-accent"/><h3 className="font-semibold">Say hello to {friend.displayName}</h3><p className="text-sm text-secondary">Your conversation starts here. Send a friendly message to get going.</p></div>}
              {messages.map(msg => <div key={msg.id} className={`max-w-[88%] self-start rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[75%] ${msg.senderId === userId ? "self-end rounded-br-md bg-accent text-accent-foreground" : "rounded-bl-md border border-border bg-surface-elevated"}`}>
                {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                {msg.mediaUrl && <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-xs underline">Open shared media</a>}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {(["👍", "❤️", "😂"] as const).map(emoji => <button key={emoji} type="button" aria-label={`React ${emoji}`} onClick={() => void react(msg.id, emoji)}
                    className="rounded-md border border-current/20 px-1.5 py-0.5 text-[11px]">{emoji} {msg.reactions?.filter(r => r.emoji === emoji).length ?? 0}</button>)}
                  <time className="ml-auto text-[10px] opacity-70">{timestamp(msg.createdAt)}</time>
                  {msg.senderId === userId && <span className="text-[10px] opacity-75">{msg.readAt ? "Read" : msg.deliveredAt ? "Delivered" : "Sent"}</span>}
                </div>
              </div>)}
            </div>
            <form onSubmit={event => void send(event)} className="sticky bottom-0 space-y-3 border-t border-border bg-surface p-3 sm:px-6 sm:py-4">
              <details className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-secondary hover:text-accent">Add photo or video link (optional)</summary>
                <input type="url" aria-label="Optional media link" placeholder="Paste a public HTTPS photo or video link"
                  maxLength={2048} value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
              </details>
              <div className="flex min-w-0 items-center gap-2">
                <textarea aria-label="Write a message" value={body} onChange={e => setBody(e.target.value)}
                  maxLength={1500} rows={2} placeholder="Write a message…"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-accent" />
                <Button disabled={busy || !(body.trim() || mediaUrl.trim())} type="submit"><Send className="size-4" /> Send</Button>
              </div>
            </form>
          </div>
        </section> : <div className="hidden min-h-[650px] flex-1 flex-col items-center justify-center bg-background/35 px-6 py-14 text-center lg:flex">
          <div className="mb-7 grid size-24 place-items-center rounded-[1.75rem] border border-accent/20 bg-accent-soft text-accent shadow-sm"><MessageCircle className="size-11" strokeWidth={1.6}/></div>
          <h2 className="max-w-lg text-2xl font-bold tracking-tight xl:text-3xl">{social.friends.length ? "Pick up where you left off" : "Welcome to your SIMVERSE community"}</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-secondary">{social.friends.length
            ? "Choose a conversation on the left to catch up with your friends."
            : "Get to know other players, build friendships and start conversations at your own pace."}</p>
          {!social.friends.length && <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-3 text-left">
            {[
              { step: "01", label: "Find a player" },
              { step: "02", label: "Send a request" },
              { step: "03", label: "Start chatting" },
            ].map(item => <div key={item.step} className="rounded-xl border border-border bg-surface-elevated/50 px-3 py-4">
              <span className="text-xs font-bold text-accent">{item.step}</span>
              <p className="mt-2 text-sm font-medium leading-5">{item.label}</p>
            </div>)}
          </div>}
          {!social.friends.length && <button type="button" onClick={() => selectSection("find")}
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90">
            <UserPlus className="size-4"/> Find your first friend
          </button>}
          {social.friends.length > 0 && <p className="mt-8 text-sm text-muted">Your conversations are ready when you are.</p>}
          <p className="mt-8 text-xs text-muted">Messaging works without loading the 3D world.</p>
        </div>)}
        {section === "friends" && <div className="space-y-5 p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Friends ({social.friends.length})</h2>
          <p className="text-sm leading-6 text-secondary">{social.friends.length
            ? "Choose a friend to pick up your conversation."
            : "Good conversations start with one connection."}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {social.friends.map(f => <div key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-elevated/50 p-3 transition-colors hover:border-accent">
              <button type="button" onClick={() => openChat(f.other.id)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-accent-soft">
                {avatar(f.other.displayName, f.other.avatarUrl)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.other.displayName}</span>
                  <span className="block truncate text-xs text-secondary">@{f.other.playerIdentity?.username ?? "simverse"}</span>
                </span>
                <Counter value={unreadMap.get(f.other.id) ?? 0} />
              </button>
              {f.other.playerIdentity?.username && <Link
                href={"/u/" + encodeURIComponent(f.other.playerIdentity.username)}
                className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-accent hover:bg-accent-soft">
                View profile
              </Link>}
            </div>)}
          </div>
          {!social.friends.length && <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-border bg-surface-elevated/45 px-5 py-9 text-center sm:px-8 sm:py-12">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-accent/20 bg-accent-soft text-accent"><Users className="size-8"/></div>
            <h3 className="text-xl font-semibold">Meet your first SIMVERSE friend</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-secondary">Search for someone by their public username, send a request and start messaging when they accept.</p>
            <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
              <button type="button" onClick={() => selectSection("find")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90">
                <UserPlus className="size-4"/> Find a player
              </button>
              {social.incoming.length > 0 && <button type="button" onClick={() => selectSection("requests")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-surface-hover">
                <Mail className="size-4"/> View {social.incoming.length} pending {social.incoming.length === 1 ? "request" : "requests"}
              </button>}
            </div>
          </div>}
          {social.blocked.length > 0 && <div className="space-y-2 border-t border-border pt-4">
            <h3 className="font-semibold">Blocked players</h3>
            {social.blocked.map(p => <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm">{p.displayName}</span>
              <Button size="sm" variant="secondary" onClick={() => void friendAction("DELETE", "/api/social/blocks", {userId:p.id}, "Player unblocked; send a new invitation to reconnect.")}>Unblock</Button>
            </div>)}
          </div>}
        </div>}

        {section === "find" && <div className="mx-auto max-w-2xl space-y-5 p-5 sm:p-8">
          <h2 className="text-lg font-semibold">Find a player</h2>
          <p className="text-sm text-secondary">Enter an exact public SIMVERSE username to connect. If you don’t know it, ask the player to share their username first.</p>
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

        {section === "requests" && <div className="space-y-5 p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Friend requests <span className="text-sm text-accent">({social.incoming.length} pending)</span></h2>
          {social.incoming.map(f => <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
            {avatar(f.other.displayName, f.other.avatarUrl)}
            <div className="min-w-0 flex-1"><p className="font-semibold">{f.other.displayName}</p><p className="text-xs text-secondary">Wants to connect</p></div>
            <Button size="sm" disabled={busy} onClick={() => void friendAction("PATCH", "/api/social/friends", {id:f.id,action:"ACCEPT"}, "Friend request accepted.")}><Check className="size-4" /> Accept</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void friendAction("PATCH", "/api/social/friends", {id:f.id,action:"REMOVE"}, "Request declined.")}><X className="size-4" /> Decline</Button>
          </div>)}
          {!social.incoming.length && <p className="rounded-xl border border-border bg-surface-elevated/40 px-4 py-5 text-sm leading-6 text-secondary">No new invitations yet. When someone sends you a friend request, you can accept it here.</p>}
          <h3 className="border-t border-border pt-4 text-sm font-semibold">Sent invitations</h3>
          {social.outgoing.map(f => <div key={f.id} className="flex items-center justify-between rounded-xl border border-border p-3">
            <span className="text-sm">{f.other.displayName} <span className="text-muted">· Pending</span></span>
            <Button size="sm" variant="ghost" onClick={() => void friendAction("PATCH", "/api/social/friends", {id:f.id,action:"REMOVE"}, "Invitation cancelled.")}>Cancel</Button>
          </div>)}
          {!social.outgoing.length && <p className="text-sm text-muted">No sent invitations.</p>}
        </div>}

        {section === "groups" && <div className="p-4 sm:p-7">
          <div className="mb-4 flex items-center gap-2"><UsersRound className="size-5 text-accent" /><h2 className="text-lg font-semibold">Group messaging</h2><Counter value={groupInvites} /></div>
          <CommunityExtras view="groups" userId={userId} friends={social.friends} />
        </div>}
        {section === "alerts" && <div className="p-4 sm:p-7">
          <div className="mb-4 flex items-center gap-2"><Mail className="size-5 text-accent" /><h2 className="text-lg font-semibold">Notifications</h2><Counter value={alertUnread} /></div>
          <CommunityExtras view="notifications" userId={userId} friends={social.friends} onUnreadChange={setAlertUnread} />
        </div>}
      </main>
    </div>
    <PeerCallDock userId={userId} friends={social.friends.map(f => ({id:f.other.id,name:f.other.displayName}))} request={callRequest}/>
    <p className="flex items-center gap-2 px-1 text-xs text-muted lg:hidden">
      <span className={connection === "live" ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-warning"}/>
      {connection === "live" ? "Connected" : connection === "fallback" ? "Reconnecting; automatic refresh is on" : "Connecting…"}
    </p>
  </div>;
}
