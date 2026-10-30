"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronRight, Clock3, MessageCircle, Plus,
  RefreshCw, Search, Send, ShieldCheck, UserPlus, UsersRound, X,
} from "lucide-react";
import { apiFetch } from "@/lib/client/api";

type Friend = { id: string; other: { id: string; displayName: string } };
type Group = {
  id: string; title: string; ownerId: string; role: string;
  status: "ACTIVE" | "INVITED"; updatedAt: string; _count: { members: number };
};
type Member = { userId: string; role: string; status: string; user: { displayName: string } };
type Message = {
  id: string; groupId: string; senderId: string; body: string;
  mediaUrl: string | null; createdAt: string;
  sender: { displayName: string };
  reactions: { emoji: string; actorId: string }[];
};

function mergeMessages(previous: Message[], incoming: Message[]) {
  const map = new Map(previous.map(msg => [msg.id, msg]));
  for (const msg of incoming) map.set(msg.id, msg);
  return [...map.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function CommunityGroups({ userId, friends }: { userId: string; friends: Friend[] }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeGroup = groups.find(group => group.id === selected && group.status === "ACTIVE");
  const visibleGroups = groups.filter(group => group.title.toLowerCase().includes(query.trim().toLowerCase()));
  const pending = groups.filter(group => group.status === "INVITED");
  const joined = visibleGroups.filter(group => group.status === "ACTIVE");
  const availableFriends = friends.filter(friend =>
    friend.other.id !== userId && !members.some(member => member.userId === friend.other.id));

  const loadGroups = useCallback(async () => {
    const response = await apiFetch<{ groups: Group[] }>("/api/social/groups");
    if (response.data) {
      setGroups(response.data.groups);
      const current = selectedRef.current;
      if (current && !response.data.groups.some(group => group.id === current && group.status === "ACTIVE")) {
        selectedRef.current = null;
        setSelected(null);
        setMessages([]);
        setMembers([]);
      }
    } else if (response.error) setError(response.error.message);
    setLoadingGroups(false);
  }, []);

  const loadRoster = useCallback(async (groupId: string) => {
    const response = await apiFetch<{ members: Member[] }>(
      "/api/social/groups?groupId=" + encodeURIComponent(groupId),
    );
    if (selectedRef.current === groupId) {
      if (response.data) setMembers(response.data.members);
      else if (response.error) setError(response.error.message);
    }
  }, []);

  const loadHistory = useCallback(async (groupId: string, before?: string) => {
    const params = new URLSearchParams({ groupId });
    if (before) params.set("before", before);
    return apiFetch<{ messages: Message[] }>("/api/social/groups/messages?" + params);
  }, []);

  const refreshMessages = useCallback(async (groupId: string) => {
    const response = await loadHistory(groupId);
    if (selectedRef.current !== groupId) return;
    if (response.data) setMessages(current => mergeMessages(current, response.data!.messages));
    else if (response.error) setError(response.error.message);
  }, [loadHistory]);

  useEffect(() => {
    void loadGroups();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadGroups();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadGroups]);

  useEffect(() => {
    if (!activeGroup) return;
    const id = activeGroup.id;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshMessages(id);
    }, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadGroups();
        void refreshMessages(id);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeGroup?.id, loadGroups, refreshMessages]);

  function resetComposer() {
    setBody("");
    setMediaUrl("");
  }
  async function openGroup(id: string) {
    selectedRef.current = id;
    setSelected(id);
    setMessages([]);
    setMembers([]);
    setHasOlder(false);
    setShowMembers(false);
    setShowCreate(false);
    setShowInvite(false);
    setError("");
    setNotice("");
    const response = await loadHistory(id);
    if (selectedRef.current !== id) return;
    if (response.data) {
      setMessages(response.data.messages);
      setHasOlder(response.data.messages.length === 100);
    } else if (response.error) setError(response.error.message);
    void loadRoster(id);
  }
  function backToGroups() {
    selectedRef.current = null;
    setSelected(null);
    setMessages([]);
    setMembers([]);
    setShowInvite(false);
    setShowMembers(false);
    resetComposer();
    setError("");
  }
  async function loadOlder() {
    if (!activeGroup || loadingOlder || !hasOlder || !messages.length) return;
    const oldest = messages[0];
    if (!oldest) return;
    const groupId = activeGroup.id;
    setLoadingOlder(true);
    const response = await loadHistory(groupId, oldest.id);
    if (selectedRef.current === groupId) {
      if (response.data) {
        setMessages(current => mergeMessages(current, response.data!.messages));
        setHasOlder(response.data.messages.length === 100);
      } else if (response.error) setError(response.error.message);
    }
    setLoadingOlder(false);
  }

  async function groupAction(groupId: string, action: "ACCEPT" | "LEAVE") {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    const response = await apiFetch("/api/social/groups", {
      method: "PATCH", body: JSON.stringify({ id: groupId, action }),
    });
    if (response.error) setError(response.error.message);
    else {
      await loadGroups();
      if (action === "ACCEPT") {
        await openGroup(groupId);
        setNotice("You joined the group.");
      } else {
        if (selectedRef.current === groupId) backToGroups();
        setNotice("Invitation declined or group left.");
      }
    }
    setBusy(false);
  }

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !title.trim() || !invitees.length) return;
    setBusy(true); setError(""); setNotice("");
    const response = await apiFetch<{ group: { id: string } }>("/api/social/groups", {
      method: "POST", body: JSON.stringify({ title: title.trim(), invitees }),
    });
    if (response.error) setError(response.error.message);
    else {
      setTitle("");
      setInvitees([]);
      setShowCreate(false);
      await loadGroups();
      if (response.data?.group.id) await openGroup(response.data.group.id);
      setNotice("Group created. Your friends can join when they accept the invitation.");
    }
    setBusy(false);
  }

  async function inviteFriends(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !activeGroup || !invitees.length) return;
    const groupId = activeGroup.id;
    setBusy(true); setError(""); setNotice("");
    const response = await apiFetch("/api/social/groups", {
      method: "PATCH", body: JSON.stringify({ id: groupId, action: "INVITE", invitees }),
    });
    if (response.error) setError(response.error.message);
    else {
      setInvitees([]);
      setShowInvite(false);
      setNotice("Invitation sent. Friends will appear after they accept.");
      await Promise.all([loadGroups(), loadRoster(groupId)]);
    }
    setBusy(false);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!activeGroup || busy || !(body.trim() || mediaUrl.trim())) return;
    const groupId = activeGroup.id;
    setBusy(true); setError("");
    const response = await apiFetch<{ message: Message }>("/api/social/groups/messages", {
      method: "POST",
      body: JSON.stringify({ groupId, body: body.trim(), mediaUrl: mediaUrl.trim() || undefined }),
    });
    if (response.error) setError(response.error.message + " Your draft is still here.");
    else {
      if (selectedRef.current === groupId) resetComposer();
      await Promise.all([refreshMessages(groupId), loadGroups()]);
    }
    setBusy(false);
  }
  async function react(id: string, emoji: string) {
    if (!activeGroup || busy) return;
    const groupId = activeGroup.id;
    setBusy(true);
    const response = await apiFetch("/api/social/reactions", {
      method: "POST", body: JSON.stringify({ kind: "GROUP", messageId: id, emoji }),
    });
    if (response.error) setError(response.error.message);
    else await refreshMessages(groupId);
    setBusy(false);
  }

  function toggleFriend(id: string, checked: boolean) {
    setInvitees(current => checked ? [...current, id] : current.filter(value => value !== id));
  }
  function friendPicker(options: Friend[]) {
    return <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
      {options.map(friend => <label key={friend.other.id}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:border-accent">
        <input type="checkbox" checked={invitees.includes(friend.other.id)}
          onChange={event => toggleFriend(friend.other.id, event.target.checked)}
          className="size-4 accent-accent" />
        <span className="min-w-0 truncate">{friend.other.displayName}</span>
      </label>)}
    </div>;
  }
  return <section aria-label="SIMVERSE group conversations" className="space-y-4">
    {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">{notice}</p>}
    <div className="overflow-hidden rounded-2xl border border-border bg-surface lg:min-h-[540px] xl:grid xl:grid-cols-[minmax(205px,265px)_minmax(0,1fr)]">
      <div className={selected ? "hidden border-r border-border bg-surface-elevated/35 xl:block" : "border-r border-border bg-surface-elevated/35"}>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">Your groups</h3>
              <p className="mt-1 text-xs text-secondary">{groups.filter(g => g.status === "ACTIVE").length} joined · {pending.length} invitations</p>
            </div>
            <button type="button" onClick={() => { setShowCreate(value => !value); setInvitees([]); }}
              aria-expanded={showCreate} aria-label="Create a group"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
              <Plus className="size-4" /> New
            </button>
          </div>
          <label className="relative block">
            <span className="sr-only">Search your groups</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Search groups" className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm outline-none focus:border-accent" />
          </label>
        </div>

        {showCreate && <form onSubmit={event => void createGroup(event)}
          className="space-y-3 border-b border-border bg-accent-soft/30 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Create a group</h4>
            <button type="button" aria-label="Close new group form" onClick={() => setShowCreate(false)}><X className="size-5" /></button>
          </div>
          <p className="text-xs leading-5 text-secondary">Bring your friends together in a private conversation. Only invited friends can join.</p>
          <label className="block text-sm font-medium">Group name
            <input required minLength={2} maxLength={65} value={title} onChange={event => setTitle(event.target.value)}
              placeholder="e.g. SIMVERSE Builders"
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
          </label>
          <p className="text-sm font-medium">Invite friends <span className="font-normal text-secondary">(1–10)</span></p>
          {!friends.length ? <p className="text-sm leading-6 text-secondary">You need at least one accepted friend. Visit Friends or Find Player to connect first.</p>
            : friendPicker(friends)}
          <button type="submit" disabled={busy || !title.trim() || !invitees.length || invitees.length > 10}
            className="min-h-11 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
            Create group & invite
          </button>
        </form>}

        <div className="max-h-[62vh] min-h-40 space-y-4 overflow-y-auto p-3">
          {pending.length > 0 && <div className="space-y-2">
            <h4 className="px-2 text-xs font-semibold uppercase tracking-wider text-secondary">Invitations ({pending.length})</h4>
            {pending.map(group => <div key={group.id} className="rounded-xl border border-accent/25 bg-accent-soft/30 p-3">
              <p className="truncate text-sm font-semibold">{group.title}</p>
              <p className="mt-1 text-xs text-secondary">You have been invited</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void groupAction(group.id, "ACCEPT")}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground disabled:opacity-50">
                  <Check className="size-4" /> Join
                </button>
                <button type="button" disabled={busy} onClick={() => void groupAction(group.id, "LEAVE")}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-50">
                  Decline
                </button>
              </div>
            </div>)}
          </div>}
          <div className="space-y-1">
            <h4 className="px-2 text-xs font-semibold uppercase tracking-wider text-secondary">Conversations</h4>
            {joined.map(group => <button type="button" key={group.id} onClick={() => void openGroup(group.id)}
              aria-current={selected === group.id ? "true" : undefined}
              className={selected === group.id
                ? "flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-3 text-left"
                : "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left hover:bg-surface-hover"}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft font-semibold text-accent">
                {group.title.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{group.title}</span>
                <span className="mt-1 block text-xs text-secondary">{group._count.members} members & invited</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>)}
            {!loadingGroups && !joined.length && !pending.length && <div className="rounded-xl border border-border bg-surface p-5 text-center">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><UsersRound className="size-6" /></div>
              <p className="font-semibold">{groups.length ? "No matching groups" : "Create your first group"}</p>
              <p className="mt-2 text-sm leading-6 text-secondary">{groups.length ? "Try another search." : "Start a private space to chat, plan and create with friends."}</p>
              {!groups.length && <button type="button" onClick={() => setShowCreate(true)}
                className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-accent">Create group</button>}
            </div>}
            {loadingGroups && <p className="p-3 text-sm text-secondary">Loading your groups…</p>}
          </div>
        </div>
      </div>

      <div className={selected ? "min-w-0" : "hidden min-w-0 xl:block"}>
        {activeGroup ? <div className="flex min-h-[550px] flex-col">
          <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-elevated/40 p-3 sm:p-4">
            <button type="button" aria-label="Back to groups" title="Back to groups" onClick={backToGroups}
              className="grid size-10 place-items-center rounded-xl hover:bg-surface-hover xl:hidden"><ArrowLeft className="size-5" /></button>
            <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent"><UsersRound className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold">{activeGroup.title}</h3>
              <p className="text-xs text-secondary">{activeGroup._count.members} members & invited · Private group</p>
            </div>
            <button type="button" aria-expanded={showMembers}
              onClick={() => setShowMembers(value => !value)}
              className="min-h-10 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-surface-hover">Members</button>
            {activeGroup.role === "OWNER" && <button type="button" onClick={() => { setShowInvite(value => !value); setInvitees([]); }}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-surface-hover">
              <UserPlus className="size-4" /> Invite
            </button>}
            <button type="button" title="Refresh messages" aria-label="Refresh group messages"
              onClick={() => void refreshMessages(activeGroup.id)}
              className="grid size-10 place-items-center rounded-xl border border-border hover:bg-surface-hover"><RefreshCw className="size-4" /></button>
          </header>

          {showMembers && <div className="space-y-2 border-b border-border bg-background/50 p-4">
            <h4 className="text-sm font-semibold">Group members</h4>
            <div className="flex flex-wrap gap-2">{members.map(member => <div key={member.userId}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
              <span className="font-semibold">{member.user.displayName}</span>
              <span className="ml-2 text-secondary">{member.role === "OWNER" ? "Owner" : member.status === "INVITED" ? "Invited" : "Member"}</span>
            </div>)}</div>
          </div>}

          {showInvite && activeGroup.role === "OWNER" && <form onSubmit={event => void inviteFriends(event)}
            className="space-y-3 border-b border-border bg-accent-soft/30 p-4">
            <p className="text-sm font-semibold">Invite more friends</p>
            <p className="text-xs leading-5 text-secondary">Only accepted friends can be invited. The group has room for up to 11 people including you.</p>
            {availableFriends.length ? friendPicker(availableFriends)
              : <p className="text-sm text-secondary">No additional friends available. You can invite more after connecting with new players.</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !invitees.length || members.length + invitees.length > 11}
                className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50">Send invitations</button>
              <button type="button" onClick={() => setShowInvite(false)}
                className="min-h-11 rounded-xl border border-border px-4 text-sm">Cancel</button>
            </div>
          </form>}

          <div aria-label="Group conversation messages" aria-live="polite"
            className="flex max-h-[60vh] min-h-[300px] flex-1 flex-col gap-3 overflow-y-auto bg-background/35 p-4 sm:p-6">
            {hasOlder && messages.length > 0 && <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder}
              className="self-center rounded-xl border border-border px-4 py-2 text-sm font-medium text-accent disabled:opacity-50">
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>}
            {!messages.length && <div className="m-auto max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-6 text-center">
              <MessageCircle className="mx-auto size-8 text-accent" />
              <h4 className="font-semibold">Start the group conversation</h4>
              <p className="text-sm leading-6 text-secondary">Say hello and get everyone talking. Your invited friends can join after accepting.</p>
            </div>}
            {messages.map(msg => <div key={msg.id}
              className={msg.senderId === userId
                ? "max-w-[88%] self-end rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-accent-foreground sm:max-w-[78%]"
                : "max-w-[88%] self-start rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm sm:max-w-[78%]"}>
              <p className="mb-1 text-xs font-semibold">{msg.senderId === userId ? "You" : msg.sender.displayName}</p>
              {msg.body && <p className="whitespace-pre-wrap break-words leading-6">{msg.body}</p>}
              {msg.mediaUrl && <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
                className="mt-2 block break-all text-xs underline">Open shared media link</a>}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {(["👍", "❤️", "😂"] as const).map(emoji => <button key={emoji} type="button"
                  aria-label={"React " + emoji} onClick={() => void react(msg.id, emoji)}
                  className="rounded-md border border-current/25 px-1.5 py-0.5 text-xs">
                  {emoji} {msg.reactions.filter(reaction => reaction.emoji === emoji).length}
                </button>)}
                <time className="ml-auto text-[11px] opacity-75">{formatTime(msg.createdAt)}</time>
              </div>
            </div>)}
          </div>

          <form onSubmit={event => void send(event)} className="space-y-3 border-t border-border bg-surface p-3 sm:p-4">
            <details className="rounded-xl border border-border bg-background/40 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-secondary">Add media link (optional)</summary>
              <input aria-label="Group media URL" type="url" maxLength={2048}
                placeholder="Public HTTPS photo or video URL"
                value={mediaUrl} onChange={event => setMediaUrl(event.target.value)}
                className="mt-2 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"/>
            </details>
            <div className="flex items-center gap-2">
              <textarea aria-label="Group message" rows={2} maxLength={1500}
                placeholder="Write a message to your group…"
                value={body} onChange={event => setBody(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-accent"/>
              <button type="submit" disabled={busy || !(body.trim() || mediaUrl.trim())}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50">
                <Send className="size-4" /> Send
              </button>
            </div>
          </form>
          {activeGroup.role !== "OWNER" && <div className="border-t border-border px-4 py-3 text-right">
            <button type="button" disabled={busy} onClick={() => void groupAction(activeGroup.id, "LEAVE")}
              className="text-xs font-semibold text-secondary underline-offset-2 hover:text-danger hover:underline">Leave this group</button>
          </div>}
        </div> : <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-5 grid size-20 place-items-center rounded-3xl bg-accent-soft text-accent"><UsersRound className="size-9" /></div>
          <h3 className="text-xl font-semibold">{groups.length ? "Bring your group together" : "Welcome to Groups"}</h3>
          <p className="mt-3 max-w-sm text-sm leading-6 text-secondary">
            Create a private group to talk with friends, plan activities and share what you're building in SIMVERSE.
          </p>
          <div className="mt-6 flex flex-col items-start gap-3 text-left text-sm text-secondary">
            <span className="flex gap-2"><ShieldCheck className="size-4 text-accent" /> Invite accepted friends</span>
            <span className="flex gap-2"><MessageCircle className="size-4 text-accent" /> Chat and share media links</span>
            <span className="flex gap-2"><Clock3 className="size-4 text-accent" /> Catch up when you return</span>
          </div>
          <button type="button" onClick={() => setShowCreate(true)}
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground">
            <Plus className="size-4" /> Create a group
          </button>
        </div>}
      </div>
    </div>
  </section>;
}
