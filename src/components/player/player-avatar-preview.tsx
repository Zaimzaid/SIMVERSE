"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { PlayerAvatarAppearance } from "@/lib/player-avatar/appearance";

/** One appearance contract is used for character editing and the test environment. */
export function PlayerAvatarPreview({ appearance, world = false }: {
  appearance: PlayerAvatarAppearance; world?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: element, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.3));
      renderer.setSize(800, 460, false);
    } catch { setFallback(true); return; }
    setFallback(false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(world ? "#91c3dd" : "#192e42");
    const camera = new THREE.PerspectiveCamera(43, 800 / 460, .1, 80);
    camera.position.set(3.5, 3, world ? 8.6 : 6.5); camera.lookAt(0, 1.5, 0);
    scene.add(new THREE.HemisphereLight("#ffffff", "#566576", 2.4));
    const sun = new THREE.DirectionalLight("#fff9e8", 2.5); sun.position.set(3, 8, 4); scene.add(sun);
    const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .85 });
    function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
      const item = new THREE.Mesh(geo, material); item.position.set(x, y, z); parent.add(item); return item;
    }
    const floor = mesh(scene, new THREE.PlaneGeometry(70, 70), mat(world ? "#4f9971" : "#38586a"), 0, -.05, 0);
    floor.rotation.x = -Math.PI / 2;
    const person = new THREE.Group(); person.scale.y = appearance.height; scene.add(person);
    const skin = mat(appearance.skin), outfit = mat(appearance.outfit), hair = mat(appearance.hair), legsMat = mat("#253448");
    mesh(person, new THREE.CylinderGeometry(.4, .31, .85, 12), outfit, 0, 1.48, 0);
    mesh(person, new THREE.CylinderGeometry(.18, .19, .24, 10), skin, 0, 2.01, 0);
    const head = mesh(person, new THREE.SphereGeometry(.33, 18, 14), skin, 0, 2.28, 0);
    if (appearance.hairstyle !== "NONE") {
      const cap = mesh(person, new THREE.SphereGeometry(.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * .45), hair, 0, 2.39, 0);
      if (appearance.hairstyle === "CURLY") cap.scale.set(1.13, 1.2, 1.13);
    }
    for (const x of [-.12, .12]) mesh(head, new THREE.SphereGeometry(.035, 10, 8), mat("#17263a"), x, .07, .31);
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const sign of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sign * .45, 1.8, 0); person.add(arm);
      mesh(arm, new THREE.CylinderGeometry(.12, .11, .66, 10), outfit, 0, -.33, 0); arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(sign * .19, 1.04, 0); person.add(leg);
      mesh(leg, new THREE.CylinderGeometry(.13, .11, .83, 10), legsMat, 0, -.42, 0); legs.push(leg);
    }
    if (world) {
      const trunk = mat("#795842"), leaves = mat("#39815b"), house = mat("#e2c8aa");
      for (const x of [-4, 4]) {
        mesh(scene, new THREE.CylinderGeometry(.15, .18, 1.4, 8), trunk, x, .7, -1.7);
        mesh(scene, new THREE.ConeGeometry(.9, 2, 8), leaves, x, 2.15, -1.7);
      }
      for (const x of [-6.5, -5, 5, 6.5]) mesh(scene, new THREE.BoxGeometry(1.25, 2.4, 1.6), house, x, 1.2, -6);
    }
    let frame = 0; const started = performance.now();
    function animate(time: number) {
      const step = (time - started) / 680;
      arms[0]!.rotation.x = Math.sin(step) * .3; arms[1]!.rotation.x = -Math.sin(step) * .3;
      legs[0]!.rotation.x = -Math.sin(step) * .2; legs[1]!.rotation.x = Math.sin(step) * .2;
      if (!world) person.rotation.y = Math.sin(step / 4) * .2;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of (Array.isArray(object.material) ? object.material : [object.material])) material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [appearance.skin, appearance.hair, appearance.outfit, appearance.height, appearance.hairstyle, world]);
  return <div className="overflow-hidden rounded-2xl border border-border bg-surface">
    {fallback && <div role="status" className="grid aspect-[40/23] place-items-center p-8 text-center text-sm">
      <div><div className="mx-auto mb-3 size-20 rounded-full border-8 border-border" style={{ background: appearance.skin }}/>
      Your avatar settings are saved. This device cannot display the 3D preview.</div></div>}
    <canvas ref={canvas} width={800} height={460} aria-label={world ? "Saved avatar in a small 3D test scene" : "3D preview of your customizable avatar"}
      className={"aspect-[40/23] w-full bg-[#192e42] " + (fallback ? "hidden" : "block")}/>
    <p className="p-3 text-xs text-secondary">{world ? "3D persistence proof, not a live SIMVERSE world." : "Lightweight original procedural character. Imported rigs and world movement are not yet supported."}</p>
  </div>;
}
