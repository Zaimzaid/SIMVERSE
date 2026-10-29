"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { PlayerAvatarAppearance } from "@/lib/player-avatar/appearance";
import {
  stepPlayer, isNear, WORLD_LIMIT, WORLD_OBSTACLES,
  type GroundPoint, type MovementInput,
} from "@/lib/player-avatar/world-movement";

type Direction = keyof MovementInput;
const keyDirections: Record<string, Direction> = {
  KeyW: "forward", ArrowUp: "forward",
  KeyS: "backward", ArrowDown: "backward",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
};
const goals: readonly GroundPoint[] = [
  { x: -5.6, z: -5.5 }, { x: 5.6, z: -5.5 },
  { x: -5.6, z: 5.5 }, { x: 5.6, z: 5.5 },
];
const inputFrom = (keys: Set<Direction>): MovementInput => ({
  forward: keys.has("forward"), backward: keys.has("backward"),
  left: keys.has("left"), right: keys.has("right"),
});

export function PlayerAvatarPlayableWorld({ appearance }: { appearance: PlayerAvatarAppearance }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(new Set<Direction>());
  const resetRequested = useRef(false);
  const [fallback, setFallback] = useState(false);
  const [count, setCount] = useState(0);
  const [position, setPosition] = useState<GroundPoint>({ x: 0, z: 0 });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyDirections[event.code];
      if (!direction) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input,textarea,select,[contenteditable=true]")) return;
      event.preventDefault();
      pressed.current.add(direction);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const direction = keyDirections[event.code];
      if (direction) { event.preventDefault(); pressed.current.delete(direction); }
    };
    const clear = () => pressed.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: element, antialias: true });
      renderer.setSize(900, 530, false);
      renderer.setPixelRatio(Math.min(1.35, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch { setFallback(true); return; }
    setFallback(false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a3d1e0");
    scene.fog = new THREE.Fog("#a3d1e0", 18, 40);
    scene.add(new THREE.HemisphereLight("#ffffff", "#73837f", 2.3));
    const sun = new THREE.DirectionalLight("#fff8e4", 2.7);
    sun.position.set(-4, 10, 5); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(55, 900 / 530, .1, 80);
    const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .86 });
    const grass = material("#75a76b"), road = material("#b4ac95");
    const trunk = material("#886443"), leaf = material("#4b8557");
    const shirt = material(appearance.outfit), skin = material(appearance.skin),
      hair = material(appearance.hair), pants = material("#28384f"),
      eyeMat = material("#15263b"), building = material("#d6c9ae"),
      windowMat = material("#3d7186");
    function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material,
      x: number, y: number, z: number) {
      const object = new THREE.Mesh(geometry, mat);
      object.position.set(x, y, z);
      parent.add(object);
      return object;
    }
    const ground = mesh(scene, new THREE.PlaneGeometry(80, 80), grass, 0, -.035, 0);
    ground.rotation.x = -Math.PI / 2;
    const walkway = mesh(scene, new THREE.PlaneGeometry(2.2, 17), road, 0, -.023, 0);
    walkway.rotation.x = -Math.PI / 2;
    const crosswalk = mesh(scene, new THREE.PlaneGeometry(17, 2.2), road, 0, -.02, 0);
    crosswalk.rotation.x = -Math.PI / 2;
    // Visual world boundaries match the deterministic movement limits.
    const fence = material("#557969");
    for (const side of [-1, 1]) {
      mesh(scene, new THREE.BoxGeometry(17.4, .4, .18), fence, 0, .15, side * (WORLD_LIMIT + .65));
      mesh(scene, new THREE.BoxGeometry(.18, .4, 17.4), fence, side * (WORLD_LIMIT + .65), .15, 0);
    }
    for (const obstacle of WORLD_OBSTACLES) {
      mesh(scene, new THREE.CylinderGeometry(.2, .24, 1.6, 9), trunk, obstacle.x, .8, obstacle.z);
      mesh(scene, new THREE.ConeGeometry(.94, 2.3, 9), leaf, obstacle.x, 2.5, obstacle.z);
    }
    for (const x of [-11, 11]) for (const z of [-6, 1, 7]) {
      mesh(scene, new THREE.BoxGeometry(2.8, 3.8, 3.4), building, x, 1.9, z);
      for (const floor of [1.2, 2.8]) {
        mesh(scene, new THREE.BoxGeometry(.1, .6, .65), windowMat, x + (x > 0 ? -1.45 : 1.45), floor, z);
      }
    }

    const person = new THREE.Group(); person.scale.y = appearance.height; scene.add(person);
    mesh(person, new THREE.CylinderGeometry(.38, .32, .78, 12), shirt, 0, 1.53, 0);
    mesh(person, new THREE.CylinderGeometry(.19, .2, .24, 10), skin, 0, 2.02, 0);
    const head = mesh(person, new THREE.SphereGeometry(.33, 18, 14), skin, 0, 2.28, 0);
    if (appearance.hairstyle !== "NONE") {
      const cap = mesh(person, new THREE.SphereGeometry(.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * .45), hair, 0, 2.39, 0);
      if (appearance.hairstyle === "CURLY") cap.scale.set(1.12, 1.18, 1.12);
    }
    for (const x of [-.12, .12]) mesh(head, new THREE.SphereGeometry(.035, 10, 8), eyeMat, x, .055, .31);
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .44, 1.8, 0); person.add(arm);
      mesh(arm, new THREE.CylinderGeometry(.11, .10, .67, 10), shirt, 0, -.33, 0); arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(side * .18, 1.08, 0); person.add(leg);
      mesh(leg, new THREE.CylinderGeometry(.12, .11, .85, 10), pants, 0, -.42, 0); legs.push(leg);
    }
    const tokenMaterial = new THREE.MeshStandardMaterial({
      color: "#f6d566", emissive: "#90651f", emissiveIntensity: .6, metalness: .25, roughness: .28,
    });
    const tokens = goals.map((goal) => mesh(scene, new THREE.OctahedronGeometry(.48), tokenMaterial,
      goal.x, 1.2, goal.z));
    const collected = new Set<number>();
    let player: GroundPoint = { x: 0, z: 0 }, frame = 0, lastTime = 0, hudTime = 0;
    const targetCamera = new THREE.Vector3();
    camera.position.set(4.5, 5.2, 8.5);

    function draw(now: number) {
      const delta = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
      lastTime = now;
      if (resetRequested.current) {
        resetRequested.current = false;
        collected.clear();
        player = { x: 0, z: 0 };
        tokens.forEach((token) => { token.visible = true; });
        setCount(0);
      }
      const keys = inputFrom(pressed.current);
      const previous = player;
      if (document.visibilityState === "visible") player = stepPlayer(player, keys, delta);
      const moving = Math.hypot(player.x - previous.x, player.z - previous.z) > 0.0001;
      if (moving) {
        person.rotation.y = Math.atan2(player.x - previous.x, player.z - previous.z);
      }
      person.position.set(player.x, moving ? Math.sin(now / 105) * .035 : 0, player.z);
      const pace = moving ? Math.sin(now / 135) * .48 : 0;
      arms[0]!.rotation.x = pace; arms[1]!.rotation.x = -pace;
      legs[0]!.rotation.x = -pace; legs[1]!.rotation.x = pace;
      tokens.forEach((token, index) => {
        if (collected.has(index)) return;
        token.rotation.y += delta * 1.2;
        token.position.y = 1.2 + Math.sin(now / 400 + index) * .12;
        if (isNear(goals[index]!, player, 1)) {
          collected.add(index); token.visible = false;
          setCount(collected.size);
        }
      });
      targetCamera.set(player.x + 4.5, 5.7, player.z + 8.4);
      camera.position.lerp(targetCamera, .12);
      camera.lookAt(player.x, 1.45, player.z);
      if (now - hudTime > 350) {
        hudTime = now;
        setPosition({ x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10 });
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(draw);
    }
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
      renderer.dispose();
    };
  }, [appearance.skin, appearance.outfit, appearance.hair, appearance.hairstyle, appearance.height]);

  const control = (label: string, direction: Direction) =>
    <button key={direction} type="button" aria-label={label}
      onPointerDown={(event) => { event.preventDefault(); pressed.current.add(direction); }}
      onPointerUp={() => pressed.current.delete(direction)}
      onPointerCancel={() => pressed.current.delete(direction)}
      onPointerLeave={() => pressed.current.delete(direction)}
      className="grid size-12 touch-none select-none place-items-center rounded-xl border border-border bg-surface text-lg font-bold text-foreground hover:border-accent active:bg-accent-soft"
    >{label}</button>;

  return <section className="overflow-hidden rounded-2xl border border-border bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h2 className="font-semibold">Avatar Playground</h2>
        <p className="text-xs text-secondary">Walk through a small 3D area and collect the four golden markers.</p>
      </div>
      <span role="status" aria-live="polite" className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
        Markers: {count} / {goals.length}
      </span>
    </div>
    {fallback ? <div role="status" className="grid min-h-64 place-items-center p-6 text-center text-sm text-secondary">
      3D could not start in this browser. Your character settings remain saved. Try another browser or enable hardware acceleration.
    </div> : null}
    <canvas ref={canvas} width={900} height={530}
      aria-label="Playable 3D test world with a customizable character and golden objectives"
      className={"aspect-[90/53] w-full bg-[#a3d1e0] " + (fallback ? "hidden" : "block")}/>
    <div className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="space-y-1 text-sm text-secondary">
        <p><strong className="text-foreground">Desktop:</strong> W A S D or arrow keys to walk.</p>
        <p><strong className="text-foreground">Mobile:</strong> Hold the direction buttons.</p>
        <p className="text-xs">Position: X {position.x.toFixed(1)}, Z {position.z.toFixed(1)} · Movements and markers are local to this demo.</p>
      </div>
      <div className="flex flex-col items-center gap-1" aria-label="Touch movement controls">
        {control("↑", "forward")}
        <div className="flex gap-1">{control("←", "left")}{control("↓", "backward")}{control("→", "right")}</div>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
      <p role="status" className="text-sm text-secondary">
        {count === goals.length ? "All markers collected! You completed the avatar playground." : "Find the golden markers near the four corners."}
      </p>
      <button type="button" onClick={() => { pressed.current.clear(); resetRequested.current = true; }}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent">
        Restart playground
      </button>
    </div>
  </section>;
}
