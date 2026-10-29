"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Box, Globe2, LoaderCircle } from "lucide-react";

type Option={id:string;name:string};
export function MarketUseControls({
  entitlementId,entities,worlds,
}:{
  entitlementId:string;entities:Option[];worlds:Option[];
}){
  const router=useRouter();
  const [entityId,setEntityId]=useState(entities[0]?.id??"");
  const [worldId,setWorldId]=useState(worlds[0]?.id??"");
  const [pending,setPending]=useState<"entity"|"world"|null>(null);
  const [status,setStatus]=useState("");

  async function apply(destination:"entity"|"world"){
    const id=destination==="entity"?entityId:worldId;
    if(!id)return;
    setPending(destination);setStatus("");
    try{
      const response=await fetch("/api/marketplace",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action:destination==="entity"?"use-in-entity":"attach-to-world",
          payload:{entitlementId,targetId:id},
        }),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not add the model.");
      const path=destination==="entity"?"/entities/"+id:"/worlds/"+id;
      setStatus(destination==="entity"?
        "Model appearance saved. It does not add animations or gameplay behavior.":
        "Asset registered in World definition. Place and configure it in your World editor.");
      router.refresh();
      // Do not redirect automatically: let the buyer read the confirmation first.
      void path;
    }catch(error){
      setStatus(error instanceof Error?error.message:"Could not add the model.");
    }finally{setPending(null);}
  }

  return <section className="space-y-3 rounded-xl border border-border bg-background p-4">
    <h3 className="text-sm font-semibold">Use this model in SIMVERSE</h3>
    <p className="text-xs text-muted">Choose an Entity to change its appearance, or attach the asset to a World definition. Other users need their own rights to access a private model.</p>
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor={"entity-"+entitlementId} className="block text-xs font-medium">Choose Entity</label>
        <select id={"entity-"+entitlementId} value={entityId} onChange={e=>setEntityId(e.target.value)}
          className="w-full rounded-lg border border-border bg-card p-2 text-sm" disabled={pending!==null}>
          {entities.length===0?<option value="">No editable Entities</option>:entities.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" disabled={!entityId||pending!==null} onClick={()=>apply("entity")}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50">
          {pending==="entity"?<LoaderCircle className="size-4 animate-spin"/>:<Box className="size-4"/>}
          Use in Entity
        </button>
        <p className="text-xs text-muted">Replaces existing Entity visual model.</p>
        <Link href="/entities" className="block text-xs underline underline-offset-2">Manage Entities</Link>
      </div>
      <div className="space-y-2">
        <label htmlFor={"world-"+entitlementId} className="block text-xs font-medium">Choose World</label>
        <select id={"world-"+entitlementId} value={worldId} onChange={e=>setWorldId(e.target.value)}
          className="w-full rounded-lg border border-border bg-card p-2 text-sm" disabled={pending!==null}>
          {worlds.length===0?<option value="">No editable Worlds</option>:worlds.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" disabled={!worldId||pending!==null} onClick={()=>apply("world")}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">
          {pending==="world"?<LoaderCircle className="size-4 animate-spin"/>:<Globe2 className="size-4"/>}
          Add to World
        </button>
        <p className="text-xs text-muted">Registers an asset; does not yet place visible 3D geometry.</p>
        <Link href="/worlds" className="block text-xs underline underline-offset-2">Manage Worlds</Link>
      </div>
    </div>
    {status&&<p role="status" className="text-xs text-muted">{status}</p>}
  </section>;
}
