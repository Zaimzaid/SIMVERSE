"use client";
import {useEffect,useState} from "react";
import {apiFetch} from "@/lib/client/api";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Field} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
type Session={id:string;userAgent:string|null;ipAddress:string|null;createdAt:string;expiresAt:string;current:boolean};
export function AccountSecuritySettings(){
 const [currentPassword,setCurrentPassword]=useState("");const [newPassword,setNewPassword]=useState("");const [confirmPassword,setConfirmPassword]=useState("");
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [sessions,setSessions]=useState<Session[]>([]);const [loadingSessions,setLoadingSessions]=useState(true);
 async function load(){const r=await apiFetch<{sessions:Session[]}>("/api/account/sessions");setSessions(r.data?.sessions??[]);setLoadingSessions(false);}
 useEffect(()=>{void load();},[]);
 async function change(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage("");
  const r=await apiFetch("/api/account/password",{method:"POST",body:JSON.stringify({currentPassword,newPassword,confirmPassword})});
  setBusy(false);if(r.error){setMessage(r.error.message);return;}
  setCurrentPassword("");setNewPassword("");setConfirmPassword("");setMessage("Password changed; other sessions have been signed out.");void load();
 }
 async function revoke(id:string){
  setMessage("");const r=await apiFetch(`/api/account/sessions/${id}`,{method:"DELETE"});if(r.error){setMessage(r.error.message);return;}setMessage("Session revoked.");void load();
 }
 async function revokeOthers(){
  setMessage("");const r=await apiFetch("/api/account/sessions",{method:"DELETE"});if(r.error){setMessage(r.error.message);return;}setMessage("Other sessions signed out.");void load();
 }
 return <div className="space-y-6">
 <Card as="section"><CardHeader><CardTitle>Password & security</CardTitle><CardDescription>Choose a strong password. Changing it signs out your other devices.</CardDescription></CardHeader>
 <CardContent><form onSubmit={change} className="space-y-4">
  <Field label="Current password" htmlFor="pw-current"><Input id="pw-current" type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></Field>
  <Field label="New password" htmlFor="pw-new" hint="At least eight characters including a letter and number."><Input id="pw-new" type="password" minLength={8} maxLength={200} autoComplete="new-password" required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></Field>
  <Field label="Confirm new password" htmlFor="pw-confirm"><Input id="pw-confirm" type="password" autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></Field>
  <Button type="submit" loading={busy}>Change password</Button>
 </form></CardContent></Card>
 <Card as="section"><CardHeader><CardTitle>Signed-in devices</CardTitle><CardDescription>Review active sessions and revoke access on lost or unused devices.</CardDescription></CardHeader>
 <CardContent className="space-y-3">
  {loadingSessions?<p className="text-sm text-secondary">Loading sessions…</p>:sessions.map(s=><div className="flex flex-wrap items-center gap-3 border-b border-border pb-3" key={s.id}>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.userAgent||"Unknown browser"} {s.current?"(this device)":""}</p>
     <p className="text-xs text-muted">{s.ipAddress||"IP unavailable"} · Signed in {new Date(s.createdAt).toLocaleString()}</p></div>
    {!s.current?<Button variant="secondary" size="sm" onClick={()=>void revoke(s.id)}>Revoke</Button>:null}
   </div>)}
  {!loadingSessions&&sessions.length>1?<Button variant="secondary" size="sm" onClick={()=>void revokeOthers()}>Sign out other devices</Button>:null}
 </CardContent></Card>
 {message?<p role="status" className="text-sm text-secondary">{message}</p>:null}
 </div>;
}
