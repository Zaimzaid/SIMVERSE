import {
  BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  SphereGeometry, SRGBColorSpace, type Texture,
} from "three";
import {
  NeighborhoodRenderer, type NeighborhoodQuality, type NeighborhoodSelection,
} from "@/lib/earth/neighborhood/renderer";
import type { TownVisualSnapshot } from "./visual-town";

/** Small, labeled, non-georeferenced economic overlay on the tested walkable town.
 * Decorative movement plays locally; economic events originate on the server.
 */
export class EconomyTownRenderer extends NeighborhoodRenderer {
  private readonly overlay = new Group();
  private readonly textures = new Set<Texture>();
  private readonly landmarkLabels: Mesh[] = [];
  private readonly farmCrops: Mesh[] = [];
  private readonly roadSites: Mesh[] = [];
  private readonly playerShopSigns: Mesh[] = [];
  private readonly freightTruck = new Group();
  private readonly actorsBody: InstancedMesh;
  private readonly actorsHead: InstancedMesh;
  private readonly dummy = new Object3D();
  private movieFrame = 0;
  private playing = true;
  private startTick = 0;
  private economy: TownVisualSnapshot;

  constructor(
    canvas: HTMLCanvasElement,
    quality: NeighborhoodQuality,
    onSelect: (value: NeighborhoodSelection) => void,
    onMove: (x: number, z: number) => void,
    initial: TownVisualSnapshot,
  ) {
    super(canvas, quality, onSelect, onMove);
    this.economy = initial;
    this.scene.add(this.overlay);
    const bodyGeometry = new CylinderGeometry(0.24, 0.3, 1.05, 6);
    const headGeometry = new SphereGeometry(0.25, 7, 5);
    this.actorsBody = new InstancedMesh(bodyGeometry,
      new MeshStandardMaterial({ color: 0x247f8a, roughness: 0.85 }), 18);
    this.actorsHead = new InstancedMesh(headGeometry,
      new MeshStandardMaterial({ color: 0xa17b56, roughness: 0.94 }), 18);
    this.actorsBody.frustumCulled = false;
    this.actorsHead.frustumCulled = false;
    this.overlay.add(this.actorsBody, this.actorsHead);

    // Fictional farms: a real map is not implied. Show visual harvest state.
    this.addBox(16, 0.14, 18, -108, 0.26, -105, 0x67452d);
    for (let i = 0; i < 24; i++) {
      const x = -115 + (i % 6) * 2.55;
      const z = -112 + Math.floor(i / 6) * 4.2;
      const crop = this.addBox(1.5, 0.36, 1.3, x, 0.58, z, 0x4aaf62);
      this.farmCrops.push(crop);
    }
    this.addLabel("WORKING FARM", -108, 4, -118, "#2a6b48", 9);
    // Economic institutions are anchored to fixed mock building locations.
    const facilities = ["FARM DEPOT", "FOOD PROCESSOR", "GROCERY MARKET", "LOGISTICS", "CONSTRUCTION"];
    const buildingIndices = [0, 5, 11, 17, 26];
    for (let i = 0; i < facilities.length; i++) {
      const b = this.world.buildings[buildingIndices[i]!];
      if (!b) continue;
      const sign = this.addLabel(facilities[i]!, b.x, b.height + 2.3, b.z + 0.4, "#135266", 10);
      this.landmarkLabels.push(sign);
    }
    // Transparent indicators for up to five permitted player-run shops.
    for (let i = 0; i < 5; i++) {
      const b = this.world.buildings[([3, 9, 15, 22, 29] as const)[i]!]!;
      const sign = this.addLabel("PLAYER SHOP", b.x, b.height + 2.0, b.z + 0.4, "#8e5a26", 8);
      this.playerShopSigns.push(sign);
    }
    // Construction appears as actual cones/sites after government awards.
    for (let i = 0; i < 12; i++) {
      const construction = new Mesh(new CylinderGeometry(0.08, 0.55, 1.4, 5),
        new MeshStandardMaterial({ color: 0xe27d30, roughness: 0.88 }));
      construction.position.set(-109 + i * 3, 0.8, 83);
      this.overlay.add(construction);
      this.roadSites.push(construction);
    }
    this.addBox(4.5, 1.0, 2.1, 0, 0.85, 0, 0xe6b044, this.freightTruck);
    this.addBox(1.5, 1.2, 2.0, 1.9, 1.1, 0, 0x3d728a, this.freightTruck);
    for (const x of [-1.5, 1.4]) for (const z of [-0.94, 0.94]) {
      const wheel = new Mesh(new CylinderGeometry(0.42, 0.42, 0.25, 9),
        new MeshStandardMaterial({ color: 0x29343b }));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.43, z);
      this.freightTruck.add(wheel);
    }
    this.overlay.add(this.freightTruck);
    this.setSnapshot(initial);
    this.movieFrame = requestAnimationFrame(this.animate);
  }

  private addBox(w: number, h: number, d: number, x: number, y: number, z: number,
      color: number, parent: Group = this.overlay) {
    const mesh = new Mesh(new BoxGeometry(w, h, d),
      new MeshStandardMaterial({ color, roughness: 0.82 }));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  private addLabel(text: string, x: number, y: number, z: number, background: string, width: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 96);
      ctx.strokeStyle = "#d5eee8"; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 88);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 43px Arial, sans-serif";
      while (ctx.measureText(text).width > 490 && Number.parseInt(ctx.font.split("px")[0] || "43") > 20) {
        ctx.font = "bold " + (Number.parseInt(ctx.font.split("px")[0] || "43") - 2) + "px Arial, sans-serif";
      }
      ctx.fillText(text, 256, 49);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textures.add(texture);
    const mesh = new Mesh(new PlaneGeometry(width, 1.8),
      new MeshBasicMaterial({ map: texture, side: DoubleSide }));
    mesh.position.set(x, y, z);
    this.overlay.add(mesh);
    return mesh;
  }
  setSnapshot(next: TownVisualSnapshot) {
    this.economy = next;
    const fieldProductive = next.farmWater >= 8 && next.farmSeeds >= 8;
    for (let i = 0; i < this.farmCrops.length; i++) {
      const crop = this.farmCrops[i]!;
      crop.visible = fieldProductive || (i < Math.min(24, next.farmHarvest * 3));
      crop.scale.y = fieldProductive ? 1 : 0.3;
    }
    const projects = Math.min(this.roadSites.length, next.roadsBuilt);
    this.roadSites.forEach((site, i) => { site.visible = i < projects; });
    this.playerShopSigns.forEach((shop, i) => {
      shop.visible = i < next.playersShops;
    });
    this.freightTruck.visible = next.freightFees > 0;
  }
  private readonly animate = (timestamp: number) => {
    if (!this.playing) return;
    if (!this.startTick) this.startTick = timestamp;
    const seconds = (timestamp - this.startTick) / 1000;
    const visible = Math.min(18, this.economy.population);
    for (let i = 0; i < 18; i++) {
      const lane = [-20.5, 20.5, -75.5, 75.5][i % 4]!;
      const direction = i % 2 === 0 ? 1 : -1;
      const loop = (seconds * 1.1 * direction + i * 14 + 23000) % 220;
      const x = loop - 110;
      const walk = Math.sin(seconds * 6 + i) * 0.07;
      this.dummy.position.set(x, 1.08 + walk, lane);
      this.dummy.scale.setScalar(i < visible ? 1 : 0.0001);
      this.dummy.updateMatrix();
      this.actorsBody.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.y += 0.74;
      this.dummy.updateMatrix();
      this.actorsHead.setMatrixAt(i, this.dummy.matrix);
    }
    this.actorsBody.instanceMatrix.needsUpdate = true;
    this.actorsHead.instanceMatrix.needsUpdate = true;
    if (this.economy.freightFees > 0) {
      const x = -108 + (seconds * 6) % 216;
      this.freightTruck.position.set(x, 0.07, -28);
    }
    this.movieFrame = requestAnimationFrame(this.animate);
  };
  override dispose() {
    this.playing = false;
    cancelAnimationFrame(this.movieFrame);
    for (const texture of this.textures) texture.dispose();
    super.dispose();
  }
}
