"use client";
import { useEffect,useRef,useState } from "react";
import * as THREE from "three";
import Link from "next/link";
import { Camera, Clapperboard, Download, Pause, Play, Save, Volume2 } from "lucide-react";
import { STARTER_ANIMATION, type AnimationDraft } from "@/lib/animation/editor";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type Project=AnimationDraft&{id:string;createdAt:string;updatedAt:string};
type Avatar=NonNullable<AnimationDraft["scene"]["avatar"]>;
type CameraFrame=NonNullable<AnimationDraft["scene"]["cameraFrames"]>[number];
const starter=():AnimationDraft=>({
  ...structuredClone(STARTER_ANIMATION),title:"My 3D character scene",durationMs:5000,
  scene:{...structuredClone(STARTER_ANIMATION.scene),mode:"3D",
    avatar:{skin:"#bc845f",outfit:"#38bfc0",hair:"#1b2835",height:1,hairstyle:"SHORT"},
    cameraFrames:[{t:0,yaw:0,pitch:12,distance:6},{t:5000,yaw:65,pitch:18,distance:5}],
    dialogue:{text:"Welcome to SIMVERSE. Create your own world.",startMs:500,endMs:4500},
  },
});
function interpolate(a:CameraFrame,b:CameraFrame,t:number):CameraFrame{
  const fraction=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t||1)));
  return {t,yaw:a.yaw+(b.yaw-a.yaw)*fraction,pitch:a.pitch+(b.pitch-a.pitch)*fraction,
    distance:a.distance+(b.distance-a.distance)*fraction};
}
export function AvatarDirector({projects:initial,canCreate,canEdit}:{projects:Project[];canCreate:boolean;canEdit:boolean}) {
  const [library,setLibrary]=useState(initial.filter(p=>p.scene.mode==="3D"));
  const [projectId,setProjectId]=useState<string|null>(null);
  const [draft,setDraft]=useState<AnimationDraft>(starter);
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false);
  const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const canvas=useRef<HTMLCanvasElement>(null);
  const runtime=useRef({draft,time:0,playing:false,recording:false});
  const recorder=useRef<MediaRecorder|null>(null);
  const chunks=useRef<Blob[]>([]);
  const elapsed=useRef(0);
  runtime.current.draft=draft;
  function updateAvatar(key:keyof Avatar,value:string|number){
    setDraft(old=>({...old,scene:{...old.scene,avatar:{...old.scene.avatar!,[key]:value}}}));
  }
  function updateCamera(index:number,key:"yaw"|"pitch"|"distance",value:number){
    setDraft(old=>({...old,scene:{...old.scene,cameraFrames:old.scene.cameraFrames!.map((f,i)=>i===index?{...f,[key]:value}:f)}}));
  }
  function choose(p:Project) {
    const base=starter();setProjectId(p.id);setDraft({...p,scene:{
      ...p.scene,mode:"3D",avatar:p.scene.avatar??base.scene.avatar,
      cameraFrames:p.scene.cameraFrames??base.scene.cameraFrames,dialogue:p.scene.dialogue??base.scene.dialogue}});
    elapsed.current=0;runtime.current.time=0;runtime.current.playing=false;setTime(0);setPlaying(false);setError("");setNotice("");
  }
  useEffect(()=>{
    const element=canvas.current;
    if(!element)return;
    const renderer=new THREE.WebGLRenderer({canvas:element,antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(880,500,false);renderer.setPixelRatio(Math.min(1.4,window.devicePixelRatio||1));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene();scene.background=new THREE.Color("#172d40");
    const camera=new THREE.PerspectiveCamera(42,880/500,0.1,100);
    scene.add(new THREE.HemisphereLight("#cceeff","#3a4450",2.2));
    const light=new THREE.DirectionalLight("#fff2d9",2.4);light.position.set(3,7,5);scene.add(light);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(4.3,64),new THREE.MeshStandardMaterial({color:"#365869",roughness:.9}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
    const grid=new THREE.GridHelper(8,16,"#70c5cf","#466775");grid.position.y=.002;scene.add(grid);
    const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.85});
    const skin=mat("#bc845f"),outfit=mat("#38bfc0"),hair=mat("#1b2835");
    const dark=mat("#111e2c"),white=mat("#f2f4f4");
    const character=new THREE.Group();scene.add(character);
    const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D,pos:[number,number,number])=>{
      const item=new THREE.Mesh(geometry,material);item.position.set(...pos);parent.add(item);return item;
    };
    mesh(new THREE.CylinderGeometry(.40,.32,.8,12),outfit,character,[0,1.48,0]);
    mesh(new THREE.CylinderGeometry(.25,.27,.25,12),skin,character,[0,1.98,0]);
    const head=mesh(new THREE.SphereGeometry(.34,18,14),skin,character,[0,2.26,0]);
    const cap=mesh(new THREE.SphereGeometry(.35,18,12,0,Math.PI*2,0,Math.PI*.45),hair,character,[0,2.38,0]);
    const eyes=[-.115,.115].map(x=>mesh(new THREE.SphereGeometry(.034,10,8),white,head,[x,.055,.31]));
    eyes.forEach(eye=>mesh(new THREE.SphereGeometry(.014,8,6),dark,eye,[0,0,.025]));
    const mouth=mesh(new THREE.SphereGeometry(.065,10,8),dark,head,[0,-.12,.321]);
    const leftArm=new THREE.Group(),rightArm=new THREE.Group(),leftLeg=new THREE.Group(),rightLeg=new THREE.Group();
    for(const [root,x,y,material,h] of [[leftArm,-.44,1.77,outfit,.65],[rightArm,.44,1.77,outfit,.65],
      [leftLeg,-.19,1.08,dark,.82],[rightLeg,.19,1.08,dark,.82]] as const) {
      root.position.set(x,y,0);character.add(root);
      mesh(new THREE.CylinderGeometry(.115,.1,h,10),material,root,[0,-h/2,0]);
    }
    let raf=0,last=0,renderIndex=0;
    function loop(now:number){
      const delta=Math.min(50,last?now-last:16);last=now;
      const state=runtime.current;
      if(state.playing){
        const next=state.time+delta;
        state.time=state.recording?Math.min(next,state.draft.durationMs):next%state.draft.durationMs;
        if(++renderIndex%3===0)setTime(state.time);
        if(state.recording && next>=state.draft.durationMs){
          state.playing=false;state.recording=false;setPlaying(false);setRecording(false);
          recorder.current?.stop();
        }
      }
      const a=state.draft.scene.avatar!;
      skin.color.set(a.skin);outfit.color.set(a.outfit);hair.color.set(a.hair);
      cap.visible=a.hairstyle!=="NONE";
      cap.scale.setScalar(a.hairstyle==="CURLY"?1.16:1);
      character.scale.y=a.height;
      const phase=state.time/700;
      leftArm.rotation.x=Math.sin(phase)*.42;rightArm.rotation.x=-Math.sin(phase)*.42;
      leftLeg.rotation.x=-Math.sin(phase)*.28;rightLeg.rotation.x=Math.sin(phase)*.28;
      const d=state.draft.scene.dialogue;
      const speaking=Boolean(d?.text&&state.time>=d.startMs&&state.time<d.endMs);
      mouth.scale.y=speaking?.6+Math.abs(Math.sin(state.time/82))*3:.35;
      const keys=state.draft.scene.cameraFrames!;
      let sample=keys[0]!;
      if(state.time>=keys[keys.length-1]!.t)sample=keys[keys.length-1]!;
      else for(let i=1;i<keys.length;i++)if(state.time<=keys[i]!.t){sample=interpolate(keys[i-1]!,keys[i]!,state.time);break;}
      const yaw=sample.yaw*Math.PI/180,pitch=sample.pitch*Math.PI/180;
      camera.position.set(sample.distance*Math.sin(yaw)*Math.cos(pitch),1.6+sample.distance*Math.sin(pitch)*.55,
        sample.distance*Math.cos(yaw)*Math.cos(pitch));
      camera.lookAt(0,1.5,0);renderer.render(scene,camera);raf=requestAnimationFrame(loop);
    }
    raf=requestAnimationFrame(loop);
    return ()=>{cancelAnimationFrame(raf);renderer.dispose();scene.traverse(obj=>{
      if(obj instanceof THREE.Mesh){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}
    })};
  },[]);
  function pause(){runtime.current.playing=false;setPlaying(false);window.speechSynthesis?.cancel();}
  function play(){
    if(recording)return;
    runtime.current.playing=true;setPlaying(true);
    const d=draft.scene.dialogue;
    if(d?.text&&"speechSynthesis" in window){window.speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(d.text);utterance.rate=1.05;
      window.speechSynthesis.speak(utterance);
    }
  }
  async function save(){
    if(busy||(!projectId&&!canCreate)||(projectId&&!canEdit))return;
    setBusy(true);setError("");setNotice("");
    const r=await apiFetch<{project:Project}>(projectId?`/api/animations/${projectId}`:"/api/animations",
      {method:projectId?"PATCH":"POST",body:JSON.stringify(draft)});
    if(r.error)setError(r.error.message);
    if(r.data?.project){setProjectId(r.data.project.id);setLibrary(v=>[r.data!.project,...v.filter(p=>p.id!==r.data!.project.id)]);
      setNotice("3D scene saved to your private workspace.");}
    setBusy(false);
  }
  function exportWebm(){
    const element=canvas.current;
    if(!element||!("MediaRecorder" in window)||!element.captureStream){setError("Your browser does not support canvas WebM recording.");return;}
    const type=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
    if(!type){setError("WebM recording is unavailable in this browser.");return;}
    window.speechSynthesis?.cancel();
    const stream=element.captureStream(30);
    const rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:2200000});
    recorder.current=rec;chunks.current=[];setError("");setNotice("Recording silent WebM video…");
    rec.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data)};
    rec.onstop=()=>{
      stream.getTracks().forEach(track=>track.stop());
      if(chunks.current.length){
        const url=URL.createObjectURL(new Blob(chunks.current,{type}));
        const link=document.createElement("a");link.href=url;link.download="simverse-avatar-scene.webm";link.click();
        setTimeout(()=>URL.revokeObjectURL(url),10000);
        setNotice("WebM export downloaded. Speech audio is NOT included.");
      }
      recorder.current=null;
    };
    runtime.current.time=0;elapsed.current=0;runtime.current.recording=true;
    runtime.current.playing=true;setTime(0);setPlaying(true);setRecording(true);rec.start(500);
  }
  const a=draft.scene.avatar!,cameraFrames=draft.scene.cameraFrames!,dialogue=draft.scene.dialogue!;
  return <div className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)]">
    <aside className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Saved 3D scenes</h2>
      <Button className="mt-3 w-full" size="sm" disabled={!canCreate} onClick={()=>{setProjectId(null);setDraft(starter());runtime.current.time=0;setTime(0);pause()}}>New scene</Button>
      {library.map(p=><button key={p.id} className={`mt-2 block w-full rounded-lg border p-3 text-left text-xs ${projectId===p.id?"border-accent":"border-border"}`}
        onClick={()=>choose(p)}>{p.title}</button>)}
      <Link href="/animation" className="mt-5 block text-xs text-accent underline">Open 2D keyframe editor</Link>
    </aside>
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold"><Clapperboard className="size-4 text-accent"/> Procedural 3D character preview</h2>
          <div className="flex gap-2"><Button variant="secondary" onClick={()=>playing?pause():play()} disabled={recording}>
            {playing?<Pause className="size-4"/>:<Play className="size-4"/>}{playing?"Pause":"Play"}</Button>
            <Button disabled={busy||recording||(!projectId&&!canCreate)} onClick={()=>void save()}><Save className="size-4"/> Save</Button>
            <Button variant="secondary" disabled={recording} onClick={exportWebm}><Download className="size-4"/> Export WebM</Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Original lightweight Three.js geometry. Joint-driven motion is a procedural rig demonstration, not a production humanoid skeleton or Blender import.</p>
        <canvas ref={canvas} width={880} height={500} className="mt-4 block aspect-[44/25] w-full rounded-xl bg-[#172d40]" aria-label="Animated 3D avatar scene"/>
        <input type="range" aria-label="Scene timeline" min={0} max={draft.durationMs} step={20} value={Math.min(draft.durationMs,Math.round(time))}
          onChange={e=>{pause();runtime.current.time=Number(e.target.value);setTime(Number(e.target.value))}} className="mt-3 w-full accent-teal-500"/>
        <p className="text-xs text-muted">{(time/1000).toFixed(2)} / {(draft.durationMs/1000).toFixed(2)} seconds</p>
      </section>
      <section className="grid gap-5 rounded-2xl border border-border bg-surface p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-semibold">Character customization</h3>
          <label className="block text-xs">Scene title<input value={draft.title} maxLength={100} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2"/></label>
          {(["skin","outfit","hair"] as const).map(key=><label key={key} className="flex items-center justify-between gap-2 text-xs capitalize">{key} color
            <input type="color" value={a[key]} onChange={e=>updateAvatar(key,e.target.value)}/></label>)}
          <label className="block text-xs">Height: {a.height.toFixed(2)}×
            <input type="range" min=".7" max="1.3" step=".05" value={a.height} onChange={e=>updateAvatar("height",Number(e.target.value))} className="mt-1 w-full"/></label>
          <label className="block text-xs">Hair
            <select className="mt-1 block w-full rounded-lg border border-border bg-background p-2" value={a.hairstyle}
              onChange={e=>updateAvatar("hairstyle",e.target.value)}>
              <option value="SHORT">Short</option><option value="CURLY">Curly</option><option value="NONE">No hair</option>
            </select></label>
          <p className="text-xs text-muted">Procedural shoulder/leg joints move during playback. Detailed rig weights, skeletal IK, FBX/GLB skins and motion capture remain future work.</p>
        </div>
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><Camera className="size-4"/> Camera animation</h3>
          {cameraFrames.map((f,i)=><div key={i} className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold">{i===0?"Start camera":"End camera"} — {(f.t/1000).toFixed(1)}s</p>
            {(["yaw","pitch","distance"] as const).map(key=><label key={key} className="mt-2 block text-xs capitalize">{key}: {f[key].toFixed(1)}
              <input type="range" min={key==="distance"?2:key==="pitch"?-45:-180}
                max={key==="distance"?14:key==="pitch"?75:180} step={1} value={f[key]} className="w-full"
                onChange={e=>updateCamera(i,key,Number(e.target.value))}/></label>)}
          </div>)}
          <p className="text-xs text-muted">Camera angles and distance interpolate between the two authored shots.</p>
        </div>
        <div className="space-y-3 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold"><Volume2 className="size-4"/> Dialogue & approximate lip movement</h3>
          <textarea className="w-full rounded-lg border border-border bg-background p-3 text-sm" maxLength={480} rows={2} value={dialogue.text}
            onChange={e=>setDraft(v=>({...v,scene:{...v.scene,dialogue:{...v.scene.dialogue!,text:e.target.value}}}))}/>
          <p className="text-xs text-muted">Play uses the browser's speech synthesis where available. Mouth movement uses approximate timing, not phoneme-level alignment. Video export records visuals only; browser speech is not mixed into the file.</p>
        </div>
      </section>
      {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
      {notice&&<p role="status" className="text-sm text-accent">{notice}</p>}
    </div>
  </div>;
}
