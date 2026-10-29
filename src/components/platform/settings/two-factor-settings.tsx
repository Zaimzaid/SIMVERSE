"use client";
import {useState} from "react";
import {apiFetch} from "@/lib/client/api";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {Field} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
export function TwoFactorSettings({initialEnabled}:{initialEnabled:boolean}){
 const [enabled,setEnabled]=useState(initialEnabled);
 const [password,setPassword]=useState("");
 const [code,setCode]=useState("");
 const [secret,setSecret]=useState("");
 const [uri,setUri]=useState("");
 const [codes,setCodes]=useState<string[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function setup(){
  setError("");setBusy(true);
  const result=await apiFetch<{secret:string;otpauthUrl:string}>("/api/account/two-factor/setup",{method:"POST",body:JSON.stringify({password})});
  setBusy(false);if(result.error){setError(result.error.message);return;}
  setSecret(result.data?.secret||"");setUri(result.data?.otpauthUrl||"");setPassword("");
 }
 async function confirm(){
  setError("");setBusy(true);
  const result=await apiFetch<{recoveryCodes:string[]}>("/api/account/two-factor/confirm",{method:"POST",body:JSON.stringify({code:code.trim()})});
  setBusy(false);if(result.error){setError(result.error.message);return;}
  setCodes(result.data?.recoveryCodes??[]);setSecret("");setUri("");setCode("");setEnabled(true);
 }
 async function disable(){
  setError("");setBusy(true);
  const result=await apiFetch("/api/account/two-factor",{method:"DELETE",body:JSON.stringify({password,code:code.trim()})});
  setBusy(false);if(result.error){setError(result.error.message);return;}
  setEnabled(false);setCodes([]);setCode("");setPassword("");
 }
 return <Card as="section"><CardHeader><CardTitle>Two-factor authentication</CardTitle>
  <CardDescription>{enabled?"Enabled: future logins require an authenticator or unused recovery code.":"Protect your account with a second factor using a standard authenticator app."}</CardDescription></CardHeader>
  <CardContent className="space-y-4">
  {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  {!!codes.length && <div className="space-y-2 rounded-lg border border-border p-4">
   <p className="font-semibold">Save these recovery codes now</p><p className="text-sm text-secondary">Each code works once. They will not be shown again. Keep them offline.</p>
   <pre className="overflow-x-auto select-all whitespace-pre-wrap text-sm">{codes.join("\n")}</pre>
   <Button variant="secondary" size="sm" onClick={async()=>{try{await navigator.clipboard.writeText(codes.join("\n"));}catch{}}}>Copy recovery codes</Button>
   <Button size="sm" onClick={()=>setCodes([])}>I have saved my codes</Button>
  </div>}
  {!enabled && <div className="space-y-3">
   {!secret? <><Field label="Confirm your password" htmlFor="two-factor-password"><Input id="two-factor-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field><Button disabled={!password} loading={busy} onClick={setup}>Set up authenticator</Button></>
   : <><p className="text-sm text-secondary">Add a new account in your authenticator app and enter the setup key below. Do not share this key.</p>
    <Field label="Secret setup key" htmlFor="two-factor-secret"><Input id="two-factor-secret" readOnly value={secret}/></Field>
    <p className="text-xs text-secondary">Your authenticator can also import this URI:</p><Input readOnly aria-label="Authenticator setup URI" value={uri}/>
    <Field label="Enter the six-digit code to activate" htmlFor="two-factor-confirm"><Input id="two-factor-confirm" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)}/></Field>
    <Button disabled={code.length!==6} loading={busy} onClick={confirm}>Enable two-factor authentication</Button>
   </>}
  </div>}
  {enabled && !codes.length && <div className="space-y-3">
   <p className="text-sm text-secondary">To disable, confirm your account password and a current authenticator or unused recovery code.</p>
   <Field label="Password" htmlFor="two-factor-disable-password"><Input id="two-factor-disable-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
   <Field label="Authenticator/recovery code" htmlFor="two-factor-disable-code"><Input id="two-factor-disable-code" value={code} onChange={e=>setCode(e.target.value)}/></Field>
   <Button variant="secondary" loading={busy} disabled={!password||!code} onClick={disable}>Disable two-factor authentication</Button>
  </div>}
  </CardContent></Card>;
}
