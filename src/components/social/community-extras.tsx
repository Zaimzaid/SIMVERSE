"use client";
import { useEffect,useState } from "react";
import { Bell,Check,Users,RefreshCw,Send,Plus,Heart } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type Group={id:string;title:string;ownerId:string;role:string;status:string;_count:{members:number}};
type Msg={id:string;senderId:string;body:string;mediaUrl:string|null;createdAt:string;
  sender:{displayName:string};reactions:{emoji:string;actorId:string}[]};
type Friend={id:string;other:{id:string;displayName:string}};
type Notice={id:string;title:string;detail:string;readAt:string|null;createdAt:string};
export function CommunityExtras({userId,friends}: {userId:string;friends:Friend[]}) {
  const [groups,setGroups]=useState<Group[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [messages,setMessages]=useState<Msg[]>([]);
  const [title,setTitle]=useState("");
  const [invitees,setInvitees]=useState<string[]>([]);
  const [body,setBody]=useState("");
  const [mediaUrl,setMediaUrl]=useState("");
  const [notices,setNotices]=useState<Notice[]>([]);
  const [unread,setUnread]=useState(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function load() {
    const [a,b]=await Promise.all([apiFetch<{groups:Group[]}>("/api/social/groups"),
      apiFetch<{items:Notice[];unread:number}>("/api/social/notifications")]);
    if(a.data)setGroups(a.data.groups);
    if(b.data){setNotices(b.data.items);setUnread(b.data.unread);}
    if(a.error||b.error)setError(a.error?.message??b.error?.message??"Unable to refresh.");
  }
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),12000);return ()=>clearInterval(timer);},[]);
  async function run(path:string,method:"POST"|"PATCH",payload?:unknown) {
    if(busy)return false;setBusy(true);setError("");setMessage("");
    const r=await apiFetch(path,{method,body:payload?JSON.stringify(payload):undefined});
    if(r.error){setError(r.error.message);setBusy(false);return false;}
    setBusy(false);await load();return true;
  }
  async function open(id:string) {
    setSelected(id);setError("");
    const r=await apiFetch<{messages:Msg[]}>(`/api/social/groups/messages?groupId=${encodeURIComponent(id)}`);
    if(r.data)setMessages(r.data.messages);
    if(r.error)setError(r.error.message);
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault();if(!selected)return;
    if(await run("/api/social/groups/messages","POST",{groupId:selected,body,mediaUrl:mediaUrl||undefined})){
      setBody("");setMediaUrl("");await open(selected);
    }
  }
  async function react(id:string,emoji:string) {
    if(await run("/api/social/reactions","POST",{kind:"GROUP",messageId:id,emoji})&&selected) await open(selected);
  }
  return <div className="grid gap-5 xl:grid-cols-2">
    <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-accent"/> Group messaging</h2>
      <p className="text-xs text-secondary">Invite accepted friends. Only players who accept invitations can open a group.</p>
      <label className="block text-xs text-secondary">New group name
        <input className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" maxLength={65} placeholder="SIMVERSE builders"
          value={title} onChange={e=>setTitle(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2">{friends.map(f=><label key={f.other.id} className="rounded-lg border border-border px-3 py-2 text-xs">
        <input type="checkbox" checked={invitees.includes(f.other.id)} onChange={e=>setInvitees(v=>e.target.checked?[...v,f.other.id]:v.filter(x=>x!==f.other.id))} className="mr-2"/>
        {f.other.displayName}
      </label>)}</div>
      <Button size="sm" disabled={busy||!title.trim()||!invitees.length} onClick={async()=>{if(await run("/api/social/groups","POST",{title,invitees})){setTitle("");setInvitees([])}}}><Plus className="size-4"/> Create group</Button>
      <div className="space-y-2 border-t border-border pt-4">{groups.map(g=><div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{g.title}</p><p className="text-xs text-muted">{g.status==="ACTIVE"?"Joined":"Invitation pending"} · {g._count.members} invited</p></div>
        <div className="flex gap-2">{g.status==="INVITED"?<Button size="sm" disabled={busy} onClick={()=>void run("/api/social/groups","PATCH",{id:g.id,action:"ACCEPT"})}><Check className="size-4"/> Join</Button>:
          <Button size="sm" variant="secondary" onClick={()=>void open(g.id)}>Open</Button>}
        {g.role!=="OWNER"&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run("/api/social/groups","PATCH",{id:g.id,action:"LEAVE"})}>Leave</Button>}</div>
      </div>)}
      {!groups.length&&<p className="text-sm text-muted">No groups yet.</p>}</div>
      {selected&&groups.find(g=>g.id===selected)?.status==="ACTIVE"&&<div className="space-y-3 border-t border-border pt-3">
        <div className="flex justify-between"><h3 className="font-semibold">{groups.find(g=>g.id===selected)?.title}</h3>
          <Button size="sm" variant="ghost" onClick={()=>void open(selected)}><RefreshCw className="size-4"/> Refresh</Button></div>
        <div className="max-h-72 space-y-3 overflow-auto rounded-xl border border-border bg-background p-3">
          {messages.map(m=><div key={m.id} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs font-semibold text-accent">{m.sender.displayName}</p><p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
            {m.mediaUrl&&<a target="_blank" rel="noopener noreferrer" href={m.mediaUrl} className="block break-all text-xs text-accent underline">Open shared media link</a>}
            <div className="mt-2 flex flex-wrap gap-2">{(["👍","❤️","😂"] as const).map(emoji=><button type="button" key={emoji} onClick={()=>void react(m.id,emoji)}
              className="rounded-md border border-border px-2 text-xs">{emoji} {m.reactions.filter(x=>x.emoji===emoji).length}</button>)}</div>
          </div>)}
          {!messages.length&&<p className="text-xs text-muted">Start the group conversation.</p>}
        </div>
        <form onSubmit={e=>void submit(e)} className="space-y-2">
          <input aria-label="Group message" maxLength={1500} placeholder="Message your group…" className="w-full rounded-lg border border-border bg-background p-2 text-sm" value={body} onChange={e=>setBody(e.target.value)}/>
          <input aria-label="Group media URL" maxLength={2048} placeholder="Optional public HTTPS image/video link" className="w-full rounded-lg border border-border bg-background p-2 text-xs" value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)}/>
          <Button size="sm" disabled={busy||!(body.trim()||mediaUrl.trim())}><Send className="size-4"/> Send to group</Button>
        </form>
      </div>}
    </section>
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-5 text-accent"/> Notifications {unread>0?<span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{unread}</span>:null}</h2>
        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={()=>void load()}><RefreshCw className="size-4"/>Refresh</Button>
          <Button size="sm" variant="ghost" disabled={!unread||busy} onClick={()=>void run("/api/social/notifications","PATCH")}>Mark read</Button></div>
      </div>
      <p className="mt-2 text-xs text-muted">Friend invitations, new chats, groups and incoming-call alerts. Refreshed periodically while this page is open.</p>
      <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">{notices.map(n=><div key={n.id} className={`rounded-xl border p-3 ${n.readAt?"border-border":"border-accent/40 bg-accent-soft/30"}`}>
        <p className="text-sm font-semibold">{n.title}</p><p className="mt-1 text-xs text-secondary">{n.detail}</p><p className="mt-1 text-[10px] text-muted">{new Date(n.createdAt).toLocaleString()}</p>
      </div>)}{!notices.length&&<p className="text-sm text-muted">No notifications yet.</p>}</div>
      {error&&<p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      {message&&<p className="text-xs text-accent">{message}</p>}
    </section>
  </div>;
}
