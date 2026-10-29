"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {apiFetch} from "@/lib/client/api";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Field} from "@/components/ui/field";
export function WorkspaceCreateForm(){
 const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const router=useRouter();
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");
  const r=await apiFetch("/api/workspaces",{method:"POST",body:JSON.stringify({name:name.trim()})});
  setBusy(false);if(r.error){setError(r.error.message);return;}
  setName("");router.replace("/dashboard");router.refresh();
 }
 return <Card as="section"><CardHeader><CardTitle>Additional workspaces</CardTitle><CardDescription>Create a separate workspace for a team or project, with its own members and content. You can own up to ten.</CardDescription></CardHeader>
 <CardContent><form onSubmit={create} className="flex flex-col items-end gap-3 sm:flex-row">
  <Field className="w-full flex-1" label="New workspace name" htmlFor="workspace-new"><Input id="workspace-new" required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="My creative studio"/></Field>
  <Button type="submit" loading={busy}>Create workspace</Button>
 </form>{error?<p role="alert" className="mt-3 text-sm text-danger">{error}</p>:null}</CardContent></Card>;
}
