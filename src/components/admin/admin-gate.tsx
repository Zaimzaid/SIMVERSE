"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {LockKeyhole,ShieldCheck} from "lucide-react";
import {apiFetch} from "@/lib/client/api";
export function AdminGate(){
 const router=useRouter();
 const [code,setCode]=useState(""),[error,setError]=useState(""),[working,setWorking]=useState(false);
 async function unlock(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setWorking(true);setError("");
  const response=await apiFetch<{ok:boolean}>("/api/admin/access/verify",{
   method:"POST",body:JSON.stringify({code:code.trim()}),
  });
  setWorking(false);
  if(response.error){setError(response.error.message);setCode("");return;}
  router.replace("/admin");router.refresh();
 }
 return <form onSubmit={unlock} className="mt-6 space-y-4">
  <label className="block text-sm font-semibold text-foreground" htmlFor="admin-totp">Authenticator code</label>
  <input id="admin-totp" name="code" type="text" autoComplete="one-time-code" inputMode="numeric"
   pattern="[0-9]{6}" maxLength={6} required autoFocus value={code}
   onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))}
   placeholder="000000" className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-foreground"/>
  {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  <button type="submit" disabled={working||code.length!==6}
   className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground disabled:opacity-50">
   {working?<LockKeyhole className="size-4 animate-pulse"/>:<ShieldCheck className="size-4"/>}
   {working?"Verifying…":"Unlock admin dashboard"}
  </button>
  <p className="text-xs leading-5 text-muted">Google Authenticator and other TOTP apps generate a fresh code every 30 seconds. Your admin verification lasts up to one hour.</p>
 </form>;
}
