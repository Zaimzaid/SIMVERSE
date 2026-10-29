"use client";

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
  DoubleSide,
  ShapeUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import { planetHomeCameraDistance } from "./visual-contract";
import { samplePlanetSurface } from "./surface-field";
import type { PlanetPoint } from "./geometry";

/**
 * Signature Orbital Planet visual proof (Stage 1).
 * Entirely original procedural styling. No Earth shapes, tiles, states or seeded countries.
 * Globe geometry is deliberately isolated from the later authoritative country catalog.
 */
export class SignaturePlanetRenderer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 1, 0.1, 120);
  readonly renderer: WebGLRenderer;
  private readonly root = new Group();
  private readonly previewGroup = new Group();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private planetSurface: Mesh | null = null;
  private readonly resources: Array<{ dispose(): void }> = [];
  private frameId = 0;
  private lastFrameAt = 0;
  private lastTickAt = 0;
  private homeDistance = 7.15;
  private playing = false;
  private reducedMotion = false;
  private readonly lowPower: boolean;

  constructor(canvas: HTMLCanvasElement, reducedMotion: boolean) {
    this.lowPower = window.matchMedia("(max-width: 640px)").matches;
    this.reducedMotion = reducedMotion;
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: false,
      antialias: !this.lowPower,
      powerPreference: "default",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.setClearColor(0x020812, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2));
    this.camera.position.set(0, 0, 7.15);
    this.camera.lookAt(0, 0, 0);

    this.scene.background = new Color("#020812");
    this.scene.add(new AmbientLight(0x8cb8df, 0.92));
    const sun = new DirectionalLight(0xd7efff, 2.55);
    sun.position.set(-4, 3, 6);
    this.scene.add(sun);
    const edge = new DirectionalLight(0x8a6ce5, 0.95);
    edge.position.set(4, -2, -5);
    this.scene.add(edge);

    this.createStars();
    this.createPlanet();
    this.createRings();
    this.root.add(this.previewGroup);
    this.root.rotation.set(-0.13, -0.38, 0);
    this.scene.add(this.root);
    this.resize(canvas.clientWidth, canvas.clientHeight);
    this.draw();
    this.start();
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.resources.push(resource);
    return resource;
  }

  private createSurfaceTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    // Longitude has matching edge pixels; both ends of the image are identical.
    canvas.width = this.lowPower ? 768 : 1024;
    canvas.height = this.lowPower ? 384 : 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Planet surface drawing is unavailable.");
    const data = context.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      const latitude = y / (canvas.height - 1);
      for (let x = 0; x < canvas.width; x++) {
        const longitude = x / (canvas.width - 1);
        const [red, green, blue] = samplePlanetSurface(longitude, latitude);
        const index = (y * canvas.width + x) * 4;
        data.data[index] = red;
        data.data[index + 1] = green;
        data.data[index + 2] = blue;
        data.data[index + 3] = 255;
      }
    }
    context.putImageData(data, 0, 0);
    const texture = this.track(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);
    return texture;
  }

  private createPlanet(): void {
    const geometry = this.track(new SphereGeometry(1.55, this.lowPower ? 64 : 96, this.lowPower ? 44 : 72));
    const material = this.track(new MeshStandardMaterial({
      map: this.createSurfaceTexture(),
      color: 0xdbefff,
      roughness: 0.95,
      metalness: 0.04,
      emissive: new Color("#0a2948"),
      emissiveIntensity: 0.18,
    }));
    this.planetSurface = new Mesh(geometry, material);
    this.root.add(this.planetSurface);

    const atmosphere = this.track(new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: BackSide, // Render the glow around the silhouette.
      blending: AdditiveBlending,
      uniforms: {
        glowCyan: { value: new Color("#38dce4") },
        glowViolet: { value: new Color("#7c83d9") },
      },
      vertexShader: `
        varying vec3 vNormalWorld;
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormalWorld;
        varying vec3 vWorldPosition;
        uniform vec3 glowCyan;
        uniform vec3 glowViolet;
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float rim = pow(1.0 - abs(dot(normalize(vNormalWorld), viewDirection)), 4.2);
          vec3 color = mix(glowCyan, glowViolet, clamp(vWorldPosition.y * 0.28 + 0.34, 0.0, 1.0));
          gl_FragColor = vec4(color, rim * 0.28);
        }
      `,
    }));
    this.root.add(new Mesh(this.track(new SphereGeometry(1.61, 64, 48)), atmosphere));
  }

  private createRings(): void {
    // Tilted orbital rings are decoration; they are not borders or selectable land.
    const main = new Group();
    main.rotation.set(1.12, 0.08, -0.27);
    const mainMaterial = this.track(new MeshBasicMaterial({
      color: 0x74f5f3,
      transparent: true,
      opacity: 0.70,
      depthWrite: false,
    }));
    const mainGlowMaterial = this.track(new MeshBasicMaterial({
      color: 0x38dce4,
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      blending: AdditiveBlending,
    }));
    main.add(new Mesh(this.track(new TorusGeometry(2.02, 0.012, 8, 320)), mainMaterial));
    main.add(new Mesh(this.track(new TorusGeometry(2.02, 0.045, 8, 320)), mainGlowMaterial));
    main.add(new Mesh(
      this.track(new TorusGeometry(1.91, 0.0035, 6, 260)),
      this.track(new MeshBasicMaterial({ color: 0xd3ffff, transparent: true, opacity: 0.33, depthWrite: false })),
    ));
    this.root.add(main);

    const secondary = new Group();
    secondary.rotation.set(0.43, 0.27, 0.77);
    secondary.add(new Mesh(
      this.track(new TorusGeometry(2.33, 0.005, 6, 320)),
      this.track(new MeshBasicMaterial({ color: 0xa18fea, opacity: 0.3, transparent: true, depthWrite: false })),
    ));
    this.root.add(secondary);
  }

  private createStars(): void {
    const vertices: number[] = [];
    let seed = 81237;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = this.lowPower ? 380 : 850;
    for (let i = 0; i < count; i++) {
      const direction = random() * Math.PI * 2;
      const height = (random() * 2 - 1);
      const radial = Math.sqrt(1 - height * height);
      const distance = 15 + random() * 40;
      vertices.push(radial * Math.cos(direction) * distance, height * distance, radial * Math.sin(direction) * distance);
    }
    const geometry = this.track(new BufferGeometry());
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    const material = this.track(new PointsMaterial({
      color: 0xa3c5df,
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }));
    this.scene.add(new Points(geometry, material));
  }


  /** Convert a planet-local fictional coordinate into a point on the surface. */
  private at(longitude: number, latitude: number, radius = 1.563): Vector3 {
    const lon = longitude * Math.PI / 180;
    const lat = latitude * Math.PI / 180;
    return new Vector3(-radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon));
  }

  /** Pick the globe, not the decorative rings, and return fictional lon/lat. */
  pick(clientX: number, clientY: number): PlanetPoint | null {
    if (!this.planetSurface) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.root.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.planetSurface, false)[0];
    if (!hit) return null;
    const local = this.root.worldToLocal(hit.point.clone()).normalize();
    return [Math.atan2(local.z, -local.x) * 180 / Math.PI, Math.asin(Math.max(-1, Math.min(1, local.y))) * 180 / Math.PI];
  }

  /** Draw a temporary border/transparent fill without mutating any database. */
  showTerritory(points: readonly PlanetPoint[], closed: boolean, color: string): void {
    for (const child of [...this.previewGroup.children]) {
      this.previewGroup.remove(child);
      const mesh = child as Mesh | Line;
      mesh.geometry?.dispose();
      const material = mesh.material as MeshBasicMaterial | LineBasicMaterial | undefined;
      material?.dispose();
    }
    if (!points.length) { this.draw(); return; }
    const hue = new Color(color);
    const shapePoints = points.length > 1 && points[0]![0] === points[points.length - 1]![0]
      && points[0]![1] === points[points.length - 1]![1] ? points.slice(0, -1) : [...points];
    const linePositions: number[] = [];
    for (let i = 0; i < shapePoints.length - 1; i++) {
      const a = shapePoints[i]!, b = shapePoints[i + 1]!;
      const diff = ((b[0] - a[0] + 540) % 360) - 180;
      const steps = Math.max(2, Math.ceil(Math.hypot(diff, b[1] - a[1]) / 1.5));
      for (let j = 0; j < steps; j++) {
        const p = this.at(a[0] + diff * j / steps, a[1] + (b[1] - a[1]) * j / steps);
        linePositions.push(p.x, p.y, p.z);
      }
    }
    if (closed && shapePoints.length >= 3) {
      const a = shapePoints[shapePoints.length - 1]!, b = shapePoints[0]!;
      const diff = ((b[0] - a[0] + 540) % 360) - 180;
      const steps = Math.max(2, Math.ceil(Math.hypot(diff, b[1] - a[1]) / 1.5));
      for (let j = 0; j < steps; j++) {
        const p = this.at(a[0] + diff * j / steps, a[1] + (b[1] - a[1]) * j / steps);
        linePositions.push(p.x, p.y, p.z);
      }
    }
    if (linePositions.length >= 6) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(linePositions, 3));
      const material = new LineBasicMaterial({ color: hue, transparent: true, opacity: 0.94, depthTest: true });
      this.previewGroup.add(new Line(geometry, material));
    }
    const mark = Math.min(shapePoints.length, 80);
    for (let i = 0; i < mark; i++) {
      const marker = new Mesh(new SphereGeometry(0.024, 8, 6), new MeshBasicMaterial({ color: i === mark - 1 ? 0xffffff : hue }));
      marker.position.copy(this.at(shapePoints[i]![0], shapePoints[i]![1], 1.59));
      this.previewGroup.add(marker);
    }
    // Triangulate in locally-unwrapped longitude/latitude and project the
    // subdivided triangles onto the sphere so the preview hugs its curvature.
    if (closed && shapePoints.length >= 3) {
      const unwrapped: Vector2[] = [];
      let longitude = shapePoints[0]![0];
      unwrapped.push(new Vector2(longitude, shapePoints[0]![1]));
      for (let i = 1; i < shapePoints.length; i++) {
        let candidate = shapePoints[i]![0];
        while (candidate - longitude > 180) candidate -= 360;
        while (candidate - longitude < -180) candidate += 360;
        longitude = candidate;
        unwrapped.push(new Vector2(candidate, shapePoints[i]![1]));
      }
      const triangles = ShapeUtils.triangulateShape(unwrapped, []);
      const positions: number[] = [];
      const subdivide = (a: Vector2, b: Vector2, c: Vector2, depth: number): void => {
        if (depth === 0) {
          for (const pt of [a, b, c]) {
            const v = this.at(pt.x, pt.y, 1.558);
            positions.push(v.x, v.y, v.z);
          }
          return;
        }
        const ab = a.clone().add(b).multiplyScalar(0.5);
        const bc = b.clone().add(c).multiplyScalar(0.5);
        const ca = c.clone().add(a).multiplyScalar(0.5);
        subdivide(a, ab, ca, depth - 1);
        subdivide(ab, b, bc, depth - 1);
        subdivide(ca, bc, c, depth - 1);
        subdivide(ab, bc, ca, depth - 1);
      };
      for (const triangle of triangles) {
        const [ai, bi, ci] = triangle;
        if (ai === undefined || bi === undefined || ci === undefined) continue;
        const a = unwrapped[ai], b = unwrapped[bi], c = unwrapped[ci];
        if (a && b && c) subdivide(a, b, c, 2);
      }
      if (positions.length) {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
        const material = new MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.34, side: DoubleSide, depthWrite: false });
        this.previewGroup.add(new Mesh(geometry, material));
      }
    }
    this.draw();
  }

  private draw = (): void => {
    this.renderer.render(this.scene, this.camera);
  };

  private loop = (timestamp: number): void => {
    this.frameId = requestAnimationFrame(this.loop);
    if (document.hidden) {
      this.lastTickAt = timestamp;
      return;
    }
    if (!this.playing || this.reducedMotion) return;
    const frameLimit = this.lowPower ? 1000 / 30 : 1000 / 60;
    if (timestamp - this.lastFrameAt < frameLimit) return;
    const elapsedSeconds = this.lastTickAt ? Math.min((timestamp - this.lastTickAt) / 1000, 0.06) : 0;
    this.lastTickAt = timestamp;
    this.lastFrameAt = timestamp;
    this.root.rotation.y += elapsedSeconds * 0.075;
    this.draw();
  };

  private start(): void {
    this.frameId = requestAnimationFrame(this.loop);
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    const homeDistance = planetHomeCameraDistance(this.camera.aspect);
    const offset = homeDistance - this.homeDistance;
    this.homeDistance = homeDistance;
    this.camera.position.z = Math.max(homeDistance * 0.72, Math.min(homeDistance * 1.45, this.camera.position.z + offset));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.draw();
  }

  rotate(deltaX: number, deltaY: number): void {
    this.root.rotation.y += deltaX * 0.005;
    this.root.rotation.x = Math.max(-1.12, Math.min(1.12, this.root.rotation.x + deltaY * 0.004));
    this.draw();
  }

  zoom(delta: number): void {
    this.camera.position.z = Math.max(this.homeDistance * 0.72, Math.min(this.homeDistance * 1.45, this.camera.position.z + delta));
    this.draw();
  }

  reset(): void {
    this.root.rotation.set(-0.13, -0.38, 0);
    this.camera.position.z = this.homeDistance;
    this.camera.lookAt(0, 0, 0);
    this.draw();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing && !this.reducedMotion;
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (reducedMotion) this.playing = false;
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    for (const resource of this.resources) resource.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

export function checkPlanetWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
