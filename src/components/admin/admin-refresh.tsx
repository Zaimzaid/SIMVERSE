"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {RefreshCw} from "lucide-react";
export function AdminRefresh(){
 const router=useRouter();
 const [automatic,setAutomatic]=useState(false);
 useEffect(()=>{
  if(!automatic)return;
  const timer=setInterval(()=>router.refresh(),30_000);
  return ()=>clearInterval(timer);
 },[automatic,router]);
 return <div className="flex flex-wrap items-center gap-3 text-xs">
  <button type="button" onClick={()=>router.refresh()}
   className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 font-semibold hover:bg-surface-hover">
   <RefreshCw className="size-4"/> Refresh now
  </button>
  <label className="inline-flex cursor-pointer items-center gap-2 text-secondary">
   <input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>
   Auto-refresh every 30 seconds
  </label>
 </div>;
}
