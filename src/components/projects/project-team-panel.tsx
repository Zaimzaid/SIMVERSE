"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {apiFetch} from "@/lib/client/api";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {Avatar} from "@/components/ui/avatar";
type Candidate={id:string;name:string;email:string};
type Assignment={id:string;membershipId:string;responsibility:string;notes:string;memberName:string;memberEmail:string;memberAvatar:string|null};
const responsibilities=["LEAD","CONTRIBUTOR","REVIEWER","OBSERVER"];
export function ProjectTeamPanel({projectId,assignments,members,canManage}:{
 projectId:string;assignments:Assignment[];members:Candidate[];canManage:boolean;
}){
 const router=useRouter();const [membershipId,setMembershipId]=useState(members[0]?.id||"");
 const [responsibility,setResponsibility]=useState("CONTRIBUTOR");
 const [notes,setNotes]=useState("");
 const [error,setError]=useState("");const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);
 async function assign(e:React.FormEvent){
  e.preventDefault();setError("");setStatus("");setBusy(true);
  const result=await apiFetch(`/api/projects/${projectId}/team`,{method:"POST",body:JSON.stringify({membershipId,responsibility,notes})});
  setBusy(false);if(result.error){setError(result.error.message);return;}setStatus("Teammate assigned.");setNotes("");router.refresh();
 }
 async function update(id:string,role:string){
  setError("");const result=await apiFetch(`/api/projects/${projectId}/team/${id}`,{method:"PATCH",body:JSON.stringify({responsibility:role})});
  if(result.error){setError(result.error.message);return;}router.refresh();
 }
 async function remove(id:string){
  if(!window.confirm("Remove this project assignment? The person remains a workspace member."))return;
  setError("");const result=await apiFetch(`/api/projects/${projectId}/team/${id}`,{method:"DELETE"});
  if(result.error){setError(result.error.message);return;}setStatus("Assignment removed.");router.refresh();
 }
 return <Card as="section"><CardHeader><CardTitle>Project team</CardTitle><CardDescription>Assign people and responsibilities. Workspace role permissions remain authoritative; assignments do not yet make other simulation or asset routes private.</CardDescription></CardHeader>
 <CardContent className="space-y-4">
 {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
 {status?<p role="status" className="text-sm text-secondary">{status}</p>:null}
 {canManage?<form onSubmit={assign} className="grid gap-3 sm:grid-cols-2">
  <label className="text-sm">Teammate<Select aria-label="Select teammate" value={membershipId} onChange={e=>setMembershipId(e.target.value)} required>{members.map(m=><option key={m.id} value={m.id}>{m.name} — {m.email}</option>)}</Select></label>
  <label className="text-sm">Responsibility<Select aria-label="Project responsibility" value={responsibility} onChange={e=>setResponsibility(e.target.value)}>{responsibilities.map(r=><option key={r}>{r}</option>)}</Select></label>
  <label className="text-sm sm:col-span-2">Assignment notes<Input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What should this person handle?"/></label>
  <Button type="submit" loading={busy} disabled={!membershipId}>Assign teammate</Button>
 </form>:null}
 {!assignments.length?<p className="text-sm text-muted">No teammates have been assigned.</p>:
 <div className="divide-y divide-border">{assignments.map(a=><div key={a.id} className="flex flex-wrap items-center gap-3 py-3">
  <Avatar name={a.memberName} src={a.memberAvatar} size="sm"/>
  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{a.memberName}</p><p className="text-xs text-muted">{a.memberEmail}{a.notes?` · ${a.notes}`:""}</p></div>
  {canManage?<div className="flex items-center gap-2"><Select aria-label={`Assignment for ${a.memberName}`} value={a.responsibility} onChange={e=>void update(a.id,e.target.value)}>{responsibilities.map(r=><option key={r}>{r}</option>)}</Select><Button size="sm" variant="secondary" onClick={()=>void remove(a.id)}>Remove</Button></div>:<span className="text-xs text-secondary">{a.responsibility}</span>}
 </div>)}</div>}
 </CardContent></Card>;
}
