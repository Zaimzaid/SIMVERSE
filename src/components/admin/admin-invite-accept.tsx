"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {apiFetch} from "@/lib/client/api";
export function AdminInviteAccept({token,email,enabled}:{token:string;email:string;enabled:boolean}){
 const router=useRouter(),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 if(!enabled)return <div className="space-y-3">
  <p className="text-sm text-secondary">To accept this sensitive invitation, first enable two-factor authentication in your KAVANDRO account using Google Authenticator or another TOTP app.</p>
  <Link href="/settings" className="inline-flex rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground">Set up authenticator in settings</Link>
  <p className="text-xs text-muted">Return to this invitation link after setting up and confirming your authenticator.</p>
 </div>;
 async function accept(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");
  const result=await apiFetch<{ok:boolean}>("/api/admin/invitations/accept",{
   method:"POST",body:JSON.stringify({token,code}),
  });
  setBusy(false);
  if(result.error){setError(result.error.message);return;}
  router.replace("/admin");router.refresh();
 }
 return <form onSubmit={accept} className="space-y-4">
  <p className="text-sm text-secondary">Signed in as <strong>{email}</strong>. Confirm with a current six-digit authenticator code; the invitation cannot be reused after acceptance.</p>
  <label htmlFor="admin-invite-code" className="block text-sm font-semibold text-foreground">Authenticator code</label>
  <input id="admin-invite-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6}
   pattern="[0-9]{6}" required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))}
   className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-foreground"/>
  {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  <button type="submit" disabled={busy||code.length!==6}
   className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground disabled:opacity-50">
   {busy?"Verifying & joining…":"Verify code & accept invitation"}
  </button>
 </form>;
}
