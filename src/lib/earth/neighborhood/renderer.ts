import {
  ACESFilmicToneMapping, AmbientLight, BoxGeometry, CanvasTexture, CircleGeometry,
  Color, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry, FogExp2,
  Group, InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  Raycaster, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  type BufferGeometry, type Material, type Texture,
} from "three";
import {
  createNeighborhoodWorld, moveWalker,
  type NeighborhoodBuilding, type NeighborhoodWorld,
} from "./world";

export type NeighborhoodQuality = "LOW" | "MEDIUM" | "HIGH";
export type NeighborhoodCameraMode = "WALK" | "OVERVIEW";
export type NeighborhoodSelection = { id: string; name: string; kind: string } | null;

const ROAD = 0x283747, CURB = 0xdacbb5, LEAF = 0x39755a;
const SHOWCASE = "Fictional development visual proof. Not surveyed Lagos or acquired land.";

export class NeighborhoodRenderer {
  readonly world: NeighborhoodWorld = createNeighborhoodWorld();
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(54, 1, 0.1, 540);
  readonly renderer: WebGLRenderer;
  readonly onSelect: (selection: NeighborhoodSelection) => void;
  readonly canvas: HTMLCanvasElement;
  readonly walker = { ...this.world.spawn };
  readonly keys = new Set<string>();
  private readonly materials = new Map<number, MeshStandardMaterial>();
  private readonly clickable: Mesh[] = [];
  private readonly cars: Array<{ root: Group; axis: number; direction: number; offset: number }> = [];
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly scenery = new Group();
  private readonly highlight = new Group();
  private readonly keyLight = new DirectionalLight(0xfff1cf, 2.15);
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement | null)?.tagName ?? "")) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
      event.preventDefault();
      this.keys.add(key);
    }
  };
  private readonly onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.key.toLowerCase()); };
  private readonly onBlur = () => this.keys.clear();
  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.dragging = true;
    this.canvas.setPointerCapture(event.pointerId);
  };
  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.dragging) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.yaw -= dx * 0.005;
    this.pitch = Math.min(1.03, Math.max(0.22, this.pitch + dy * 0.003));
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };
  private readonly onPointerUp = (event: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    const distance = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    if (distance < 7) this.pick(event);
  };
  private readonly onPointerCancel = () => { this.dragging = false; };
  private readonly onResize = () => this.resize();
  private pointerStart = { x: 0, y: 0 };
  private lastPointer = { x: 0, y: 0 };
  private dragging = false;
  private quality: NeighborhoodQuality;
  private mode: NeighborhoodCameraMode = "WALK";
  private joystick = { forward: 0, strafe: 0 };
  private yaw = 0.55;
  private pitch = 0.38;
  private lastTime = 0;
  private lastDraw = 0;
  private frame = 0;
  private running = false;
  private raf = 0;
  private readonly resizeObserver: ResizeObserver;
  private onMove: (x: number, z: number) => void;
  private readonly groundPlane: Mesh;

  constructor(
    canvas: HTMLCanvasElement,
    quality: NeighborhoodQuality,
    onSelect: (selection: NeighborhoodSelection) => void,
    onMove: (x: number, z: number) => void,
  ) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onMove = onMove;
    this.quality = quality;
    this.renderer = new WebGLRenderer({ canvas, antialias: quality !== "LOW", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "HIGH" ? 1.7 : quality === "MEDIUM" ? 1.25 : 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.36;
    this.renderer.shadowMap.enabled = quality === "HIGH";
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color(0x9fc7da);
    this.scene.fog = new FogExp2(0x9fc7da, 0.0035);
    this.scene.add(new AmbientLight(0xcce9f7, 1.65));
    this.keyLight.position.set(-45, 94, 52);
    this.keyLight.castShadow = quality === "HIGH";
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -150;
    this.keyLight.shadow.camera.right = 150;
    this.keyLight.shadow.camera.top = 150;
    this.keyLight.shadow.camera.bottom = -150;
    this.keyLight.shadow.camera.far = 350;
    this.keyLight.shadow.bias = -0.00035;
    this.scene.add(this.keyLight);
    this.scene.add(this.scenery);
    this.scene.add(this.highlight);
    this.groundPlane = this.box(260, 0.18, 260, 0, -0.17, 0, 0x809e78);
    this.groundPlane.receiveShadow = quality === "HIGH";
    this.addStreets();
    this.addNeighborhoodBlocks();
    this.addBuildings();
    this.addTrees();
    this.addStreetFurniture();
    this.addVehicles();
    this.attachEvents();
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(canvas);
    this.resize();
    this.start();
  }

  get notice() { return SHOWCASE; }
  private mat(hex: number) {
    let material = this.materials.get(hex);
    if (!material) {
      material = new MeshStandardMaterial({ color: hex, roughness: 0.82, metalness: 0.05 });
      this.materials.set(hex, material);
    }
    return material;
  }
  private box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, parent: Group = this.scenery) {
    const mesh = new Mesh(new BoxGeometry(w, h, d), this.mat(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  private addStreets() {
    for (const axis of this.world.roadAxes) {
      this.box(242, 0.09, 12, 0, 0.02, axis, ROAD);
      this.box(12, 0.09, 242, axis, 0.02, 0, ROAD);
      for (let pos = -107; pos <= 107; pos += 10) {
        if (this.world.roadAxes.some((other) => Math.abs(pos - other) < 8)) continue;
        this.box(3.8, 0.012, 0.13, pos, 0.08, axis, 0xf1dfae);
        this.box(0.13, 0.012, 3.8, axis, 0.08, pos, 0xf1dfae);
      }
      for (const crossing of this.world.roadAxes) {
        for (let k = -4; k <= 4; k += 1) {
          this.box(0.9, 0.014, 2.6, crossing + k * 1.6, 0.085, axis - 8, 0xebeee8);
          this.box(2.6, 0.014, 0.9, axis - 8, 0.085, crossing + k * 1.6, 0xebeee8);
        }
      }
    }
  }
  private addNeighborhoodBlocks() {
    for (const x of [-56, 0, 56]) for (const z of [-56, 0, 56]) {
      const park = x === 0 && z === 0;
      this.box(43.5, 0.17, 43.5, x, 0.13, z, park ? 0x5a9971 : 0xcbbfae);
      this.box(40, 0.026, 40, x, 0.23, z, park ? 0x55956e : 0xb8b3a5);
      if (park) {
        this.box(42, 0.032, 3.5, x, 0.28, z, 0xdfd7c1);
        this.box(3.5, 0.032, 42, x, 0.28, z, 0xdfd7c1);
        this.box(7.5, 0.35, 7.5, 0, 0.43, 0, 0xe1d5bd);
        const statue = new Mesh(new CylinderGeometry(0.9, 1.3, 2.4, 8), this.mat(0x0b687c));
        statue.position.set(0, 1.7, 0); this.scenery.add(statue);
        this.box(2.0, 0.2, 2.0, 0, 3, 0, 0xc3e1db);
      }
    }
    // Distinctive waterfront boulevard and promenade in the east of the scene.
    this.box(3.8, 0.08, 235, 111, 0.12, 0, 0xe4d0aa);
    this.box(8, 0.03, 235, 121, 0.03, 0, 0x4e9baa);
    for (let z = -108; z < 108; z += 9) {
      this.box(0.13, 0.7, 0.13, 113.5, 0.52, z, 0xc8e5e7);
      this.box(0.13, 0.7, 0.13, 119, 0.52, z, 0xc8e5e7);
    }
    this.box(0.12, 0.12, 220, 113.5, 0.88, 0, 0xc8e5e7);
    this.box(0.12, 0.12, 220, 119, 0.88, 0, 0xc8e5e7);
  }
  private signTexture(text: string, background: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = background; context.fillRect(0, 0, 512, 128);
    context.fillStyle = "#f7f8f2";
    context.font = "bold 42px Arial, sans-serif";
    context.textAlign = "center"; context.textBaseline = "middle";
    const label = text.toUpperCase().slice(0, 22);
    let size = 42;
    while (context.measureText(label).width > 468 && size > 22) {
      size -= 2; context.font = `bold ${size}px Arial, sans-serif`;
    }
    context.fillText(label, 256, 67);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.signTextures.add(texture);
    return texture;
  }
  private readonly signTextures = new Set<Texture>();
  private addBuildings() {
    for (const b of this.world.buildings) {
      const base = this.box(b.width, b.height, b.depth, b.x, b.height / 2 + 0.3, b.z, b.color);
      base.castShadow = this.quality === "HIGH";
      base.receiveShadow = this.quality === "HIGH";
      base.userData.buildingId = b.id;
      this.clickable.push(base);
      // Foundation, roof edge and vertical facade ribs create silhouette and depth.
      this.box(b.width + 0.65, 0.38, b.depth + 0.65, b.x, 0.40, b.z, 0x9a9e98);
      this.box(b.width + 0.65, 0.38, b.depth + 0.65, b.x, b.height + 0.40, b.z, b.accent);
      for (const side of [-1, 1]) {
        this.box(0.36, b.height, 0.36, b.x + side * (b.width / 2 - 0.34), b.height / 2 + 0.3, b.z + b.depth / 2 + 0.06, b.accent);
        this.box(0.36, b.height, 0.36, b.x + side * (b.width / 2 - 0.34), b.height / 2 + 0.3, b.z - b.depth / 2 - 0.06, b.accent);
      }
      const floors = Math.max(1, Math.floor((b.height - 1.8) / 3.1));
      if (this.quality !== "LOW") {
        const widthSlots = Math.min(4, Math.floor((b.width - 2) / 2.7));
        for (let floor = 0; floor < floors; floor += 1) {
          const h = 2.2 + floor * 3.1;
          for (let column = 0; column < widthSlots; column += 1) {
            const wx = b.x + (column - (widthSlots - 1) / 2) * 2.8;
            // Dark tinted windows, inset lintels, and pale sill trim.
            for (const side of [-1, 1]) {
              this.box(1.58, 1.78, 0.08, wx, h, b.z + side * (b.depth / 2 + 0.05), 0x284956);
              this.box(1.7, 0.09, 0.14, wx, h + 0.94, b.z + side * (b.depth / 2 + 0.12), 0xe9ebe5);
              this.box(0.04, 1.68, 0.14, wx, h, b.z + side * (b.depth / 2 + 0.13), 0x99c0c8);
            }
          }
        }
      } else {
        for (let floor = 0; floor < floors; floor += 1) {
          this.box(b.width - 1.5, 1.45, 0.09, b.x, 2.3 + floor * 3.1, b.z + b.depth / 2 + 0.06, 0x294d5a);
        }
      }
      // Door always faces street-side north. Shops include a covered arcade.
      this.box(2.3, 2.7, 0.13, b.x, 1.65, b.z + b.depth / 2 + 0.07, 0x264653);
      this.box(2.7, 0.18, 1.1, b.x, 3.03, b.z + b.depth / 2 + 0.58, b.accent);
      if (b.kind === "retail" || b.kind === "civic") {
        this.box(b.width + 0.3, 0.22, 2.1, b.x, 3.8, b.z + b.depth / 2 + 0.7, b.accent);
        const texture = this.signTexture(b.name, "#14566a");
        if (texture) {
          const sign = new Mesh(new PlaneGeometry(Math.min(11, b.width - 0.7), 1.9),
            new MeshBasicMaterial({ map: texture, transparent: false, side: DoubleSide }));
          sign.position.set(b.x, 4.8, b.z + b.depth / 2 + 0.22);
          this.scenery.add(sign);
        }
      }
      if (b.height > 10) {
        this.box(2.7, 0.9, 2.2, b.x + 2.5, b.height + 0.95, b.z - 1.8, 0x879ba4);
        this.box(1.4, 0.5, 1.8, b.x - 2.7, b.height + 0.73, b.z - 2.1, 0x728d95);
      }
    }
  }
  private addTrees() {
    const count = this.quality === "LOW" ? Math.ceil(this.world.trees.length * 0.55) : this.world.trees.length;
    const trunks = new InstancedMesh(new CylinderGeometry(0.19, 0.26, 1, 7), this.mat(0x76553e), count);
    const crowns = new InstancedMesh(new SphereGeometry(1, 8, 6), this.mat(LEAF), count);
    const tops = new InstancedMesh(new SphereGeometry(1, 8, 6), this.mat(0x5c9f68), count);
    const dummy = new Object3D();
    for (let i = 0; i < count; i += 1) {
      const t = this.world.trees[i]!;
      const s = t.height / 5;
      dummy.position.set(t.x, t.height * 0.32, t.z);
      dummy.scale.set(s * 0.85, t.height * 0.64, s * 0.85);
      dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, t.height * 0.78, t.z);
      dummy.scale.set(s * 1.4, s * 1.3, s * 1.4);
      dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x + 0.3, t.height, t.z - 0.12);
      dummy.scale.set(s * 0.98, s * 0.91, s * 0.98);
      dummy.updateMatrix(); tops.setMatrixAt(i, dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    tops.instanceMatrix.needsUpdate = true;
    this.scenery.add(trunks, crowns, tops);
  }
  private addStreetFurniture() {
    for (const x of this.world.roadAxes) for (const z of this.world.roadAxes) {
      // Pole and warm lightbox without costly point lights.
      const lamp = new Mesh(new CylinderGeometry(0.10, 0.14, 5.8, 8), this.mat(0x3b5260));
      lamp.position.set(x + 9, 2.9, z + 9); this.scenery.add(lamp);
      this.box(0.32, 0.20, 1.7, x + 8.4, 5.8, z + 9, 0xeacb89);
      this.box(0.54, 0.3, 0.54, x + 9, 5.72, z + 9, 0x516b74);
    }
    for (const x of [-15, 15]) for (const z of [-6, 6]) {
      this.box(2.5, 0.16, 0.7, x, 0.72, z, 0x8b5f41);
      for (const side of [-0.8, 0.8]) this.box(0.13, 0.6, 0.5, x + side, 0.35, z, 0x3a4f50);
    }
  }
  private addVehicles() {
    for (let i = 0; i < 9; i += 1) {
      const root = new Group();
      const colors = [0xc44c39, 0xecede8, 0x1a7f90, 0xdbb45a, 0x354759];
      this.box(2.6, 0.75, 1.52, 0, 0.54, 0, colors[i % colors.length]!, root);
      this.box(1.32, 0.72, 1.42, -0.17, 1.2, 0, 0x304b59, root);
      for (const x of [-0.78, 0.78]) for (const z of [-0.67, 0.67]) {
        const wheel = new Mesh(new CylinderGeometry(0.31, 0.31, 0.14, 12), this.mat(0x171f28));
        wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 0.31, z); root.add(wheel);
      }
      const vertical = i % 2 === 0;
      if (vertical) root.rotation.y = Math.PI / 2;
      this.scenery.add(root);
      this.cars.push({ root, axis: vertical ? -28 : 28, direction: vertical ? 1 : -1, offset: (i * 23) % 230 - 115 });
    }
  }
  setQuality(quality: NeighborhoodQuality) {
    // Recreating the scene on quality change would remesh all details;
    // adjust renderer cost immediately and use quality on next mount.
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "HIGH" ? 1.7 : quality === "MEDIUM" ? 1.25 : 1));
    this.renderer.shadowMap.enabled = quality === "HIGH";
    this.keyLight.castShadow = quality === "HIGH";
    this.resize();
  }
  setCameraMode(mode: NeighborhoodCameraMode) { this.mode = mode; }
  setJoystick(forward: number, strafe: number) { this.joystick = { forward, strafe }; }
  private attachEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
  }
  private pick(event: PointerEvent) {
    const box = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - box.left) / Math.max(1, box.width)) * 2 - 1,
      -((event.clientY - box.top) / Math.max(1, box.height)) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.clickable, false)[0];
    const id = hit?.object.userData.buildingId as string | undefined;
    this.highlight.clear();
    if (!id) { this.onSelect(null); return; }
    const building = this.world.buildings.find((candidate) => candidate.id === id);
    if (!building) return;
    const outline = new LineSegments(
      new EdgesGeometry(new BoxGeometry(building.width + 0.28, building.height + 0.28, building.depth + 0.28)),
      new LineBasicMaterial({ color: 0xffd17e, depthTest: false }),
    );
    outline.position.set(building.x, building.height / 2 + 0.30, building.z);
    this.highlight.add(outline);
    this.onSelect({ id: building.id, name: building.name, kind: building.kind });
  }
  private readonly tick = (timestamp: number) => {
    if (!this.running) return;
    const delta = Math.min(0.05, (timestamp - (this.lastTime || timestamp)) / 1000);
    this.lastTime = timestamp;
    const throttle = this.quality === "LOW" ? 30 : this.quality === "MEDIUM" ? 45 : 60;
    if (timestamp - this.lastDraw >= 1000 / throttle) {
      this.lastDraw = timestamp;
      this.update(delta);
      this.renderer.render(this.scene, this.camera);
    }
    this.raf = requestAnimationFrame(this.tick);
  };
  private update(delta: number) {
    if (this.mode === "WALK") {
      const forward = Number(this.keys.has("w") || this.keys.has("arrowup"))
        - Number(this.keys.has("s") || this.keys.has("arrowdown")) + this.joystick.forward;
      const side = Number(this.keys.has("d") || this.keys.has("arrowright"))
        - Number(this.keys.has("a") || this.keys.has("arrowleft")) + this.joystick.strafe;
      const magnitude = Math.hypot(forward, side);
      if (magnitude > 0.02) {
        const speed = this.keys.has("shift") ? 17 : 9;
        const f = forward / Math.max(1, magnitude) * speed * delta;
        const s = side / Math.max(1, magnitude) * speed * delta;
        const dx = -Math.sin(this.yaw) * f + Math.cos(this.yaw) * s;
        const dz = -Math.cos(this.yaw) * f - Math.sin(this.yaw) * s;
        const next = moveWalker(this.world, this.walker, dx, dz);
        this.walker.x = next.x; this.walker.z = next.z;
        if (++this.frame % 8 === 0) this.onMove(next.x, next.z);
      }
      const distance = 12;
      this.camera.position.set(
        this.walker.x + Math.sin(this.yaw) * distance * Math.cos(this.pitch),
        2.1 + distance * Math.sin(this.pitch),
        this.walker.z + Math.cos(this.yaw) * distance * Math.cos(this.pitch),
      );
      this.camera.lookAt(this.walker.x, 2.1, this.walker.z);
    } else {
      this.camera.position.set(135, 155, 145);
      this.camera.lookAt(0, 0, 0);
    }
    for (const car of this.cars) {
      car.offset += car.direction * delta * 4.5;
      if (car.offset > 118) car.offset = -118;
      if (car.offset < -118) car.offset = 118;
      const vertical = car.root.rotation.y !== 0;
      car.root.position.set(vertical ? car.axis + (car.direction > 0 ? 2.7 : -2.7) : car.offset,
        0.07, vertical ? car.offset : car.axis + (car.direction > 0 ? 2.7 : -2.7));
    }
  }
  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 600 ? 65 : 54;
    this.camera.updateProjectionMatrix();
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0; this.lastDraw = 0;
    this.raf = requestAnimationFrame(this.tick);
  }
  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    const geometries = new Set<BufferGeometry>();
    const mats = new Set<Material>();
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        geometries.add(object.geometry);
        const entry = object.material;
        for (const material of Array.isArray(entry) ? entry : [entry]) mats.add(material);
      }
    });
    for (const texture of this.signTextures) texture.dispose();
    for (const geo of geometries) geo.dispose();
    for (const material of mats) material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
