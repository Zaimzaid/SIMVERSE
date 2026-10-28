"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Film, Layers3, Pause, Play, Plus, Save, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { STARTER_ANIMATION, sampleAnimation, type AnimationDraft, type AnimationFrame } from "@/lib/animation/editor";
import { Button } from "@/components/ui/button";

type Project = AnimationDraft & { id: string; createdAt: string; updatedAt: string };
const initial = (): AnimationDraft => structuredClone(STARTER_ANIMATION);
const colors = ["#35d3c1","#e5a768","#a28df2","#ed7695","#8cb9ff","#b8e578"];

export function AnimationStudio({ projects: source, canCreate, canEdit }: {
  projects: Project[]; canCreate:boolean; canEdit:boolean;
}) {
  const [library,setLibrary] = useState<Project[]>(source);
  const [projectId,setProjectId] = useState<string|null>(source[0]?.id??null);
  const [draft,setDraft] = useState<AnimationDraft>(source[0] ? {
    title:source[0].title,durationMs:source[0].durationMs,scene:source[0].scene,
  } : initial());
  const [actorIndex,setActorIndex] = useState(0);
  const [frameIndex,setFrameIndex] = useState(0);
  const [time,setTime] = useState(0);
  const [playing,setPlaying] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const clock=useRef<number | null>(null);

  useEffect(()=>{
    if(!playing)return;
    let raf=0;
    let previous=0;
    function frame(now:number){
      if(!previous)previous=now;
      const step=Math.min(80,now-previous);
      previous=now;
      setTime(old=>(old+step)%draft.durationMs);
      raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);
    clock.current=raf;
    return ()=>{cancelAnimationFrame(raf);clock.current=null};
  },[playing,draft.durationMs]);
  const actor=draft.scene.actors[actorIndex]??draft.scene.actors[0]!;
  const keyframe=actor.frames[frameIndex]??actor.frames[0]!;
  const stage=useMemo(()=>draft.scene.actors.map(a=>({
    ...a,position:sampleAnimation(a.frames,time),
  })),[draft.scene.actors,time]);

  function selectProject(p:Project){
    setProjectId(p.id);setDraft({title:p.title,durationMs:p.durationMs,scene:structuredClone(p.scene)});
    setTime(0);setPlaying(false);setActorIndex(0);setFrameIndex(0);setError("");setNotice("");
  }
  function updateActor(index:number,fn:(a:AnimationDraft["scene"]["actors"][number])=>AnimationDraft["scene"]["actors"][number]){
    setDraft(prev=>({...prev,scene:{...prev.scene,actors:prev.scene.actors.map((a,i)=>i===index?fn(a):a)}}));
  }
  function updateKeyFrame(key:keyof AnimationFrame,value:number){
    updateActor(actorIndex,a=>({...a,frames:a.frames.map((f,i)=>i===frameIndex?{...f,[key]:value}:f)}));
  }
  function insertFrame(){
    if(actor.frames.length>=32)return;
    let t=Math.round(time/100)*100;
    if(actor.frames.some(f=>f.t===t)) {
      const gap=Array.from({length:draft.durationMs/100},(_,i)=>i*100)
        .find(v=>v>0 && v<draft.durationMs && !actor.frames.some(f=>f.t===v));
      if(gap===undefined){setError("No free timeline position.");return;}
      t=gap;
    }
    const position=sampleAnimation(actor.frames,t);
    const next=[...actor.frames,{...position,t}].sort((a,b)=>a.t-b.t);
    updateActor(actorIndex,a=>({...a,frames:next}));
    setFrameIndex(next.findIndex(f=>f.t===t));
    setTime(t);
  }
  function addActor(){
    if(draft.scene.actors.length>=6)return;
    const id=`actor-${Date.now().toString(36)}`;
    const newActor={id,name:`Actor ${draft.scene.actors.length+1}`,shape:"SQUARE" as const,
      color:colors[draft.scene.actors.length%colors.length]!,
      frames:[{t:0,x:30,y:60,rotation:0,scale:1},{t:draft.durationMs,x:70,y:35,rotation:45,scale:1}]};
    setDraft(prev=>({...prev,scene:{...prev.scene,actors:[...prev.scene.actors,newActor]}}));
    setActorIndex(draft.scene.actors.length);setFrameIndex(0);
  }
  async function persist(){
    if(busy || (!projectId&&!canCreate) || (projectId&&!canEdit))return;
    setBusy(true);setError("");setNotice("");
    const path=projectId?`/api/animations/${projectId}`:"/api/animations";
    const result=await apiFetch<{project:Project}>(path,{method:projectId?"PATCH":"POST",body:JSON.stringify(draft)});
    if(result.error)setError(result.error.message);
    else if(result.data?.project){
      const p=result.data.project;
      setProjectId(p.id);
      setLibrary(old=>[p,...old.filter(entry=>entry.id!==p.id)]);
      setNotice("Animation project saved.");
    }
    setBusy(false);
  }
  async function remove(){
    if(!projectId||busy||!canEdit)return;
    setBusy(true);setError("");
    const result=await apiFetch(`/api/animations/${projectId}`,{method:"DELETE"});
    if(result.error)setError(result.error.message);
    else{
      setLibrary(old=>old.filter(p=>p.id!==projectId));
      setProjectId(null);setDraft(initial());setActorIndex(0);setFrameIndex(0);setTime(0);
      setPlaying(false);setNotice("Project deleted.");
    }
    setBusy(false);
  }

  return <div className="grid min-w-0 gap-5 2xl:grid-cols-[14rem_minmax(0,1fr)]">
    <aside className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Film className="size-4 text-accent"/> My animations</h2>
      <p className="my-2 text-xs text-muted">Separate from your simulation results.</p>
      {canCreate && <Button size="sm" className="mt-2 w-full" onClick={()=>{
        setProjectId(null);setDraft(initial());setActorIndex(0);setFrameIndex(0);setPlaying(false);setTime(0);setError("");setNotice("");
      }}><Plus className="size-4"/> New animation</Button>}
      <div className="mt-4 space-y-1">
        {library.map(p=><button key={p.id} type="button" onClick={()=>selectProject(p)}
          className={`block w-full rounded-lg border p-3 text-left text-sm transition ${p.id===projectId?"border-accent bg-accent-soft":"border-border hover:bg-surface-hover"}`}>
          <span className="block truncate font-semibold">{p.title}</span>
          <span className="text-xs text-muted">{(p.durationMs/1000).toFixed(1)}s · {p.scene.actors.length} actor(s)</span>
        </button>)}
      </div>
      {!library.length&&<p className="mt-5 text-xs text-muted">Your first animation starts with a reusable template.</p>}
    </aside>

    <div className="min-w-0 space-y-5">
      <Link href="/animation/3d" className="block rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm font-semibold text-accent hover:bg-surface-hover">
        Open 3D Avatar & Camera Lab — customize a rig prototype, create camera moves, preview dialogue and export silent WebM video
      </Link>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">2D keyframe preview</p>
            <h2 className="text-lg font-semibold">Animation workspace</h2></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={()=>{setPlaying(v=>!v);}}><span>{playing?<Pause className="size-4"/>:<Play className="size-4"/>}</span>{playing?"Pause":"Play"}</Button>
            <Button disabled={busy||(!projectId&&!canCreate)||(!!projectId&&!canEdit)} loading={busy} onClick={()=>void persist()}><Save className="size-4"/> Save</Button>
            {projectId&&<Button variant="danger" disabled={busy||!canEdit} onClick={()=>void remove()}><Trash2 className="size-4"/> Delete</Button>}
          </div>
        </div>
        <label className="mt-4 block text-xs font-semibold text-secondary">Scene title
          <input value={draft.title} maxLength={100} onChange={e=>setDraft(prev=>({...prev,title:e.target.value}))}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"/>
        </label>
        <svg role="img" aria-label="Live preview of timeline keyframe animation" viewBox="0 0 1000 560"
          className="mt-4 block w-full rounded-2xl border border-border" style={{background:draft.scene.background}}>
          <defs><pattern id="simverse-stage-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="white" strokeOpacity=".1"/></pattern></defs>
          <rect x="0" y="0" width="1000" height="560" fill="url(#simverse-stage-grid)"/>
          {stage.map(a=>{
            const x=a.position.x*10,y=a.position.y*5.6;
            return <g key={a.id} transform={`translate(${x} ${y}) rotate(${a.position.rotation}) scale(${a.position.scale})`}
              fill={a.color} stroke="white" strokeOpacity=".3" strokeWidth="2">
              {a.shape==="CIRCLE"?<circle r="37"/>:a.shape==="SQUARE"?<rect x="-36" y="-36" width="72" height="72" rx="8"/>:<polygon points="0,-48 45,34 -45,34"/>}
            </g>;
          })}
        </svg>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={()=>{setTime(0);setPlaying(false)}}>Reset</Button>
          <input type="range" aria-label="Animation timeline" min={0} max={draft.durationMs} step={20}
            value={Math.round(time)} onChange={e=>{setTime(Number(e.target.value));setPlaying(false)}}
            className="min-w-0 flex-1 accent-teal-500"/>
          <span className="w-24 text-right font-mono text-xs text-muted">{(time/1000).toFixed(2)} / {(draft.durationMs/1000).toFixed(1)}s</span>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><Layers3 className="size-4 text-accent"/> Actors</h3>
            <Button size="sm" variant="secondary" disabled={draft.scene.actors.length>=6||!canEdit&&!canCreate} onClick={addActor}><Plus className="size-4"/> Add</Button></div>
          <div className="flex flex-wrap gap-2">{draft.scene.actors.map((a,i)=><button key={a.id} type="button" onClick={()=>{setActorIndex(i);setFrameIndex(0)}}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${i===actorIndex?"border-accent bg-accent-soft text-accent":"border-border text-secondary"}`}>{a.name}</button>)}</div>
          <label className="block text-xs text-secondary">Actor name
            <input className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" maxLength={50}
              value={actor.name} onChange={e=>updateActor(actorIndex,a=>({...a,name:e.target.value}))}/></label>
          <label className="block text-xs text-secondary">Shape
            <select className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={actor.shape} onChange={e=>updateActor(actorIndex,a=>({...a,shape:e.target.value as typeof a.shape}))}>
              <option value="CIRCLE">Circle</option><option value="SQUARE">Square</option><option value="TRIANGLE">Triangle</option>
            </select></label>
          <label className="flex items-center gap-3 text-xs text-secondary">Character color
            <input aria-label="Actor color" type="color" value={actor.color} onChange={e=>updateActor(actorIndex,a=>({...a,color:e.target.value}))} /></label>
          <label className="flex items-center gap-3 text-xs text-secondary">Background
            <input aria-label="Scene background" type="color" value={draft.scene.background} onChange={e=>setDraft(prev=>({...prev,scene:{...prev.scene,background:e.target.value}}))}/></label>
          <label className="block text-xs text-secondary">Duration (seconds)
            <input type="number" min={1} max={60} step={1} value={draft.durationMs/1000}
              onChange={e=>{const ms=Math.round(Number(e.target.value)*1000);if(ms>=1000&&ms<=60000&&draft.scene.actors.every(a=>a.frames.every(f=>f.t<=ms))){setDraft(p=>({...p,durationMs:ms}));setTime(t=>Math.min(t,ms))}}}
              className="mt-1 block w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm"/></label>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Keyframes — {actor.name}</h3>
            <Button variant="secondary" size="sm" disabled={actor.frames.length>=32} onClick={insertFrame}><Plus className="size-4"/> At playhead</Button>
          </div>
          <div className="flex flex-wrap gap-2">{actor.frames.map((f,i)=><button key={f.t} type="button" onClick={()=>{setFrameIndex(i);setTime(f.t);setPlaying(false)}}
            className={`rounded-md border px-3 py-2 font-mono text-xs ${i===frameIndex?"border-accent bg-accent-soft":"border-border"}`}>{(f.t/1000).toFixed(2)}s</button>)}</div>
          <div className="grid grid-cols-2 gap-3">
            {(["t","x","y","rotation","scale"] as const).map(key=><label key={key} className="text-xs capitalize text-secondary">{key==="t"?"Time (ms)":key}
              <input type="number" step={key==="scale"?"0.1":1} value={keyframe[key]}
                min={key==="scale"?0.2:key==="rotation"?-360:0}
                max={key==="t"?draft.durationMs:key==="rotation"?360:key==="scale"?3:100}
                disabled={key==="t" && (frameIndex===0||frameIndex===actor.frames.length-1)}
                onChange={e=>{const v=Number(e.target.value);if(!Number.isFinite(v))return;
                  if(key==="t" && (v<0||v>draft.durationMs||actor.frames.some((f,i)=>i!==frameIndex&&f.t===v)))return;
                  updateKeyFrame(key,v);}}
                className="mt-1 block w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm"/></label>)}
          </div>
          <Button variant="ghost" size="sm" disabled={actor.frames.length<=2}
            onClick={()=>{updateActor(actorIndex,a=>({...a,frames:a.frames.filter((_,i)=>i!==frameIndex)}));setFrameIndex(0)}}><Trash2 className="size-4"/> Remove keyframe</Button>
          <p className="text-xs text-muted">Animate position, rotation and size. Select a keyframe and edit its values; use Play to preview interpolation. Full 3D rigs, lip-sync and video export are future upgrades.</p>
        </div>
      </section>
      {error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-accent/30 p-3 text-sm text-accent">{notice}</p>}
    </div>
  </div>;
}
