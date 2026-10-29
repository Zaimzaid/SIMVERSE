"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {UserPlus,Copy,Trash2} from "lucide-react";
import type {WorkspaceRole} from "@/lib/permissions";
import {ROLE_META} from "@/lib/permissions";
import {apiFetch} from "@/lib/client/api";
import {Avatar} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Field} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
type TeamMember={id:string;userId:string;role:WorkspaceRole;name:string;email:string;avatarUrl:string|null;joinedAt:string};
type Invite={id:string;email:string;role:string;expiresAt:string};
type Props={workspaceId:string;actorRole:WorkspaceRole;currentUserId:string;canManage:boolean;members:TeamMember[];invitations:Invite[]};
const options=["ADMIN","CREATOR","OPERATOR","EDITOR","ANALYST","VIEWER"] as const;
export function TeamPanel({workspaceId,actorRole,currentUserId,canManage,members,invitations}:Props) {
 const router=useRouter();
 const [email,setEmail]=useState("");
 const [inviteRole,setInviteRole]=useState<typeof options[number]>("CREATOR");
 const [inviteLink,setInviteLink]=useState("");
 const [emailSent,setEmailSent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [acting,setActing]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function invite(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  const r=await apiFetch<{inviteUrl:string;emailSent:boolean}>(`/api/workspaces/${workspaceId}/invitations`,{method:"POST",body:JSON.stringify({email,role:inviteRole})});
  setBusy(false);
  if(r.error){setError(r.error.message);return;}
  setInviteLink(r.data?.inviteUrl??"");setEmailSent(Boolean(r.data?.emailSent));setEmail("");
  setNotice(r.data?.emailSent?"Invitation email sent.":"Invitation created. Copy the private link and send it to the invited person.");
  router.refresh();
 }
 async function changeRole(member:TeamMember,newRole:string){
  if(newRole===member.role) return;
  setActing(member.id);setError("");setNotice("");
  const r=await apiFetch(`/api/workspaces/${workspaceId}/members/${member.id}`,{method:"PATCH",body:JSON.stringify({role:newRole})});
  setActing("");if(r.error){setError(r.error.message);return;}setNotice(`Updated ${member.name}'s role.`);router.refresh();
 }
 async function removeMember(member:TeamMember){
  if(!window.confirm(`Remove ${member.name} from this workspace? They will lose workspace access.`))return;
  setActing(member.id);setError("");setNotice("");
  const r=await apiFetch(`/api/workspaces/${workspaceId}/members/${member.id}`,{method:"DELETE"});
  setActing("");if(r.error){setError(r.error.message);return;}setNotice(`${member.name} was removed.`);router.refresh();
 }
 async function revoke(i:Invite){
  if(!window.confirm(`Revoke the invitation to ${i.email}?`))return;
  setActing(i.id);setError("");setNotice("");
  const r=await apiFetch(`/api/workspaces/${workspaceId}/invitations/${i.id}`,{method:"DELETE"});
  setActing("");if(r.error){setError(r.error.message);return;}setNotice("Invitation revoked.");router.refresh();
 }
 const canEdit=(m:TeamMember)=>canManage&&m.role!=="OWNER"&&m.userId!==currentUserId&&(actorRole==="OWNER"||m.role!=="ADMIN");
 return <div className="space-y-6">
  {error?<p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>:null}
  {notice?<p role="status" className="rounded-lg border border-border bg-surface p-3 text-sm text-secondary">{notice}</p>:null}
  {canManage?<Card as="section">
   <CardHeader><CardTitle>Invite a teammate</CardTitle><CardDescription>Assign a role and send a private invitation. Links expire after seven days and work only with the invited email.</CardDescription></CardHeader>
   <CardContent className="space-y-4">
    <form onSubmit={invite} className="flex flex-col items-end gap-3 sm:flex-row sm:items-end">
     <Field className="w-full flex-1" label="Teammate's email" htmlFor="team-invite-email" required>
      <Input id="team-invite-email" type="email" required value={email} placeholder="colleague@example.com" onChange={e=>setEmail(e.target.value)}/>
     </Field>
     <Field className="w-full sm:w-44" label="Role" htmlFor="team-invite-role">
      <Select id="team-invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value as typeof inviteRole)}>
       {options.filter(r=>actorRole==="OWNER"||r!=="ADMIN").map(r=><option key={r} value={r}>{ROLE_META[r].label}</option>)}
      </Select>
     </Field>
     <Button loading={busy} type="submit"><UserPlus className="size-4"/> Invite</Button>
    </form>
    {inviteLink?<div className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
     <p className="text-sm font-medium">Private invitation link {emailSent?"(email sent)":"(share securely)"}</p>
     <Input aria-label="Invitation link" readOnly value={inviteLink} onFocus={e=>e.target.select()}/>
     <Button variant="secondary" size="sm" onClick={async()=>{try{await navigator.clipboard.writeText(inviteLink);setNotice("Invite link copied.");}catch{setNotice("Select and copy the invitation link above.");}}}><Copy className="size-4"/> Copy link</Button>
     <p className="text-xs text-muted">The full link is shown only when you create the invitation. A revoked or used link cannot be reused.</p>
    </div>:null}
   </CardContent>
  </Card>:null}
  <Card as="section"><CardHeader><CardTitle>Members ({members.length})</CardTitle><CardDescription>Access is enforced by the server, not just hidden interface controls.</CardDescription></CardHeader>
   <CardContent className="divide-y divide-border">
    {members.map(m=><div key={m.id} className="flex flex-wrap items-center gap-3 py-4">
     <Avatar name={m.name} src={m.avatarUrl}/>
     <div className="min-w-40 flex-1"><p className="font-medium text-foreground">{m.name}{m.userId===currentUserId?" (you)":""}</p><p className="text-sm text-secondary">{m.email}</p></div>
     {canEdit(m)?<div className="flex flex-wrap items-center gap-2">
      <Select aria-label={`Role for ${m.name}`} disabled={acting===m.id} value={m.role} onChange={e=>void changeRole(m,e.target.value)} className="w-36">
       {options.filter(r=>actorRole==="OWNER"||r!=="ADMIN").map(r=><option value={r} key={r}>{ROLE_META[r].label}</option>)}
      </Select>
      <Button variant="ghost" size="sm" disabled={acting===m.id} onClick={()=>void removeMember(m)} aria-label={`Remove ${m.name}`}><Trash2 className="size-4 text-danger"/></Button>
     </div>:<span className="rounded-md border border-border px-3 py-1.5 text-xs text-secondary">{ROLE_META[m.role].label}</span>}
    </div>)}
   </CardContent>
  </Card>
  {canManage?<Card as="section"><CardHeader><CardTitle>Pending invitations ({invitations.length})</CardTitle><CardDescription>Revoke unused links whenever access should no longer be granted.</CardDescription></CardHeader>
   <CardContent className="divide-y divide-border">
    {!invitations.length?<p className="text-sm text-muted">No pending invitations.</p>:invitations.map(i=><div key={i.id} className="flex items-center gap-3 py-3">
     <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.email}</p><p className="text-xs text-muted">{i.role.toLowerCase()} · Expires {new Date(i.expiresAt).toLocaleDateString()}</p></div>
     <Button variant="secondary" size="sm" disabled={acting===i.id} onClick={()=>void revoke(i)}>Revoke</Button>
    </div>)}
   </CardContent>
  </Card>:null}
  <Card as="section"><CardHeader><CardTitle>What each role can do</CardTitle><CardDescription>Choose the least access a teammate needs to do their work.</CardDescription></CardHeader>
   <CardContent className="grid gap-3 sm:grid-cols-2">{(Object.entries(ROLE_META) as [WorkspaceRole,{label:string;description:string}][]).map(([role,meta])=><div key={role} className="rounded-lg border border-border p-3"><p className="font-medium">{meta.label}</p><p className="text-sm text-secondary">{meta.description}</p></div>)}</CardContent>
  </Card>
 </div>;
}
