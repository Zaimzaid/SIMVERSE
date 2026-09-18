import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, IcosahedronGeometry, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Sprite, SpriteMaterial, TorusGeometry,
} from "three";
import type { VisualEntityInstance } from "./types";

function mesh(geometry: BoxGeometry | CylinderGeometry | IcosahedronGeometry | SphereGeometry | TorusGeometry,
  material: MeshStandardMaterial | MeshBasicMaterial, x = 0, y = 0, z = 0) {
  const item = new Mesh(geometry, material);
  item.position.set(x, y, z); item.castShadow = true; item.receiveShadow = true;
  return item;
}

function label(entity: VisualEntityInstance) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(5,15,31,.88)"; ctx.fillRect(4, 8, 504, 112);
    ctx.strokeStyle = entity.profile.primaryColor; ctx.lineWidth = 4; ctx.strokeRect(4, 8, 504, 112);
    ctx.textAlign = "center";
    ctx.fillStyle = "#eaf8ff"; ctx.font = "bold 42px sans-serif";
    ctx.fillText(entity.shortName.toUpperCase().slice(0, 20), 256, 59, 472);
    ctx.fillStyle = "#a4c9df"; ctx.font = "bold 24px sans-serif";
    ctx.fillText(entity.category.toUpperCase().slice(0, 22), 256, 94, 472);
  }
  const texture = new CanvasTexture(canvas);
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(2.4, 0.6, 1); sprite.position.y = 3.05;
  return sprite;
}

/** Deliberate SIMVERSE holographic stand-in; never implies a named animal or character model exists. */
export function createFallbackAvatar(entity: VisualEntityInstance): Group {
  const root = new Group();
  const primary = new Color(entity.profile.primaryColor);
  const secondary = new Color(entity.profile.secondaryColor);
  const shell = new MeshStandardMaterial({ color: primary, metalness: 0.24, roughness: 0.32, emissive: primary, emissiveIntensity: 0.35 });
  const dark = new MeshStandardMaterial({ color: "#17263e", metalness: 0.48, roughness: 0.4 });
  const accent = new MeshStandardMaterial({ color: secondary, metalness: 0.25, roughness: 0.26, emissive: secondary, emissiveIntensity: 0.8 });
  const ring = mesh(new TorusGeometry(0.69, 0.035, 8, 40), new MeshBasicMaterial({ color: primary }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.055; root.add(ring);
  const base = mesh(new CylinderGeometry(0.46, 0.56, 0.17, 32), dark, 0, 0.1);
  root.add(base);
  const quadruped = entity.profile.archetype === "QUADRUPED";
  const robot = entity.profile.archetype === "ROBOT";
  if (quadruped) {
    root.add(mesh(new BoxGeometry(1.18, 0.55, 0.6), shell, 0, 1.15));
    root.add(mesh(new IcosahedronGeometry(0.38, 1), accent, 0, 1.37, 0.61));
    for (const x of [-0.43, 0.43]) for (const z of [-0.22, 0.22]) root.add(mesh(new CylinderGeometry(0.1, 0.14, 0.72, 8), dark, x, 0.67, z));
  } else if (robot) {
    root.add(mesh(new BoxGeometry(0.85, 1.18, 0.52), shell, 0, 1.21));
    root.add(mesh(new BoxGeometry(0.7, 0.5, 0.52), dark, 0, 2.05));
    root.add(mesh(new BoxGeometry(0.48, 0.13, 0.08), accent, 0, 2.08, 0.3));
    for (const x of [-0.58, 0.58]) root.add(mesh(new CylinderGeometry(0.13, 0.11, 0.95, 8), dark, x, 1.1));
  } else {
    root.add(mesh(new CylinderGeometry(0.37, 0.52, 1.13, 8), dark, 0, 1.04));
    root.add(mesh(new IcosahedronGeometry(0.48, 1), shell, 0, 1.65));
    root.add(mesh(new SphereGeometry(0.26, 16, 12), accent, 0, 2.1));
    for (const x of [-0.59, 0.59]) root.add(mesh(new CylinderGeometry(0.13, 0.16, 0.83, 8), shell, x, 1.15));
  }
  const emblem = mesh(new IcosahedronGeometry(0.22, 0), accent, 0, 1.5, quadruped ? 0.4 : 0.48);
  root.add(emblem);
  root.add(label(entity));
  return root;
}
