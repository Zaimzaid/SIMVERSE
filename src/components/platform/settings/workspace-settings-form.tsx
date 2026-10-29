"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {apiFetch} from "@/lib/client/api";
import {useToast} from "@/components/ui/toast";
import {Card,CardHeader,CardTitle,CardDescription,CardContent,CardFooter} from "@/components/ui/card";
import {Field} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Avatar} from "@/components/ui/avatar";
import {ImageUpload} from "./image-upload";
export function WorkspaceSettingsForm({workspaceId,initialName,initialLogoUrl,canEdit}:{
 workspaceId:string;initialName:string;initialLogoUrl:string;canEdit:boolean;
}){
 const [name,setName]=useState(initialName);
 const [logoUrl,setLogoUrl]=useState(initialLogoUrl);
 const [saved,setSaved]=useState({name:initialName,logoUrl:initialLogoUrl});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const {toast}=useToast();const router=useRouter();
 const dirty=name.trim()!==saved.name || logoUrl.trim()!==saved.logoUrl;
 async function save(e:React.FormEvent){
  e.preventDefault();setError("");setBusy(true);
  const payload={name:name.trim(),logoUrl:logoUrl.trim()};
  const r=await apiFetch<{workspace:{name:string;logoUrl:string|null}}>(`/api/workspaces/${workspaceId}`,{method:"PATCH",body:JSON.stringify(payload)});
  setBusy(false);if(r.error){setError(r.error.message);return;}
  const next={name:r.data?.workspace.name??payload.name,logoUrl:r.data?.workspace.logoUrl??""};
  setName(next.name);setLogoUrl(next.logoUrl);setSaved(next);
  toast({variant:"success",title:"Workspace updated"});router.refresh();
 }
 return <Card as="section">
  <CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Name and logo shown to people with access to this workspace.</CardDescription></CardHeader>
  <form onSubmit={save}><CardContent className="space-y-4">
   <div className="flex items-center gap-3"><Avatar name={name||"Workspace"} src={logoUrl||null} size="lg"/><p className="text-sm text-secondary">Your workspace identity</p></div>
   <Field label="Workspace name" htmlFor="workspace-name"><Input id="workspace-name" required minLength={2} maxLength={60} disabled={!canEdit} value={name} onChange={e=>setName(e.target.value)}/></Field>
   {canEdit?<ImageUpload endpoint={`/api/workspaces/${workspaceId}/logo`} label="Upload a workspace logo" onUploaded={url=>{
     setLogoUrl(url);setSaved(s=>({...s,logoUrl:url}));toast({variant:"success",title:"Workspace logo uploaded"});
   }}/>:null}
   <Field label="Logo image URL (optional)" htmlFor="workspace-logo" hint="Upload a file above or paste an image URL. Leave blank to remove the logo.">
    <Input id="workspace-logo" type="url" disabled={!canEdit} value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png"/>
   </Field>
   {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  </CardContent>{canEdit?<CardFooter className="justify-end"><Button type="submit" disabled={!dirty} loading={busy}>Save workspace</Button></CardFooter>:null}</form>
 </Card>;
}
