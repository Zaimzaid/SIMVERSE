"use client";

import { useEffect, useRef, useState } from "react";
import {
  AmbientLight, AxesHelper, BoxGeometry, BoxHelper, Color, DirectionalLight,
  GridHelper, Group, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, WebGLRenderer,
  type Material, type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { WorldLayoutItem } from "@/server/services/world-layout-service";

type Placement = WorldLayoutItem["placement"];
export type ModelChoice={identifier:string;name:string;modelUrl:string|null};
interface Props {
  models: ModelChoice[];
  placements:Record<string,Placement>;
  selectedId:string|null;
  onSelect:(identifier:string)=>void;
}

/** Browser-only working 3D layout canvas. Unavailable models remain visible as placeholders. */
export function WorldLayoutViewer({models,placements,selectedId,onSelect}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const onSelectRef=useRef(onSelect);
  const groupsRef=useRef<Map<string,Group>>(new Map());
  const selectedHelperRef=useRef<BoxHelper|null>(null);
  const sceneRef=useRef<Scene|null>(null);
  const [problem,setProblem]=useState("");
  const [loaded,setLoaded]=useState(0);
  const [failed,setFailed]=useState(0);
  onSelectRef.current=onSelect;

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    let stopped=false;
    let frame=0;
    let renderer:WebGLRenderer;
    try {renderer=new WebGLRenderer({canvas,antialias:true,powerPreference:"default"});}
    catch{setProblem("3D is unavailable in this browser. You can still edit the coordinates.");return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    const scene=new Scene();
    scene.background=new Color("#0b162a");
    sceneRef.current=scene;
    const camera=new PerspectiveCamera(50,1,0.1,4000);
    camera.position.set(30,25,35);
    const controls=new OrbitControls(camera,canvas);
    controls.enableDamping=true;
    controls.target.set(0,0,0);
    controls.minDistance=2;
    controls.maxDistance=1500;
    const ground=new Mesh(new PlaneGeometry(220,220),new MeshStandardMaterial({color:"#142738",roughness:0.95}));
    ground.rotation.x=-Math.PI/2;
    ground.position.y=-0.035;
    scene.add(ground);
    const grid=new GridHelper(220,44,"#50849b","#284459");
    scene.add(grid);
    scene.add(new AxesHelper(3));
    scene.add(new AmbientLight("#d5eaff",0.8));
    scene.add(new HemisphereLight("#d7edff","#243347",2));
    const sun=new DirectionalLight("#ffffff",2.7);
    sun.position.set(24,50,15);
    scene.add(sun);
    const roots=new Map<string,Group>();
    groupsRef.current=roots;
    const loader=new GLTFLoader();
    const disposable:Object3D[]=[];

    for(const item of models.slice(0,60)){
      const holder=new Group();
      holder.userData.layoutId=item.identifier;
      roots.set(item.identifier,holder);
      scene.add(holder);
      const fallback=new Mesh(new BoxGeometry(1.5,1.5,1.5),
        new MeshStandardMaterial({color:item.modelUrl?"#637d9e":"#be9069",roughness:0.55}));
      fallback.position.y=0.75;
      holder.add(fallback);
      if(item.modelUrl){
        void loader.loadAsync(item.modelUrl).then(gltf=>{
          if(stopped){
            disposable.push(gltf.scene);return;
          }
          holder.remove(fallback);
          // Retain original model dimensions: World positions and scale are in declared units.
          holder.add(gltf.scene);
          disposable.push(gltf.scene);
          setLoaded(n=>n+1);
        }).catch(()=>{if(!stopped)setFailed(n=>n+1);});
      }
    }
    const pointer=new Vector2();
    const raycaster=new Raycaster();
    const choose=(event:PointerEvent)=>{
      if(event.button!==0)return;
      const box=canvas.getBoundingClientRect();
      pointer.set((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      // Raycast only placed asset groups, not the floor.
      const intersections=raycaster.intersectObjects([...roots.values()],true);
      for(const hit of intersections){
        let object:Object3D|null=hit.object;
        while(object && !object.userData.layoutId)object=object.parent;
        if(object?.userData.layoutId){
          onSelectRef.current(String(object.userData.layoutId));
          break;
        }
      }
    };
    canvas.addEventListener("pointerup",choose);
    const resize=()=>{
      if(stopped)return;
      const w=Math.max(1,canvas.clientWidth);
      const h=Math.max(1,canvas.clientHeight);
      renderer.setSize(w,h,false);
      camera.aspect=w/h;camera.updateProjectionMatrix();
    };
    const observer=new ResizeObserver(resize);
    observer.observe(canvas);resize();
    const draw=()=>{
      if(stopped)return;
      controls.update();
      renderer.render(scene,camera);
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return ()=>{
      stopped=true;cancelAnimationFrame(frame);observer.disconnect();
      canvas.removeEventListener("pointerup",choose);controls.dispose();
      const helper=selectedHelperRef.current;
      if(helper){scene.remove(helper);helper.geometry.dispose();(helper.material as Material).dispose();}
      selectedHelperRef.current=null;
      for(const root of [...roots.values(),...disposable]){
        root.traverse(node=>{
          if(node instanceof Mesh){
            node.geometry.dispose();
            for(const material of Array.isArray(node.material)?node.material:[node.material])
              material.dispose();
          }
        });
      }
      groupsRef.current=new Map();
      sceneRef.current=null;
      renderer.dispose();renderer.forceContextLoss();
    };
  },[models]);

  useEffect(()=>{
    for(const [id,group] of groupsRef.current){
      const pose=placements[id];
      if(!pose)continue;
      group.position.set(pose.position.x,pose.position.y,pose.position.z);
      group.rotation.set(
        pose.rotationDegrees.pitch*Math.PI/180,
        pose.rotationDegrees.yaw*Math.PI/180,
        pose.rotationDegrees.roll*Math.PI/180,
        "YXZ",
      );
      group.scale.set(pose.scale.x,pose.scale.y,pose.scale.z);
    }
    selectedHelperRef.current?.update();
  },[placements]);

  useEffect(()=>{
    const scene=sceneRef.current;
    if(!scene)return;
    const old=selectedHelperRef.current;
    if(old){scene.remove(old);old.geometry.dispose();(old.material as Material).dispose();}
    selectedHelperRef.current=null;
    const target=selectedId?groupsRef.current.get(selectedId):null;
    if(target){
      const helper=new BoxHelper(target,"#f6c85d");
      scene.add(helper);
      selectedHelperRef.current=helper;
    }
  },[selectedId,models]);

  return <div className="space-y-2">
    <canvas ref={canvasRef} aria-label="3D World layout, rotate with mouse and click an asset to select"
      className="block h-[360px] w-full touch-none rounded-xl bg-slate-950 sm:h-[520px]"/>
    <p className="text-xs text-muted">Drag to orbit · Scroll to zoom · Click an object to select · Grid in metres. Orange boxes are placeholders when a 3D model cannot be shown.</p>
    {loaded>0&&<p className="text-xs text-muted">{loaded} real 3D model{loaded===1?"":"s"} loaded in this preview.</p>}
    {failed>0&&<p role="status" className="text-xs text-amber-600">{failed} model{failed===1?"":"s"} could not load; placeholder geometry shown.</p>}
    {models.length>60&&<p className="text-xs text-amber-600">Preview limit: first 60 assets shown. All assets remain editable in the list.</p>}
    {problem&&<p role="alert" className="text-sm text-red-500">{problem}</p>}
  </div>;
}
