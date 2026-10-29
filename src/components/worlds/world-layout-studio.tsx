"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw, Save, MapPin, Plus, AlertCircle } from "lucide-react";
import type { WorldLayoutItem } from "@/server/services/world-layout-service";
import { WorldLayoutViewer } from "./world-layout-viewer";

type Placement=WorldLayoutItem["placement"];
type Layout={
  worldId:string;
  worldName:string;
  version:number;
  status:string;
  dimensions:{width:number;length:number;height:number;unit:string};
  items:WorldLayoutItem[];
};
function startValues(items:WorldLayoutItem[]):Record<string,Placement>{
  return Object.fromEntries(items.map(item=>[item.identifier,structuredClone(item.placement)]));
}
function num(value:string,fallback:number){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:fallback;
}
export function WorldLayoutStudio({initial,canEdit}:{initial:Layout;canEdit:boolean}){
  const [poses,setPoses]=useState<Record<string,Placement>>(()=>startValues(initial.items));
  const [selected,setSelected]=useState<string|null>(initial.items[0]?.identifier??null);
  const [version,setVersion]=useState(initial.version);
  const [saving,setSaving]=useState(false);
  const [changed,setChanged]=useState(false);
  const [notice,setNotice]=useState("");
  const models=useMemo(()=>initial.items.map(({identifier,name,modelUrl})=>({identifier,name,modelUrl})),[initial.items]);
  const chosen=initial.items.find(item=>item.identifier===selected);
  const pose=selected?poses[selected]:undefined;
  const edit=(next:Placement)=>{
    if(!selected||!canEdit)return;
    setPoses(current=>({...current,[selected]:next}));
    setChanged(true);setNotice("");
  };
  function setPart(part:"position"|"rotationDegrees"|"scale",key:string,value:string){
    if(!pose)return;
    if(part==="position" && ["x","y","z"].includes(key)){
      edit({...pose,position:{...pose.position,[key]:num(value,0)}});
    }
    if(part==="rotationDegrees" && ["pitch","yaw","roll"].includes(key)){
      edit({...pose,rotationDegrees:{...pose.rotationDegrees,[key]:num(value,0)}});
    }
    if(part==="scale" && ["x","y","z"].includes(key)){
      edit({...pose,scale:{...pose.scale,[key]:Math.max(0.01,num(value,1))}});
    }
  }
  async function save(){
    if(!changed||!canEdit||saving)return;
    setSaving(true);setNotice("");
    try{
      const response=await fetch(`/api/worlds/${initial.worldId}/layout`,{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          expectedVersion:version,
          placements:initial.items.map(item=>({
            identifier:item.identifier,placement:poses[item.identifier],
          })),
        }),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error?.message??"Could not save this layout.");
      setVersion(data.data?.version??data.version??version+1);
      setChanged(false);
      setNotice("Saved! Your World layout has a new immutable version.");
    }catch(error){
      setNotice(error instanceof Error?error.message:"Could not save your layout.");
    }finally{setSaving(false);}
  }
  function reset(){
    setPoses(startValues(initial.items));
    setChanged(false);
    setNotice("Unsaved changes discarded.");
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{initial.worldName} <span className="ml-2 font-normal text-muted">World v{version}</span></p>
        <p className="text-xs text-muted">{initial.items.length} linked asset{initial.items.length===1?"":"s"} · Units: {initial.dimensions.unit.toLowerCase()}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {changed&&canEdit&&<button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><RotateCcw className="size-4"/>Discard</button>}
        <button type="button" disabled={!changed||!canEdit||saving} onClick={save}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
          <Save className="size-4"/>{saving?"Saving…":"Save layout"}
        </button>
      </div>
    </div>
    {notice&&<p role="status" className="rounded-xl border border-border bg-card p-3 text-sm">{notice}</p>}
    {!canEdit&&<p className="rounded-xl border border-border p-3 text-sm text-muted">Read-only preview. Your role or this World's status does not allow editing.</p>}
    {initial.items.length===0?<div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <Plus className="mx-auto mb-3 size-8 text-muted"/>
      <h2 className="font-semibold">This World has no linked assets yet.</h2>
      <p className="mt-2 text-sm text-muted">Add a model from the Marketplace or World editor, then return here to position it.</p>
      <div className="mt-4 flex justify-center gap-4 text-sm">
        <Link href="/marketplace/library" className="underline">My Marketplace Library</Link>
        <Link href={`/worlds/${initial.worldId}/edit`} className="underline">Edit World</Link>
      </div>
    </div>:<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4"/>Interactive 3D preview</h2>
          <span className="text-xs text-muted">Local layout preview</span>
        </div>
        <WorldLayoutViewer models={models} placements={poses} selectedId={selected} onSelect={setSelected}/>
      </div>
      <aside className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Select an asset</h2>
          <label htmlFor="world-layout-object" className="sr-only">Asset</label>
          <select id="world-layout-object" value={selected??""} onChange={event=>setSelected(event.target.value)}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm">
            {initial.items.map(item=><option key={item.identifier} value={item.identifier}>{item.name} · {item.identifier}</option>)}
          </select>
          <p className="text-xs text-muted">{chosen?.modelUrl?"3D source available to you":"3D source unavailable or not licensed; placeholder only"}</p>
          <p className="text-xs text-muted">Asset v{chosen?.assetVersion} · {chosen?.role.replaceAll("_"," ")}</p>
        </section>
        {pose&&<section className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Position and transform</h2>
          <p className="text-xs text-muted">Adjust coordinates to move the selected object immediately in the preview.</p>
          {([
            {part:"position" as const,label:"Position (m)",keys:["x","y","z"] as const,step:"0.5"},
            {part:"rotationDegrees" as const,label:"Rotation (degrees)",keys:["pitch","yaw","roll"] as const,step:"5"},
            {part:"scale" as const,label:"Size / scale",keys:["x","y","z"] as const,step:"0.1"},
          ]).map(section=><div key={section.part} className="space-y-2">
            <p className="text-xs font-semibold">{section.label}</p>
            <div className="grid grid-cols-3 gap-2">
              {section.keys.map(key=><label key={key} className="space-y-1">
                <span className="text-xs text-muted">{key.toUpperCase()}</span>
                <input type="number" step={section.step} disabled={!canEdit}
                  value={pose[section.part][key]}
                  onChange={event=>setPart(section.part,key,event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm disabled:opacity-60"/>
              </label>)}
            </div>
          </div>)}
        </section>}
        <section className="space-y-2 rounded-xl border border-border p-4 text-xs text-muted">
          <p className="flex items-center gap-2 font-semibold"><AlertCircle className="size-4"/>World editor notes</p>
          <p>Yellow outlines indicate your selection. Orange blocks mean an actual model is unavailable. The preview uses World metres and asset scale; it does not create collisions, physics, animation or terrain detail.</p>
          <p>Saving validates coordinates against World dimensions. A changed World version must be reloaded before saving.</p>
        </section>
      </aside>
    </div>}
    {changed&&canEdit&&<p className="text-sm text-amber-600">Unsaved layout changes</p>}
  </div>;
}
