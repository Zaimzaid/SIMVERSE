"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function ModerationControls({id}:{id:string}){
 const router=useRouter();const [working,setWorking]=useState(false);const [error,setError]=useState("");
 async function review(approve:boolean){
   setWorking(true);setError("");
   const note=window.prompt(approve?"Review note (optional):":"Reason for rejection:")??"";
   if(!approve&&!note.trim()){setWorking(false);setError("A rejection reason is required.");return;}
   try {
     const res=await fetch("/api/marketplace",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"review",id,approve,note})});
     const payload=await res.json();if(!res.ok)throw new Error(payload.error?.message??"Review failed");
     router.refresh();
   }catch(e){setError(e instanceof Error?e.message:"Review failed");}finally{setWorking(false);}
 }
 return <div className="flex flex-wrap items-center gap-2"><button disabled={working} onClick={()=>review(true)} className="rounded-lg border border-border px-4 py-2 text-sm">Approve</button><button disabled={working} onClick={()=>review(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Reject</button>{error&&<span role="alert" className="text-xs text-red-500">{error}</span>}</div>;
}