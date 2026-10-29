"use client";

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
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
  type Material,
  type Texture,
} from "three";

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
  private readonly resources: Array<{ dispose(): void }> = [];
  private frameId = 0;
  private lastFrameAt = 0;
  private lastTickAt = 0;
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
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.setClearColor(0x020812, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2));
    this.camera.position.set(0, 0, 7.15);
    this.camera.lookAt(0, 0, 0);

    this.scene.background = new Color("#020812");
    this.scene.add(new AmbientLight(0x416eac, 0.85));
    const sun = new DirectionalLight(0xbcefff, 3.25);
    sun.position.set(-4, 3, 6);
    this.scene.add(sun);
    const edge = new DirectionalLight(0x8a6ce5, 1.75);
    edge.position.set(4, -2, -5);
    this.scene.add(edge);

    this.createStars();
    this.createPlanet();
    this.createRings();
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
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Planet surface drawing is unavailable.");
    const data = context.createImageData(canvas.width, canvas.height);
    let seed = 712309;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const latitude = Math.abs(y / canvas.height - 0.5) * 2;
        const band = Math.sin(y * 0.074 + Math.sin(x * 0.014) * 4) * 6;
        const sweep = Math.sin(x * 0.022 + y * 0.016) * 5;
        const fine = (random() - 0.5) * 10;
        const polar = latitude * 14;
        data.data[index] = Math.max(0, 17 + band + sweep + fine + polar * 0.5);
        data.data[index + 1] = Math.max(0, 53 + band + sweep * 2 + fine + polar);
        data.data[index + 2] = Math.max(0, 83 + band * 2 + sweep * 2 + fine + polar);
        data.data[index + 3] = 255;
      }
    }
    context.putImageData(data, 0, 0);
    // Fine mineral/atmospheric threads, deliberately not landmass-like silhouettes.
    context.globalAlpha = 0.065;
    for (let i = 0; i < 95; i++) {
      const y = random() * canvas.height;
      context.beginPath();
      context.strokeStyle = i % 3 === 0 ? "#8d7ff4" : "#5bd8e4";
      context.lineWidth = 0.5 + random() * 1.2;
      for (let x = 0; x <= canvas.width; x += 16) {
        const currentY = y + Math.sin(x * 0.014 + i) * (4 + random() * 4);
        if (x === 0) context.moveTo(x, currentY);
        else context.lineTo(x, currentY);
      }
      context.stroke();
    }
    const texture = this.track(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);
    return texture;
  }

  private createPlanet(): void {
    const geometry = this.track(new SphereGeometry(1.55, this.lowPower ? 64 : 96, this.lowPower ? 44 : 72));
    const material = this.track(new MeshStandardMaterial({
      map: this.createSurfaceTexture(),
      color: 0xc1e5ff,
      roughness: 0.83,
      metalness: 0.15,
      emissive: new Color("#061a2d"),
      emissiveIntensity: 0.45,
    }));
    this.root.add(new Mesh(geometry, material));

    const atmosphere = this.track(new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: 1, // BackSide: render the glow around the silhouette.
      blending: AdditiveBlending,
      uniforms: {
        glowCyan: { value: new Color("#38dce4") },
        glowViolet: { value: new Color("#8a77e7") },
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
          float rim = pow(1.0 - abs(dot(normalize(vNormalWorld), viewDirection)), 3.1);
          vec3 color = mix(glowCyan, glowViolet, clamp(vWorldPosition.y * 0.28 + 0.34, 0.0, 1.0));
          gl_FragColor = vec4(color, rim * 0.62);
        }
      `,
    }));
    this.root.add(new Mesh(this.track(new SphereGeometry(1.66, 64, 48)), atmosphere));
  }

  private createRings(): void {
    // Tilted orbital rings are decoration; they are not borders or selectable land.
    const main = new Group();
    main.rotation.set(1.12, 0.08, -0.27);
    const mainMaterial = this.track(new MeshBasicMaterial({
      color: 0x74f5f3,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    }));
    const mainGlowMaterial = this.track(new MeshBasicMaterial({
      color: 0x38dce4,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: AdditiveBlending,
    }));
    main.add(new Mesh(this.track(new TorusGeometry(2.02, 0.012, 8, 320)), mainMaterial));
    main.add(new Mesh(this.track(new TorusGeometry(2.02, 0.067, 8, 320)), mainGlowMaterial));
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

  private draw = (): void => {
    this.renderer.render(this.scene, this.camera);
  };

  private loop = (timestamp: number): void => {
    this.frameId = requestAnimationFrame(this.loop);
    if (document.hidden) {
      this.lastTickAt = timestamp;
      return;
    }
    const frameLimit = this.lowPower ? 1000 / 30 : 1000 / 60;
    if (timestamp - this.lastFrameAt < frameLimit) return;
    const elapsedSeconds = this.lastTickAt ? Math.min((timestamp - this.lastTickAt) / 1000, 0.06) : 0;
    this.lastTickAt = timestamp;
    this.lastFrameAt = timestamp;
    if (this.playing && !this.reducedMotion) this.root.rotation.y += elapsedSeconds * 0.075;
    this.draw();
  };

  private start(): void {
    this.frameId = requestAnimationFrame(this.loop);
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
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
    this.camera.position.z = Math.max(4.85, Math.min(10, this.camera.position.z + delta));
    this.draw();
  }

  reset(): void {
    this.root.rotation.set(-0.13, -0.38, 0);
    this.camera.position.z = 7.15;
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
