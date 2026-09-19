"use client";

import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { LOOPING_ANIMATION_STATES } from "@/lib/viewer/animation-controller";
import type { AnimationState, ModelInspection, VisualProfileInput } from "@/lib/visuals/profile";

interface Props {
  profile: VisualProfileInput;
  animationState: AnimationState;
  previewToken: number;
  onInspection: (inspection: ModelInspection | null) => void;
}

interface Runtime {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  model: Object3D | null;
  normalization: number;
  mixer: AnimationMixer | null;
  clips: Map<string, AnimationClip>;
  action: AnimationAction | null;
}

function applyTransform(runtime: Runtime, profile: VisualProfileInput) {
  const model = runtime.model;
  if (!model) return;
  model.position.set(0, 0, 0);
  model.scale.setScalar(runtime.normalization * profile.scale);
  model.rotation.set(
    profile.rotationX * Math.PI / 180,
    profile.rotationY * Math.PI / 180,
    profile.rotationZ * Math.PI / 180,
  );
  const bounds = new Box3().setFromObject(model);
  model.position.set(profile.offsetX, -bounds.min.y + profile.offsetY + 0.02, profile.offsetZ);
}

function playAnimation(runtime: Runtime, clipName: string | undefined, state: AnimationState) {
  const clip = clipName ? runtime.clips.get(clipName) : null;
  if (!runtime.mixer || !clip) return;
  const next = runtime.mixer.clipAction(clip); next.reset(); next.enabled = true;
  const loops = LOOPING_ANIMATION_STATES.has(state);
  next.setLoop(loops ? LoopRepeat : LoopOnce, loops ? Infinity : 1); next.clampWhenFinished = !loops;
  if (runtime.action && runtime.action !== next) next.crossFadeFrom(runtime.action, 0.22, true);
  next.play(); runtime.action = next;
}

function fallbackModel() {
  const group = new Group();
  const shell = new MeshStandardMaterial({ color: "#22d3ee", metalness: 0.55, roughness: 0.35 });
  const dark = new MeshStandardMaterial({ color: "#101827", metalness: 0.7, roughness: 0.3 });
  const body = new Mesh(new BoxGeometry(0.9, 1.25, 0.55), shell); body.position.y = 1.15;
  const head = new Mesh(new BoxGeometry(0.65, 0.5, 0.58), dark); head.position.y = 2.02;
  const legA = new Mesh(new BoxGeometry(0.25, 0.85, 0.3), dark); legA.position.set(-0.23, 0.42, 0);
  const legB = legA.clone(); legB.position.x = 0.23;
  group.add(body, head, legA, legB);
  return group;
}

function dispose(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose?.();
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  });
}

export function VisualPreview({ profile, animationState, previewToken, onInspection }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewError, setPreviewError] = useState("");
  const runtimeRef = useRef<Runtime | null>(null);
  const onInspectionRef = useRef(onInspection);
  const profileRef = useRef(profile);
  const animationStateRef = useRef(animationState);
  onInspectionRef.current = onInspection;
  profileRef.current = profile;
  animationStateRef.current = animationState;
  const modelUrl = profile.sourceType === "MODEL_3D" ? profile.modelUrl : undefined;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let frame = 0;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
      setPreviewError("");
    } catch {
      const error = "3D preview is unavailable in this browser. The profile can still be saved and the Viewer will use its fallback if needed.";
      setPreviewError(error);
      onInspectionRef.current(modelUrl ? {
        loaded: false, animationNames: [], sceneCount: 0, meshCount: 0, skinnedMeshCount: 0,
        skeletonDetected: false, dimensions: null, byteSize: null, error,
      } : null);
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    const scene = new Scene(); scene.background = new Color("#07111f");
    const camera = new PerspectiveCamera(38, 1, 0.1, 80); camera.position.set(4.6, 3.1, 5.8);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.target.set(0, 1.15, 0); controls.minDistance = 2.3; controls.maxDistance = 13;
    const ground = new Mesh(new PlaneGeometry(20, 20), new MeshStandardMaterial({ color: "#0d1a2a", roughness: 0.82, metalness: 0.15 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new GridHelper(20, 20, "#185a70", "#12283c"); grid.position.y = 0.006; scene.add(grid);
    scene.add(new HemisphereLight("#bdefff", "#07101b", 2.1), new AmbientLight("#5c7894", 0.65));
    const key = new DirectionalLight("#eafcff", 4.2); key.position.set(4, 8, 5); key.castShadow = true; scene.add(key);
    const rim = new DirectionalLight("#805dff", 2.6); rim.position.set(-5, 4, -4); scene.add(rim);
    const runtime: Runtime = { renderer, camera, controls, model: null, normalization: 1, mixer: null, clips: new Map(), action: null };
    runtimeRef.current = runtime;

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth); const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    let previousTime = performance.now();
    const render = (now = performance.now()) => {
      if (disposed) return;
      const elapsed = Math.min((now - previousTime) / 1000, 0.1); previousTime = now;
      controls.update(); runtime.mixer?.update(elapsed); renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    async function load() {
      let byteSize: number | null = null;
      if (!modelUrl) {
        const fallback = fallbackModel(); fallback.traverse((object) => { if (object instanceof Mesh) object.castShadow = true; });
        scene.add(fallback); runtime.model = fallback; applyTransform(runtime, profileRef.current); onInspectionRef.current(null); return;
      }
      try {
        try {
          const head = await fetch(modelUrl, { method: "HEAD" });
          const length = Number(head.headers.get("content-length"));
          if (head.ok && Number.isFinite(length) && length >= 0) byteSize = length;
        } catch { /* Size is informational and may be unavailable for remote CORS assets. */ }
        const asset = await new GLTFLoader().loadAsync(modelUrl);
        if (disposed) { dispose(asset.scene); return; }
        const model = cloneSkeleton(asset.scene);
        let meshCount = 0; let skinnedMeshCount = 0; let skeletonDetected = false;
        model.traverse((object) => {
          const candidate = object as Mesh & { isSkinnedMesh?: boolean; skeleton?: unknown };
          if (candidate.isMesh) meshCount += 1;
          if (candidate.isSkinnedMesh) skinnedMeshCount += 1;
          if (candidate.skeleton) skeletonDetected = true;
          if (candidate.isMesh) { candidate.castShadow = true; candidate.receiveShadow = true; }
        });
        const bounds = new Box3().setFromObject(model);
        const dimensions = bounds.getSize(new Vector3());
        const largest = Math.max(dimensions.x, dimensions.y, dimensions.z);
        if (!Number.isFinite(largest) || largest < 0.001) throw new Error("The model does not contain visible geometry.");
        runtime.normalization = 2.6 / largest;
        runtime.model = model;
        runtime.mixer = new AnimationMixer(model);
        runtime.clips = new Map(asset.animations.map((clip) => [clip.name, clip]));
        scene.add(model);
        applyTransform(runtime, profileRef.current);
        playAnimation(runtime, profileRef.current.animationProfile[animationStateRef.current], animationStateRef.current);
        onInspectionRef.current({
          loaded: true,
          animationNames: asset.animations.map((clip) => clip.name),
          sceneCount: asset.scenes.length,
          meshCount,
          skinnedMeshCount,
          skeletonDetected,
          dimensions: { x: dimensions.x, y: dimensions.y, z: dimensions.z },
          byteSize,
          error: null,
        });
      } catch {
        if (disposed) return;
        const fallback = fallbackModel(); scene.add(fallback); runtime.model = fallback; applyTransform(runtime, profileRef.current);
        onInspectionRef.current({
          loaded: false, animationNames: [], sceneCount: 0, meshCount: 0, skinnedMeshCount: 0,
          skeletonDetected: false, dimensions: null, byteSize, error: "Unable to load this 3D model.",
        });
      }
    }
    void load();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      runtime.mixer?.stopAllAction(); runtime.mixer?.uncacheRoot(runtime.model!);
      dispose(scene); renderer.dispose(); runtimeRef.current = null;
    };
  }, [modelUrl]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const model = runtime?.model;
    if (!runtime || !model) return;
    applyTransform(runtime, profile);
  }, [profile.scale, profile.rotationX, profile.rotationY, profile.rotationZ, profile.offsetX, profile.offsetY, profile.offsetZ]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    playAnimation(runtime, profile.animationProfile[animationState], animationState);
  }, [animationState, previewToken, profile.animationProfile]);

  return <div className="relative">
    <canvas
      ref={canvasRef}
      className="h-[360px] w-full touch-none rounded-xl border border-border-strong bg-[#07111f] sm:h-[440px]"
      role="img"
      aria-label="Interactive 3D preview. Drag to orbit and use the wheel or pinch gesture to zoom."
    />
    {previewError ? <p role="alert" className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl border border-warning/30 bg-[#071325]/95 p-4 text-center text-sm text-warning shadow-xl">{previewError}</p> : null}
  </div>;
}
