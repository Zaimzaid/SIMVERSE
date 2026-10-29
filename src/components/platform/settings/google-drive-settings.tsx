"use client";
import {useState} from "react";
import {apiFetch} from "@/lib/client/api";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
export function GoogleDriveSettings({configured,initialConnected}:{configured:boolean;initialConnected:boolean}){
 const [connected,setConnected]=useState(initialConnected);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [file,setFile]=useState<{url:string;name:string}|null>(null);
 async function backup(){
  setBusy(true);setError("");setFile(null);
  const r=await apiFetch<{url:string;name:string}>("/api/account/cloud/google/backup",{method:"POST"});
  setBusy(false);if(r.error){setError(r.error.message);return;}
  if(r.data)setFile(r.data);
 }
 async function disconnect(){
  if(!window.confirm("Disconnect Google Drive from SIMVERSE? Existing backups will remain in your Drive."))return;
  setBusy(true);setError("");const r=await apiFetch("/api/account/cloud/google",{method:"DELETE"});
  setBusy(false);if(r.error){setError(r.error.message);return;}setConnected(false);setFile(null);
 }
 return <Card as="section"><CardHeader><CardTitle>Google Drive backup</CardTitle>
 <CardDescription>Optionally connect your own Drive to save an account JSON snapshot. SIMVERSE requests permission only for files it creates.</CardDescription></CardHeader>
 <CardContent className="space-y-3">
  {!configured?<p className="text-sm text-secondary">Google Drive connection is not configured by the SIMVERSE administrator. You can still download a JSON snapshot above.</p>:
   !connected?<a href="/api/account/cloud/google/connect" className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">Connect Google Drive</a>:
   <div className="flex flex-wrap gap-2"><Button loading={busy} onClick={()=>void backup()}>Save account snapshot to Drive</Button>
    <Button variant="secondary" loading={busy} onClick={()=>void disconnect()}>Disconnect</Button></div>}
  {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  {file?<p role="status" className="text-sm text-secondary">Backup created: <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{file.name}</a></p>:null}
  <p className="text-xs text-muted">Manual backup only; not an automatic daily sync. This account snapshot is not a complete workspace backup. Disconnecting does not delete files already uploaded to Drive.</p>
 </CardContent></Card>;
}
