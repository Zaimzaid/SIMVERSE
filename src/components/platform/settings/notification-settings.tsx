"use client";
import {useState} from "react";
import {apiFetch} from "@/lib/client/api";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
export function NotificationSettings({initialEnabled}:{initialEnabled:boolean}){
 const [enabled,setEnabled]=useState(initialEnabled);const [saved,setSaved]=useState(initialEnabled);const [busy,setBusy]=useState(false);const [status,setStatus]=useState("");
 async function save(){
  setBusy(true);setStatus("");
  const r=await apiFetch<{preferences:{socialAlertsEnabled:boolean}}>("/api/account/preferences",{method:"PATCH",body:JSON.stringify({socialAlertsEnabled:enabled})});
  setBusy(false);if(r.error){setStatus(r.error.message);return;}
  const next=r.data?.preferences.socialAlertsEnabled??enabled;setSaved(next);setEnabled(next);setStatus("Saved.");
 }
 return <Card as="section"><CardHeader><CardTitle>Notifications</CardTitle><CardDescription>Choose whether SIMVERSE stores new social activity alerts. Turning this off does not stop messages, calls or invitations themselves.</CardDescription></CardHeader>
 <CardContent className="space-y-4"><Checkbox id="social-alerts" label="Save social alerts in my notification inbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
  <Button size="sm" disabled={enabled===saved} loading={busy} onClick={save}>Save preference</Button>
  {status?<p role="status" className="text-sm text-secondary">{status}</p>:null}
 </CardContent></Card>;
}
