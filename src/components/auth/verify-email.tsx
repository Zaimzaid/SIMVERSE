"use client";
import {useState} from "react";
import Link from "next/link";
import {apiFetch} from "@/lib/client/api";
import {Button} from "@/components/ui/button";
export function VerifyEmail({token}:{token:string}){
 const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState("");
 async function verify(){setBusy(true);setError("");const r=await apiFetch("/api/auth/verify-email",{method:"POST",body:JSON.stringify({token})});setBusy(false);if(r.error){setError(r.error.message);return;}setDone(true);}
 return <section className="w-full space-y-4 rounded-2xl border border-border bg-surface p-7">
  <h1 className="text-2xl font-bold">Verify your email</h1>
  <p className="text-sm text-secondary">Confirm this email address belongs to you before signing in.</p>
  {done?<><p role="status" className="text-sm text-secondary">Email verified successfully.</p><Link className="text-accent underline" href="/login">Log in to SIMVERSE</Link></>:<>
   <Button onClick={verify} loading={busy} disabled={!token}>Confirm my email</Button>
   {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  </>}
 </section>;
}
