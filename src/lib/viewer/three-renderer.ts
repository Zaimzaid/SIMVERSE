import {
  ACESFilmicToneMapping, Box3, BufferGeometry, Group, Mesh, MeshBasicMaterial, PCFSoftShadowMap,
  PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3,
  WebGLRenderer, type AnimationClip, type Material, type Object3D, type Texture,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { AnimationController } from "./animation-controller";
import { deriveEntityPose } from "./choreography";
import { simverseArena, type ViewerEnvironment } from "./environment";
import { createFallbackAvatar } from "./fallback-avatar";
import type { ViewerFrame, VisualEntityInstance } from "./types";

export type ViewerQuality = "AUTO" | "LOW" | "MEDIUM" | "HIGH";
type Actor = {
  root: Group;
  content: Group;
  fallback: Group;
  controller: AnimationController | null;
  guard: Mesh;
  impact: Mesh;
  dodge: Mesh;
  elimination: Mesh;
  victory: Mesh;
};

function ring(radius: number, color: string, opacity = 0) {
  const material = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const mesh = new Mesh(new TorusGeometry(radius, 0.035, 8, 48), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function opacity(mesh: Mesh, value: number) { (mesh.material as MeshBasicMaterial).opacity = Math.max(0, Math.min(1, value)); }

export class ThreeViewerRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 120);
  private readonly loader = new GLTFLoader();
  private readonly actors = new Map<string, Actor>();
  private readonly modelCache = new Map<string, Promise<GLTF | null>>();
  private readonly loadedModels = new Set<GLTF>();
  private readonly warnings: string[] = [];
  private disposed = false;
  private quality: ViewerQuality = "AUTO";
  private readonly environment: ViewerEnvironment;

  constructor(private readonly canvas: HTMLCanvasElement, entities: VisualEntityInstance[], environment: ViewerEnvironment = simverseArena) {
    this.environment = environment;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    environment.create(this.scene);
    for (const entity of entities) {
      const root = new Group(); root.position.set(entity.x, 0, entity.z);
      const content = new Group(); root.add(content);
      const fallback = createFallbackAvatar(entity); content.add(fallback);
      const guard = new Mesh(new SphereGeometry(0.97, 24, 12), new MeshBasicMaterial({ color: "#8ddbff", wireframe: true, transparent: true, opacity: 0, depthWrite: false }));
      guard.position.y = 1.3; root.add(guard);
      const impact = ring(0.55, "#ff715d"); impact.position.y = 1.3; impact.rotation.x = 0; root.add(impact);
      const dodge = ring(0.68, "#84f5ff"); dodge.position.y = 0.06; root.add(dodge);
      const elimination = ring(0.8, "#fd5e88"); elimination.position.y = 0.08; root.add(elimination);
      const victory = ring(0.82, "#f6d366"); victory.position.y = 0.07; root.add(victory);
      this.scene.add(root);
      this.actors.set(entity.id, { root, content, fallback, controller: null, guard, impact, dodge, elimination, victory });
    }
    this.setQuality("AUTO");
    this.resize();
  }

  get loadWarnings() { return [...this.warnings]; }

  private effectiveQuality(): Exclude<ViewerQuality, "AUTO"> {
    if (this.quality !== "AUTO") return this.quality;
    return window.matchMedia("(max-width: 700px)").matches ? "LOW" : "MEDIUM";
  }

  setQuality(quality: ViewerQuality) {
    this.quality = quality;
    const level = this.effectiveQuality();
    this.renderer.shadowMap.enabled = level !== "LOW";
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, level === "LOW" ? 1 : level === "HIGH" ? 2 : 1.5));
    this.resize();
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 520 ? 51 : 42;
    this.camera.updateProjectionMatrix();
  }

  private load(url: string): Promise<GLTF | null> {
    const existing = this.modelCache.get(url);
    if (existing) return existing;
    const promise = this.loader.loadAsync(url).then((asset) => {
      if (this.disposed) { disposeObjects([asset.scene]); return null; }
      this.loadedModels.add(asset);
      return asset;
    }).catch(() => {
      this.warnings.push(`A 3D model could not be loaded; a SIMVERSE avatar is shown instead.`);
      return null;
    });
    this.modelCache.set(url, promise);
    return promise;
  }

  private async loadWithTimeout(url: string): Promise<GLTF | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.load(url),
        new Promise<null>((resolve) => { timer = setTimeout(() => {
          if (!this.disposed) this.warnings.push("A 3D model timed out; a SIMVERSE avatar is shown instead.");
          resolve(null);
        }, 8000); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }

  /** Load each distinct model once, clone rigs per participant, and keep the fallback until a model is ready. */
  async preloadModels(entities: VisualEntityInstance[]) {
    await Promise.all(entities.map(async (entity) => {
      const url = entity.profile.modelUrl;
      if (!url) return;
      const asset = await this.loadWithTimeout(url);
      if (!asset || this.disposed) return;
      const actor = this.actors.get(entity.id);
      if (!actor) return;
      try {
        const model = cloneSkeleton(asset.scene) as Group;
        const bounds = new Box3().setFromObject(model);
        const size = bounds.getSize(new Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(maxDimension) || maxDimension < 0.001) throw new Error("Empty 3D model");
        const factor = 2.25 / maxDimension * entity.profile.scale;
        model.scale.setScalar(factor);
        model.position.y = -bounds.min.y * factor + 0.05;
        model.rotation.y = entity.profile.orientationDegrees * Math.PI / 180;
        model.traverse((object) => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; } });
        actor.content.add(model);
        actor.fallback.visible = false;
        actor.controller = new AnimationController(model, asset.animations as AnimationClip[], entity.profile.animationProfile);
      } catch {
        this.warnings.push(`A 3D model was invalid; a SIMVERSE avatar is shown instead.`);
      }
    }));
  }

  draw(frame: ViewerFrame, entities: VisualEntityInstance[]) {
    if (this.disposed) return;
    for (const entity of entities) {
      const actor = this.actors.get(entity.id);
      if (!actor) continue;
      const pose = deriveEntityPose(entity, frame, entities);
      actor.root.position.set(pose.x, pose.y, pose.z);
      actor.root.rotation.y = pose.heading;
      const hasClip = actor.controller?.hasClip(pose.animation) ?? false;
      actor.controller?.update(pose.animation, frame.timeMs);
      actor.content.rotation.z = hasClip ? 0 : pose.tilt;
      actor.content.scale.setScalar(pose.scale * (hasClip ? 1 : 1 + pose.impact * 0.06));
      opacity(actor.guard, pose.guard * 0.23);
      actor.guard.scale.setScalar(1 + pose.guard * 0.04);
      opacity(actor.impact, pose.impact * (pose.critical ? 1 : 0.8));
      (actor.impact.material as MeshBasicMaterial).color.set(pose.critical ? "#ffd46c" : "#ff7869");
      actor.impact.scale.setScalar(1 + (1 - pose.impact) * 1.1);
      opacity(actor.dodge, pose.dodge * 0.85);
      actor.dodge.scale.setScalar(1 + (1 - pose.dodge) * 0.85);
      opacity(actor.elimination, pose.elimination * 0.65);
      actor.elimination.scale.setScalar(1 + pose.elimination * 0.8);
      opacity(actor.victory, pose.victory * (frame.reducedMotion ? 0.45 : 0.65 + Math.sin(frame.timeMs * 0.006) * 0.17));
      actor.victory.rotation.z = frame.reducedMotion ? 0 : frame.timeMs * 0.0005;
    }
    const focusX = frame.camera.x;
    const focusZ = frame.camera.z;
    const mobile = this.camera.aspect < 1;
    const blend = Math.max(0, Math.min(1, (frame.timeMs - frame.introMs) / (frame.reducedMotion ? 1 : 650)));
    const wideDistance = mobile ? 18 : this.environment.cameraDistance;
    const actionDistance = mobile ? entities.length > 2 ? 14.8 : 13.5 : entities.length > 2 ? 15 : 12.5;
    const distance = (wideDistance + (actionDistance - wideDistance) * blend) / frame.camera.zoom;
    const orbit = frame.reducedMotion ? 0 : Math.sin(frame.timeMs * 0.0003) * 0.24;
    this.camera.position.set(focusX + orbit + frame.camera.shake, mobile ? 8.2 : 6.2, focusZ + distance);
    this.camera.lookAt(focusX, 1.15, focusZ);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const actor of this.actors.values()) actor.controller?.dispose();
    disposeObjects([this.scene, ...[...this.loadedModels].map((asset) => asset.scene)]);
    this.actors.clear(); this.loadedModels.clear(); this.modelCache.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

function disposeObjects(roots: Object3D[]) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  for (const root of roots) root.traverse((object) => {
    if ("geometry" in object && object.geometry instanceof BufferGeometry) geometries.add(object.geometry);
    if ("material" in object && object.material && typeof object.material === "object") {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material as Material);
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value && typeof value === "object" && "isTexture" in value) textures.add(value as Texture);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    texture.dispose();
    const image = texture.image as { close?: () => void } | undefined;
    image?.close?.();
  }
}
