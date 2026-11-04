"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Check,Copy,ShieldAlert,Trash2,UserPlus,Users} from "lucide-react";
import {apiFetch} from "@/lib/client/api";
import {ADMIN_SECTION_LABELS,INVITABLE_ADMIN_ROLES,allowedAdminSections,mayManageAdminRole,
 type AdminRole,type AdminSection,type InvitableAdminRole} from "@/lib/admin/permissions";

type Staff={id:string;userId:string;name:string;email:string;role:string;active:boolean;deniedSections:AdminSection[];createdAt:string};
type Invitation={id:string;email:string;role:string;expiresAt:string;deniedSections:AdminSection[]};
type Draft={role:InvitableAdminRole;deniedSections:AdminSection[]};
type Props={staff:Staff[];invitations:Invitation[];actorRole:AdminRole;currentUserId:string};
const entry="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
const action="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50";
const secondary="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-hover disabled:opacity-50";
export function AdminStaffPanel({staff,invitations,actorRole,currentUserId}:Props){
 const router=useRouter();
 const [email,setEmail]=useState(""),[role,setRole]=useState<InvitableAdminRole>("VIEWER");
 const [denied,setDenied]=useState<AdminSection[]>([]),[drafts,setDrafts]=useState<Record<string,Draft>>({});
 const [busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [link,setLink]=useState(""),[emailSent,setEmailSent]=useState(false);
 const options=INVITABLE_ADMIN_ROLES.filter(option=>actorRole==="OWNER"||option!=="ADMIN");
 function updateRole(next:InvitableAdminRole){setRole(next);setDenied(current=>current.filter(s=>allowedAdminSections(next).includes(s)));}
 function toggle(current:AdminSection[],section:AdminSection){
  return current.includes(section)?current.filter(s=>s!==section):[...current,section];
 }
 async function invite(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy("invite");setError("");setNotice("");setLink("");
  const response=await apiFetch<{inviteUrl:string;emailSent:boolean}>("/api/admin/invitations",{
   method:"POST",body:JSON.stringify({email,role,deniedSections:denied}),
  });
  setBusy("");
  if(response.error){setError(response.error.message);return;}
  setLink(response.data?.inviteUrl??"");setEmailSent(Boolean(response.data?.emailSent));
  setNotice(response.data?.emailSent?"Private invitation sent by email.":"Invitation created. Share the private link only with the intended recipient.");
  setEmail("");setDenied([]);router.refresh();
 }
 async function copy(){
  try{await navigator.clipboard.writeText(link);setNotice("Invitation link copied.");}
  catch{setError("Copy was unavailable. Select the link above and copy it manually.");}
 }
 async function revoke(invite:Invitation){
  if(!window.confirm("Revoke the invitation sent to "+invite.email+"?"))return;
  setBusy(invite.id);setError("");setNotice("");
  const response=await apiFetch("/api/admin/invitations/"+encodeURIComponent(invite.id),{method:"DELETE"});
  setBusy("");
  if(response.error){setError(response.error.message);return;}
  setNotice("Invitation revoked.");router.refresh();
 }
 function draftFor(member:Staff):Draft{
  return drafts[member.id]??{role:member.role as InvitableAdminRole,deniedSections:member.deniedSections};
 }
 function changeDraft(member:Staff,next:Draft){
  setDrafts(old=>({...old,[member.id]:next}));
 }
 async function updateMember(member:Staff,payload:Record<string,unknown>,message:string){
  setBusy(member.id);setError("");setNotice("");
  const response=await apiFetch("/api/admin/staff/"+encodeURIComponent(member.id),{
   method:"PATCH",body:JSON.stringify(payload),
  });
  setBusy("");
  if(response.error){setError(response.error.message);return;}
  setNotice(message);setDrafts(old=>{const updated={...old};delete updated[member.id];return updated;});router.refresh();
 }
 return <div className="space-y-7">
  {error?<p role="alert" className="rounded-xl border border-danger/30 bg-surface p-4 text-sm text-danger">{error}</p>:null}
  {notice?<p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">{notice}</p>:null}
  <section className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
   <header className="flex items-center gap-3"><UserPlus className="size-5 text-accent"/><div>
    <h2 className="text-lg font-bold">Invite staff securely</h2>
    <p className="text-xs leading-6 text-secondary">Invite to a specified email. Requires an existing KAVANDRO account and authenticator code before access. Links expire after 24 hours or immediately when accepted.</p>
   </div></header>
   <form onSubmit={invite} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-[1fr_190px]">
     <label className="space-y-2 text-sm font-semibold">Staff email
      <input className={entry} type="email" required value={email} onChange={event=>setEmail(event.target.value)}
       placeholder="staff@example.com"/>
     </label>
     <label className="space-y-2 text-sm font-semibold">Role
      <select className={entry} value={role} onChange={event=>updateRole(event.target.value as InvitableAdminRole)}>
       {options.map(option=><option key={option} value={option}>{option}</option>)}
      </select>
     </label>
    </div>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">Choose what this person can see</legend>
     <p className="text-xs text-muted">Untick any section to deny access, within the selected role&apos;s maximum permissions.</p>
     <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {allowedAdminSections(role).map(section=><label key={section} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
       <input type="checkbox" checked={!denied.includes(section)}
        onChange={()=>setDenied(current=>toggle(current,section))}/>
       {ADMIN_SECTION_LABELS[section]}
      </label>)}
     </div>
    </fieldset>
    <button type="submit" disabled={busy!==""} className={action}><UserPlus className="mr-2 inline size-4"/> {busy==="invite"?"Inviting…":"Create private invitation"}</button>
   </form>
   {link?<div className="space-y-3 rounded-xl border border-border bg-background p-4">
    <p className="text-sm font-semibold">{emailSent?"Invitation emailed. Secure link:":"One-time link (copy it now):"}</p>
    <input readOnly className={entry} value={link} onFocus={event=>event.target.select()} aria-label="Private admin invitation link"/>
    <button type="button" onClick={copy} className={secondary}><Copy className="mr-2 inline size-4"/> Copy invitation link</button>
    <p className="text-xs text-muted">For security, the full invitation link is shown only at creation.</p>
   </div>:null}
  </section>
  <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
   <header className="flex items-center gap-2"><Users className="size-5 text-accent"/><h2 className="text-lg font-bold">Administrative staff ({staff.length})</h2></header>
   <p className="text-xs text-secondary">Deactivation blocks requests immediately. You cannot modify yourself or override higher roles.</p>
   <div className="divide-y divide-border">
    {staff.map(member=>{
     const editable=member.userId!==currentUserId&&mayManageAdminRole(actorRole,member.role as AdminRole);
     const draft=draftFor(member);
     const allowed=allowedAdminSections(draft.role);
     return <div key={member.id} className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div><p className="font-semibold text-foreground">{member.name}</p><p className="text-xs text-secondary">{member.email}</p>
        <p className="mt-1 text-xs text-muted">{member.role} · {member.active?"Active":"Disabled"} · Joined {new Date(member.createdAt).toLocaleDateString()}</p></div>
       {!editable?<span className="rounded-lg border border-border px-3 py-2 text-xs text-muted">{member.userId===currentUserId?"Your account":"Protected role"}</span>:null}
      </div>
      {editable?<details className="mt-3 rounded-xl border border-border bg-background/60 p-3">
       <summary className="cursor-pointer text-sm font-semibold text-accent">Edit role, sections & access</summary>
       <div className="mt-4 space-y-4">
        <label className="block max-w-xs space-y-2 text-sm font-semibold">Staff role
         <select value={draft.role} className={entry} onChange={event=>{
          const next=event.target.value as InvitableAdminRole;
          changeDraft(member,{role:next,deniedSections:draft.deniedSections.filter(section=>allowedAdminSections(next).includes(section))});
         }}>
          {options.map(option=><option key={option} value={option}>{option}</option>)}
         </select>
        </label>
        <fieldset><legend className="mb-2 text-sm font-semibold">Visible dashboard sections</legend>
         <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {allowed.map(section=><label key={section} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
           <input type="checkbox" checked={!draft.deniedSections.includes(section)}
            onChange={()=>changeDraft(member,{...draft,deniedSections:toggle(draft.deniedSections,section)})}/>
           {ADMIN_SECTION_LABELS[section]}
          </label>)}
         </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
         <button type="button" disabled={busy!==""} className={action}
          onClick={()=>updateMember(member,{role:draft.role,deniedSections:draft.deniedSections},"Staff permissions updated.")}>
          <Check className="mr-2 inline size-4"/> {busy===member.id?"Saving…":"Save changes"}
         </button>
         <button type="button" disabled={busy!==""} className={secondary} onClick={()=>{
          const next=!member.active;
          if(!window.confirm((next?"Restore":"Disable")+" dashboard access for "+member.name+"?"))return;
          void updateMember(member,{active:next},next?"Access restored.":"Access disabled.");
         }}>
          <ShieldAlert className="mr-2 inline size-4"/>{member.active?"Disable access":"Restore access"}
         </button>
        </div>
       </div>
      </details>:null}
     </div>;
    })}
   </div>
  </section>
  <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
   <h2 className="text-lg font-bold">Pending invitations ({invitations.length})</h2>
   {invitations.length===0?<p className="text-sm text-secondary">No active invitations.</p>:<div className="divide-y divide-border">
    {invitations.map(invite=><div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
     <div><p className="text-sm font-semibold">{invite.email}</p>
      <p className="text-xs text-secondary">{invite.role} · Expires {new Date(invite.expiresAt).toLocaleString()}</p></div>
     <button type="button" className={secondary} disabled={busy!==""} onClick={()=>revoke(invite)}>
      <Trash2 className="mr-2 inline size-4"/> {busy===invite.id?"Revoking…":"Revoke"}
     </button>
    </div>)}
   </div>}
  </section>
 </div>;
}
