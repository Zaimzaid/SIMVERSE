"use client";
import {useEffect,useState} from "react";
import {apiFetch} from "@/lib/client/api";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
type Deletion={status:string;requestedAt:string;cancelledAt:string|null}|null;
export function AccountDataSettings(){
 const [deletion,setDeletion]=useState<Deletion>(null);
 const [loading,setLoading]=useState(true);const [password,setPassword]=useState("");const [confirmation,setConfirmation]=useState("");
 const [reason,setReason]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 useEffect(()=>{void apiFetch<{request:Deletion}>("/api/account/deletion-request").then(r=>{setDeletion(r.data?.request??null);setLoading(false);});},[]);
 async function request(){
  setBusy(true);setError("");setNotice("");
  const r=await apiFetch<{request:Deletion}>("/api/account/deletion-request",{method:"POST",body:JSON.stringify({password,confirmation,reason})});
  setBusy(false);if(r.error){setError(r.error.message);return;}setDeletion(r.data?.request??null);setPassword("");setConfirmation("");setNotice("Deletion request recorded. Your account and data remain active until an authorized deletion process is completed.");
 }
 async function cancel(){
  setBusy(true);setError("");const r=await apiFetch("/api/account/deletion-request",{method:"DELETE"});
  setBusy(false);if(r.error){setError(r.error.message);return;}setDeletion(d=>d?{...d,status:"CANCELLED",cancelledAt:new Date().toISOString()}:null);setNotice("Deletion request cancelled.");
 }
 return <Card as="section"><CardHeader><CardTitle>Your data and account</CardTitle><CardDescription>Download an account snapshot or request permanent removal. Requests are recorded for review, not automatically executed.</CardDescription></CardHeader>
 <CardContent className="space-y-5">
  <div className="space-y-2"><p className="text-sm font-medium">Export your account snapshot</p>
   <p className="text-xs text-secondary">Includes profile, memberships, authored project summaries, messages and connections. This is not a complete workspace backup.</p>
   <a href="/api/account/export" download="simverse-account-export.json" className="inline-flex rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover">Download JSON export</a>
  </div>
  <div className="space-y-3 border-t border-border pt-4">
   <p className="text-sm font-medium">Request account deletion</p>
   <p className="text-xs text-secondary">A deletion request does not delete data. Existing workspace ownership, shared content, payment and record-retention obligations must be resolved in a separately reviewed deletion process.</p>
   {!loading&&deletion?.status==="PENDING"?<div className="space-y-3"><p className="text-sm text-secondary">Request pending since {new Date(deletion.requestedAt).toLocaleDateString()}.</p><Button variant="secondary" loading={busy} onClick={()=>void cancel()}>Cancel deletion request</Button></div>:
   <div className="space-y-3">
    <label className="block text-sm">Current password<Input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label className="block text-sm">Type DELETE MY ACCOUNT<Input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="DELETE MY ACCOUNT"/></label>
    <label className="block text-sm">Optional reason<Input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <Button variant="danger" disabled={!password||confirmation!=="DELETE MY ACCOUNT"} loading={busy} onClick={()=>void request()}>Submit deletion request</Button>
   </div>}
  </div>
  {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  {notice?<p role="status" className="text-sm text-secondary">{notice}</p>:null}
 </CardContent></Card>;
}
