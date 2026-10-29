"use client";
import { useMemo, useState } from "react";
import { VisualPreview } from "@/components/entities/visual-preview";
import { DEFAULT_VISUAL_PROFILE, type ModelInspection } from "@/lib/visuals/profile";

export function MarketModelViewer({modelUrl}:{modelUrl:string}){
 const [inspection,setInspection]=useState<ModelInspection|null>(null);
 const [animationState,setAnimationState]=useState<"IDLE"|"RUN"|"ATTACK_PRIMARY">("IDLE");
 const profile=useMemo(()=>({...DEFAULT_VISUAL_PROFILE,sourceType:"MODEL_3D" as const,modelUrl}),[modelUrl]);
 return <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
   <h3 className="font-semibold">Your 3D model</h3>
   <p className="text-xs text-muted">Drag to rotate and scroll to zoom. Viewing a model does not certify its runtime or animation compatibility.</p>
   <div className="h-72 overflow-hidden rounded-xl bg-slate-950 sm:h-96">
     <VisualPreview profile={profile} previewToken={0} animationState={animationState} onInspection={setInspection}/>
   </div>
   {inspection?.loaded&&<div className="space-y-2 text-sm">
     <p>{inspection.meshCount} meshes · {inspection.animationNames.length} animations · {inspection.skeletonDetected?"Rig detected":"No rig detected"}</p>
     {inspection.animationNames.length>0&&<div className="flex flex-wrap gap-2">{(["IDLE","RUN","ATTACK_PRIMARY"] as const).map(a=><button type="button" key={a} onClick={()=>setAnimationState(a)} className="rounded-lg border border-border px-3 py-2 text-xs">{a.replaceAll("_"," ")}</button>)}</div>}
   </div>}
   {inspection?.error&&<p role="alert" className="text-sm text-red-500">{inspection.error}</p>}
 </div>;
}
