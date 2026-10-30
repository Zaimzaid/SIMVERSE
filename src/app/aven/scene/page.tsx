"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";

type Landmark = { name: string; x: number; z: number; color: number; height: number; accessible: boolean; description: string };
const LANDMARKS: Landmark[] = [
  { name: "Anything War HQ", x: -17, z: -16, color: 0x0e7490, height: 11, accessible: true, description: "Arena entrance preview. Combat and interiors are not implemented." },
  { name: "Starter Apartments", x: 18, z: -17, color: 0x64748b, height: 15, accessible: true, description: "Housing exterior preview. Renting and furnishing are not implemented." },
  { name: "SIMVERSE Bank", x: -18, z: 17, color: 0x1d4ed8, height: 9, accessible: true, description: "Bank exterior preview. Wallet transactions are not implemented." },
  { name: "Convenience Store", x: 18, z: 17, color: 0x0f766e, height: 7, accessible: true, description: "Shop exterior preview. Purchasing is not implemented." },
  { name: "Government Complex", x: 34, z: -32, color: 0x475569, height: 14, accessible: false, description: "Coming later." },
];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function AvenScenePage() {
  const mount = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Landmark | null>(null);
  const [position, setPosition] = useState({ x: 0, z: 0 });
  const [error, setError] = useState(false);
  useEffect(() => {
    const node = mount.current;
    if (!node) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(node.clientWidth, node.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8d8ed);
    scene.fog = new THREE.Fog(0xa8d8ed, 65, 140);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x627c67, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(30, 60, 20);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(65, node.clientWidth / node.clientHeight, 0.1, 180);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshLambertMaterial({ color: 0x6a9b77 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x374151 });
    function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      mesh.position.set(x, y, z); scene.add(mesh); return mesh;
    }
    box(11, .08, 125, 0, .05, 0, 0x374151);
    box(125, .08, 11, 0, .05, 0, 0x374151);
    for (let i = -55; i < 60; i += 10) {
      box(.2, .09, 4, 0, .11, i, 0xf8fafc);
      box(4, .09, .2, i, .11, 0, 0xf8fafc);
    }
    const clickable: THREE.Object3D[] = [];
    LANDMARKS.forEach((place, index) => {
      const body = box(12, place.height, 12, place.x, place.height / 2, place.z, place.color);
      body.userData.landmarkIndex = index; clickable.push(body);
      box(12.5, .6, 12.5, place.x, place.height + .3, place.z, 0xe2e8f0);
      for (let floor = 2; floor < place.height - 1; floor += 3) for (let col = -4; col <= 4; col += 4) {
        const windowMesh = box(2, 1.5, .13, place.x + col, floor, place.z + 6.1, 0xbfe9f8);
        windowMesh.userData.landmarkIndex = index; clickable.push(windowMesh);
      }
    });
    const treeTrunk = new THREE.CylinderGeometry(.3, .4, 3, 7);
    const treeLeaves = new THREE.ConeGeometry(2.3, 6, 7);
    for (let i = -48; i <= 48; i += 12) {
      for (const side of [-1, 1]) {
        const trunk = new THREE.Mesh(treeTrunk, new THREE.MeshLambertMaterial({ color: 0x6b442d }));
        trunk.position.set(side * 9, 1.5, i); scene.add(trunk);
        const crown = new THREE.Mesh(treeLeaves, new THREE.MeshLambertMaterial({ color: 0x1f6f4a }));
        crown.position.set(side * 9, 5.4, i); scene.add(crown);
      }
    }
    const avatar = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.55, 1.2, 4, 8), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
    torso.position.y = 1.45; avatar.add(torso); scene.add(avatar);
    const keys = new Set<string>();
    const down = (e: KeyboardEvent) => { if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault(); keys.add(e.key.toLowerCase()); };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable, false)[0];
      if (hit) setSelected(LANDMARKS[hit.object.userData.landmarkIndex]);
    };
    renderer.domElement.addEventListener("click", onClick);
    const clock = new THREE.Clock();
    let frame = 0; let running = true; let updateDelay = 0;
    const move = new THREE.Vector3();
    function animate() {
      if (!running) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), .05);
      move.set(Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft")), 0, Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup")));
      if (move.lengthSq() > 0) { move.normalize().multiplyScalar(dt * 9); avatar.position.x = clamp(avatar.position.x + move.x, -55, 55); avatar.position.z = clamp(avatar.position.z + move.z, -55, 55); }
      camera.position.lerp(new THREE.Vector3(avatar.position.x, 12, avatar.position.z + 19), .08);
      camera.lookAt(avatar.position.x, 2, avatar.position.z - 6);
      renderer.render(scene, camera);
      updateDelay += dt;
      if (updateDelay > .25) { setPosition({ x: Math.round(avatar.position.x), z: Math.round(avatar.position.z) }); updateDelay = 0; }
    }
    animate();
    const resize = () => { if (!node.clientWidth || !node.clientHeight) return; camera.aspect = node.clientWidth / node.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(node.clientWidth, node.clientHeight); };
    const observer = new ResizeObserver(resize); observer.observe(node);
    return () => { running = false; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); renderer.domElement.removeEventListener("click", onClick); node.removeChild(renderer.domElement); scene.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); const materials = Array.isArray(obj.material) ? obj.material : [obj.material]; materials.forEach((m) => m.dispose()); } }); renderer.dispose(); };
  }, []);
  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/aven/mvp" className="text-cyan-300 hover:underline">← Aven directory</Link>
      <h1 className="mt-4 text-3xl font-bold">Aven · 3D Walking Prototype</h1>
      <p className="mt-2 text-sm text-slate-300">Move with WASD or arrow keys. Click a building for its planned function. Procedural placeholder geometry; not the final city, gameplay or multiplayer.</p>
      <div ref={mount} aria-label="Interactive 3D prototype of Aven" className="mt-5 h-[55vh] min-h-[360px] overflow-hidden rounded-xl border border-slate-700 bg-slate-800" />
      {error && <p role="alert" className="mt-4 text-amber-300">3D graphics are unavailable in this browser or device.</p>}
      <div className="mt-4 flex flex-wrap justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
        <span>Position: {position.x}, {position.z}</span>
        <span>World: Aurelia / Valdora / Aven</span>
      </div>
      <section aria-live="polite" className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">{selected?.name ?? "Select a building"}</h2>
        <p className="mt-2 text-slate-300">{selected?.description ?? "Click any building to inspect its planned purpose."}</p>
        {selected && <p className="mt-3 text-sm text-amber-300">{selected.accessible ? "MVP candidate — interior not yet implemented." : "Coming later — not accessible."}</p>}
      </section>
    </div>
  </main>;
}
