"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { MarketModelViewer } from "./market-model-viewer";

/** Mount GPU/WebGL only after the buyer asks to preview a model. */
export function MarketPreviewPanel({modelUrl}:{modelUrl:string}){
 const [open,setOpen]=useState(false);
 return <section className="space-y-3">
   <button type="button" onClick={()=>setOpen(v=>!v)}
    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold">
    {open?<EyeOff className="size-4"/>:<Eye className="size-4"/>}
    {open?"Close 3D preview":"Open 3D preview"}
   </button>
   {open?<MarketModelViewer modelUrl={modelUrl}/>:null}
 </section>;
}
