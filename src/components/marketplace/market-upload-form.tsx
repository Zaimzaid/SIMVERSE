"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FileUp, ShieldCheck } from "lucide-react";

export function MarketUploadForm({assets}:{assets:{id:string;name:string}[]}) {
  const router=useRouter();
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    const model=data.get("file");
    setMessage("");
    if(!(model instanceof File)||model.size===0||model.size>20*1024*1024){
      setMessage("Choose a GLB file smaller than 20 MB.");return;
    }
    setWorking(true);
    try{
      const r=await fetch("/api/marketplace/files",{method:"POST",body:data});
      const result=await r.json();
      if(!r.ok)throw new Error(result.error?.message??"File could not be uploaded.");
      setMessage("Your GLB was saved privately. Validate the new asset version in your Asset Library before submitting a listing.");
      form.reset();router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Upload failed.");}
    finally{setWorking(false);}
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <h2 className="flex items-center gap-2 font-semibold"><FileUp className="size-5"/>Upload your 3D model</h2>
    <p className="text-sm text-muted">Private GLB storage pilot. Only original models up to 20 MB, with internal textures and buffers. A configured persistent storage directory is required on the server.</p>
    <label className="block space-y-1 text-sm">Your 3D asset
      <select required name="assetId" className="w-full rounded-xl border border-border bg-background p-3">
        {assets.length===0?<option value="">Create a 3D asset in the Asset Library first</option>:assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </label>
    <label className="block space-y-1 text-sm">GLB file
      <input required name="file" type="file" accept=".glb,model/gltf-binary" className="block w-full rounded-xl border border-border bg-background p-3 text-sm"/>
    </label>
    <button disabled={working||!assets.length} className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">{working?"Uploading…":"Upload privately"}</button>
    {message&&<p role="status" className="text-sm">{message}</p>}
    <p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck className="size-4"/>A file upload is not public publishing, security certification or rights verification.</p>
  </form>;
}
