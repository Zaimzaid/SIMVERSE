"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {apiFetch} from "@/lib/client/api";
import {Button} from "@/components/ui/button";
export function JoinWorkspace({token,currentEmail,invitedEmail}:{token:string;currentEmail:string;invitedEmail:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const matches=currentEmail.toLowerCase()===invitedEmail.toLowerCase();
 async function accept(){setBusy(true);setError("");const r=await apiFetch("/api/workspaces/invitations/accept",{method:"POST",body:JSON.stringify({token})});setBusy(false);if(r.error){setError(r.error.message);return;}router.replace("/team");router.refresh();}
 return <div className="space-y-3"><p className="text-sm text-secondary">Signed in as {currentEmail}</p>
 {!matches?<p role="alert" className="text-sm text-danger">Please log out and sign in with {invitedEmail} before accepting.</p>:<Button onClick={accept} loading={busy}>Accept invitation</Button>}
 {error&&<p role="alert" className="text-sm text-danger">{error}</p>}</div>;
}
