"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
export function ImageUpload({endpoint,label,onUploaded}:{endpoint:string;label:string;onUploaded:(url:string)=>void}){
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const router=useRouter();
 async function upload(){
  if(!file)return;setError("");
  if(file.size>600_000){setError("Choose an image smaller than 600 KB.");return;}
  setBusy(true);
  try{
   const form=new FormData();form.set("image",file);
   const response=await fetch(endpoint,{method:"POST",body:form});
   const result=await response.json();
   if(!response.ok){setError(result?.error?.message||"Upload failed.");return;}
   onUploaded(result?.data?.url||"");setFile(null);router.refresh();
  }catch{setError("Network error. Try again.");}finally{setBusy(false);}
 }
 return <div className="space-y-2">
  <label className="block text-sm font-medium">{label}</label>
  <input type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm text-secondary" onChange={e=>setFile(e.target.files?.[0]||null)}/>
  <Button size="sm" type="button" loading={busy} disabled={!file} onClick={upload}>Upload image</Button>
  {error?<p role="alert" className="text-xs text-danger">{error}</p>:null}
  <p className="text-xs text-muted">PNG, JPEG or WebP, maximum 600 KB. Uploaded identity images are publicly accessible through their image URLs.</p>
 </div>;
}
