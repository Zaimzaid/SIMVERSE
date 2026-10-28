"use client";
import { useEffect,useRef,useState } from "react";
import { Phone,PhoneOff,Video,Mic,VideoOff } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type Friend={id:string;name:string};
type Signal={id:string;senderId:string;callId:string;kind:"OFFER"|"ANSWER"|"ICE"|"HANGUP";payload:string;createdAt:string};
type Incoming={peer:string;callId:string;offer:RTCSessionDescriptionInit;video:boolean};
type Mode="VOICE"|"VIDEO";

export function PeerCallDock({userId,friends}:{userId:string;friends:Friend[]}) {
  const [peer,setPeer]=useState("");
  const [mode,setMode]=useState<Mode>("VOICE");
  const [status,setStatus]=useState("Idle");
  const [incoming,setIncoming]=useState<Incoming|null>(null);
  const [active,setActive]=useState(false);
  const [error,setError]=useState("");
  const localVideo=useRef<HTMLVideoElement|null>(null),remoteVideo=useRef<HTMLVideoElement|null>(null);
  const pc=useRef<RTCPeerConnection|null>(null),localStream=useRef<MediaStream|null>(null);
  const call=useRef<{callId:string;peer:string}|null>(null);
  const pending=useRef<RTCIceCandidateInit[]>([]);
  const after=useRef(new Date(Date.now()-12000).toISOString());
  const seen=useRef(new Set<string>());
  const busy=useRef(false);

  async function post(receiverId:string,callId:string,kind:Signal["kind"],payload:unknown) {
    const result=await apiFetch("/api/social/calls",{method:"POST",
      body:JSON.stringify({receiverId,callId,kind,payload:JSON.stringify(payload)})});
    if(result.error)throw new Error(result.error.message);
  }
  function release() {
    pc.current?.close();pc.current=null;localStream.current?.getTracks().forEach(t=>t.stop());localStream.current=null;
    if(localVideo.current)localVideo.current.srcObject=null;
    if(remoteVideo.current)remoteVideo.current.srcObject=null;
    call.current=null;pending.current=[];setActive(false);setIncoming(null);setStatus("Idle");busy.current=false;
  }
  async function hangup() {
    if(call.current)await post(call.current.peer,call.current.callId,"HANGUP",{}).catch(()=>undefined);
    release();
  }
  useEffect(()=>()=>{pc.current?.close();localStream.current?.getTracks().forEach(t=>t.stop())},[]);
  async function configure(peerId:string,callId:string,useVideo:boolean) {
    if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw new Error("Calls need browser permissions, HTTPS or localhost and WebRTC support.");
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:useVideo});
    localStream.current=stream;
    const connection=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    pc.current=connection;call.current={peer:peerId,callId};
    stream.getTracks().forEach(track=>connection.addTrack(track,stream));
    if(localVideo.current){localVideo.current.srcObject=stream;localVideo.current.muted=true;void localVideo.current.play().catch(()=>undefined);}
    connection.ontrack=event=>{
      const remote=event.streams[0];if(remoteVideo.current&&remote){
        remoteVideo.current.srcObject=remote;void remoteVideo.current.play().catch(()=>undefined);
      }
    };
    connection.onicecandidate=event=>{if(event.candidate)void post(peerId,callId,"ICE",event.candidate.toJSON()).catch(e=>setError(String(e)))};
    connection.onconnectionstatechange=()=>{
      if(connection.connectionState==="connected")setStatus("Connected");
      if(["failed","closed","disconnected"].includes(connection.connectionState))setStatus("Connection interrupted");
    };
    setActive(true);
    return connection;
  }
  async function start() {
    if(busy.current||!peer||pc.current)return;
    busy.current=true;setError("");setStatus("Requesting microphone/camera permission");
    const id=crypto.randomUUID();
    try {
      const connection=await configure(peer,id,mode==="VIDEO");
      const offer=await connection.createOffer();await connection.setLocalDescription(offer);
      await post(peer,id,"OFFER",{description:offer,video:mode==="VIDEO"});
      setStatus("Ringing — waiting for your friend to answer");
    }catch(e){setError(e instanceof Error?e.message:"Call setup failed");release()}
    finally{busy.current=false;}
  }
  async function accept() {
    if(!incoming||busy.current)return;
    busy.current=true;setError("");
    try{
      const connection=await configure(incoming.peer,incoming.callId,incoming.video);
      await connection.setRemoteDescription(incoming.offer);
      const answer=await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await post(incoming.peer,incoming.callId,"ANSWER",answer);
      setIncoming(null);setStatus("Connecting");
      for(const ice of pending.current)await connection.addIceCandidate(ice).catch(()=>undefined);
      pending.current=[];
    }catch(e){setError(e instanceof Error?e.message:"Could not accept call");release()}
    finally{busy.current=false}
  }
  async function receive(s:Signal) {
    if(!friends.some(f=>f.id===s.senderId)||seen.current.has(s.id))return;
    seen.current.add(s.id);
    try{
      if(s.kind==="OFFER"){
        if(pc.current||call.current||incoming)return;
        const value=JSON.parse(s.payload) as {description:RTCSessionDescriptionInit;video:boolean};
        if(value.description?.type!=="offer")return;
        setIncoming({peer:s.senderId,callId:s.callId,offer:value.description,video:Boolean(value.video)});
        setStatus("Incoming call");
        return;
      }
      if(s.kind==="HANGUP"&&call.current?.callId===s.callId){release();return;}
      if(call.current?.callId!==s.callId||call.current.peer!==s.senderId)return;
      if(s.kind==="ANSWER"&&pc.current){
        const description=JSON.parse(s.payload) as RTCSessionDescriptionInit;
        if(description.type!=="answer")return;
        await pc.current.setRemoteDescription(description);
        for(const ice of pending.current)await pc.current.addIceCandidate(ice).catch(()=>undefined);
        pending.current=[];setStatus("Connecting");
      }
      if(s.kind==="ICE"){
        const ice=JSON.parse(s.payload) as RTCIceCandidateInit;
        if(pc.current?.remoteDescription)await pc.current.addIceCandidate(ice).catch(()=>undefined);
        else pending.current.push(ice);
      }
    }catch{setError("A call signaling message could not be processed.");}
  }
  const receiveRef=useRef(receive);receiveRef.current=receive;
  useEffect(()=>{
    let mounted=true;
    const poll=async()=>{
      const data=await apiFetch<{signals:Signal[]}>(`/api/social/calls?after=${encodeURIComponent(after.current)}`);
      if(!mounted||!data.data)return;
      const signals=data.data.signals;
      for(const s of signals) {
        if(s.createdAt>after.current)after.current=s.createdAt;
        await receiveRef.current(s);
      }
    };
    void poll();const id=setInterval(()=>void poll(),2500);
    return ()=>{mounted=false;clearInterval(id)};
  },[]);
  const name=(id:string)=>friends.find(x=>x.id===id)?.name??"SIMVERSE friend";
  return <section className="rounded-2xl border border-border bg-surface p-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Phone className="size-5 text-accent"/> Voice & video calls (WebRTC preview)</h2>
    <p className="mt-1 text-xs text-secondary">Direct friend calls use browser microphones/cameras only after permission. Both people must have SIMVERSE open; public STUN without a TURN relay cannot connect all networks.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <select value={peer} onChange={e=>setPeer(e.target.value)} aria-label="Call friend" className="min-w-[12rem] rounded-lg border border-border bg-background p-2 text-sm">
        <option value="">Choose a friend</option>{friends.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <select value={mode} onChange={e=>setMode(e.target.value as Mode)} aria-label="Call type" className="rounded-lg border border-border bg-background p-2 text-sm">
        <option value="VOICE">Voice</option><option value="VIDEO">Video</option>
      </select>
      <Button disabled={!peer||active} onClick={()=>void start()}><Phone className="size-4"/> Call</Button>
      {active&&<Button variant="danger" onClick={()=>void hangup()}><PhoneOff className="size-4"/> Hang up</Button>}
    </div>
    {incoming&&<div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/50 bg-accent-soft p-4">
      <p className="text-sm font-semibold">{name(incoming.peer)} is calling ({incoming.video?"video":"voice"})</p>
      <Button onClick={()=>void accept()}><Phone className="size-4"/> Answer</Button>
      <Button variant="secondary" onClick={()=>{void post(incoming.peer,incoming.callId,"HANGUP",{});setIncoming(null);setStatus("Declined")}}>Decline</Button>
    </div>}
    <p role="status" className="mt-2 text-xs text-secondary">Call status: {status}</p>
    {error&&<p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <video ref={localVideo} autoPlay muted playsInline className="aspect-video w-full rounded-xl border border-border bg-black object-cover" aria-label="Local camera"/>
      <video ref={remoteVideo} autoPlay playsInline className="aspect-video w-full rounded-xl border border-border bg-black object-cover" aria-label="Friend camera"/>
    </div>
  </section>;
}
