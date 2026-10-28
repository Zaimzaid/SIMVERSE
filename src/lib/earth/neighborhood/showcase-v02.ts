/**
 * Marina Junction V0.2: a deliberately compact, visual-first streetscape.
 * These are original procedural models, not downloaded copyrighted assets.
 * All content is fictional, non-georeferenced, and never writes land ownership.
 */
import {
  BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  SphereGeometry, SRGBColorSpace, type Texture,
} from "three";
import type { NeighborhoodBuilding } from "./world";

interface Walker {
  root: Group;
  armLeft: Mesh;
  armRight: Mesh;
  x: number;
  z: number;
  distance: number;
  direction: 1 | -1;
  phase: number;
}

interface ShowcaseResult {
  details: Group;
  walkers: Walker[];
  textures: Texture[];
}

function material(hex: number, metalness = 0.02) {
  return new MeshStandardMaterial({ color: hex, roughness: 0.72, metalness });
}

function block(
  parent: Group, width: number, height: number, depth: number,
  x: number, y: number, z: number, color: number,
) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function column(parent: Group, radius: number, height: number,
  x: number, y: number, z: number, color: number, sides = 10) {
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, height, sides), material(color),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Big readable signs, generated locally—no external assets or requests. */
function makeShopSign(parent: Group, name: string, x: number, y: number, z: number, textures: Texture[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#102b39";
  ctx.fillRect(0, 0, 512, 144);
  ctx.fillStyle = "#d9b77b";
  ctx.fillRect(20, 14, 472, 4);
  ctx.fillRect(20, 126, 472, 4);
  ctx.font = "bold 37px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff4da";
  const label = name.toUpperCase().slice(0, 24);
  while (ctx.measureText(label).width > 455 && parseInt(ctx.font.match(/\d+/)?.[0] ?? "37", 10) > 22) {
    const size = parseInt(ctx.font.match(/\d+/)?.[0] ?? "37", 10) - 2;
    ctx.font = `bold ${size}px Arial, sans-serif`;
  }
  ctx.fillText(label, 256, 73);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  textures.push(texture);
  const sign = new Mesh(
    new PlaneGeometry(5.4, 1.52),
    new MeshBasicMaterial({ map: texture, side: DoubleSide }),
  );
  sign.position.set(x, y, z);
  // Front faces the pedestrian walk at the park-side of the building.
  sign.rotation.y = -Math.PI / 2;
  parent.add(sign);
}

/** Park edge street: layered storefronts, awnings, roof pergolas, glass bands. */
function addSignatureFrontages(details: Group, buildings: NeighborhoodBuilding[], textures: Texture[]) {
  const featured = buildings.filter((building) =>
    Math.abs(building.x) === 45 && Math.abs(building.z) === 11
  );
  for (const [i, building] of featured.entries()) {
    const b = building;
    const front = b.x > 0 ? -1 : 1;
    const outsideX = b.x + front * (b.width / 2 + 0.10);
    const colors = [0xb88655, 0x26576a, 0xc2a36b, 0x577a73];
    const trim = colors[i % colors.length]!;
    // Glass retail windows face the nearest boulevard, not the original
    // box's hidden central-face windows.
    block(details, 0.12, 2.35, b.depth - 1.7, outsideX, 1.66, b.z, 0x204553);
    block(details, 0.20, 0.24, b.depth - 1.2, outsideX + front * 0.08, 3.0, b.z, trim);
    for (let j = -2; j <= 2; j += 1) {
      const z = b.z + j * ((b.depth - 2.5) / 5);
      block(details, 0.22, 2.55, 0.08, outsideX + front * 0.08, 1.65, z, 0xc5d5cd);
    }
    // Cantilevered shade and warm soffit, five slats instead of one flat box.
    block(details, 1.65, 0.16, b.depth - 0.8,
      outsideX + front * 0.78, 3.4, b.z, trim);
    for (let j = -2; j <= 2; j++) {
      block(details, 1.45, 0.09, 0.10,
        outsideX + front * 0.8, 3.25,
        b.z + j * (b.depth - 1.5) / 5, 0xefe1c0);
    }
    // Upper-floor balcony band with a restrained rail.
    if (b.height > 8) {
      block(details, 1.08, 0.22, b.depth - 2,
        outsideX + front * 0.35, 6.1, b.z, 0xd5cec0);
      block(details, 0.08, 0.9, b.depth - 2,
        outsideX + front * 0.80, 6.65, b.z, 0x35596a);
      for (let j = -2; j <= 2; j++) {
        block(details, 0.09, 0.9, 0.09,
          outsideX + front * 0.78, 6.55,
          b.z + j * (b.depth - 2) / 4, 0xb3c7c6);
      }
    }
    if (b.x > 0) makeShopSign(details,
      ["MARINA CORNER", "COASTAL MARKET"][i % 2]!,
      outsideX + front * 0.21, 4.70, b.z, textures);
  }
}

/** Give one real, readable place to explore rather than more empty blocks. */
function addPlaza(details: Group) {
  // Existing plaza has a statue at the centre; preserve it. Low planters and
  // stone-edged garden strips frame its circulation without blocking paths.
  const tan = 0xd5c6ab, stone = 0x8d9d90, shrubs = 0x386f53;
  for (const x of [-14, 14]) {
    for (const z of [-14, 14]) {
      block(details, 6.5, 0.48, 5.2, x, 0.45, z, stone);
      block(details, 5.8, 0.28, 4.5, x, 0.83, z, 0x614f3b);
      for (const dx of [-1.75, 0, 1.75]) {
        for (const dz of [-1.1, 1.1]) {
          const canopy = new Mesh(new SphereGeometry(0.71, 7, 5), material(shrubs));
          canopy.position.set(x + dx, 1.29, z + dz);
          details.add(canopy);
        }
      }
    }
  }
  for (const z of [-19.1, 19.1]) {
    for (const x of [-9, 0, 9]) {
      // Small textured-looking surface breaks, not enough to obstruct walks.
      block(details, 3.0, 0.04, 0.30, x, 0.32, z, tan);
    }
  }
  // Contemporary shaded seated pavilion overlooking the plaza.
  for (const x of [-10.8, 10.8]) {
    for (const z of [-4.8, 4.8]) {
      column(details, 0.09, 3.0, x, 1.65, z, 0x3d5156);
      block(details, 2.15, 0.15, 1.5, x, 3.13, z, 0xc9b18b);
      block(details, 1.8, 0.13, 0.42, x, 0.77, z, 0x886447);
      block(details, 1.8, 0.8, 0.12, x, 1.18, z + 0.32, 0x886447);
    }
  }
  // Bus stop at the eastern boulevard, tucked outside the traffic lane.
  const shelterX = 34.2, shelterZ = 0;
  block(details, 3.2, 0.15, 7.5, shelterX, 2.9, shelterZ, 0x294852);
  for (const z of [-3.3, 3.3]) {
    column(details, 0.09, 2.9, shelterX - 1.3, 1.55, shelterZ + z, 0x304853);
  }
  block(details, 0.10, 2.45, 6.65, shelterX + 1.25, 1.57, shelterZ, 0x668d9b);
  block(details, 1.3, 0.16, 4, shelterX, 0.66, shelterZ, 0x9f7b54);
  for (const z of [-2.2, 0, 2.2]) {
    block(details, 1.8, 0.05, 0.08, 22.6, 0.31, z, 0xe5d5b6);
  }
  // Long, consistent edge kerbs around the showcase's main boulevard.
  for (const x of [20.7, 35.5, -20.7, -35.5]) {
    block(details, 0.28, 0.24, 42, x, 0.27, 0, 0xc7bcaa);
  }
}

/** Layered moving residents are illustrative; no AI or persistent NPC state. */
function addPedestrians(group: Group): Walker[] {
  const walkers: Walker[] = [];
  const positions = [
    [-8, -1, 1], [9, 1.2, -1], [-2, 11.5, 1], [3, -11.5, -1],
    [-16, 4, 1], [15, -2, -1], [22, 14, 1], [-22, -10, -1],
  ] as const;
  positions.forEach(([x, z, direction], index) => {
    const person = new Group();
    person.position.set(x, 0.22, z);
    const outfit = [0x355e70, 0xb36643, 0xe3d0ad, 0x658b73, 0x654e6b][index % 5]!;
    column(person, 0.18, 1.04, 0, 1.12, 0, outfit, 8);
    const head = new Mesh(new SphereGeometry(0.23, 8, 6),
      material([0x9d6243, 0xc68762, 0x724930, 0xdaaa83][index % 4]!));
    head.position.set(0, 1.83, 0);
    person.add(head);
    for (const side of [-1, 1]) {
      const leg = column(person, 0.075, 0.67, side * 0.115, 0.44, 0, 0x243743, 6);
      leg.rotation.x = (side === 1 ? 1 : -1) * 0.08;
    }
    const armLeft = column(person, 0.064, 0.77, -0.26, 1.15, 0, 0xc58f6e, 6);
    const armRight = column(person, 0.064, 0.77, 0.26, 1.15, 0, 0xc58f6e, 6);
    person.rotation.y = index % 2 ? 0 : Math.PI;
    group.add(person);
    walkers.push({
      root: person, armLeft, armRight, x, z, distance: 0,
      direction: direction as 1 | -1, phase: index * 0.82,
    });
  });
  return walkers;
}

function addDistantContext(details: Group) {
  // Backdrop volumes ONLY—no implied enterable city or map-data accuracy.
  const backdrop = new Group();
  const palette = [0x7c9a9b, 0x93acaa, 0xa2b9ad, 0x839da3];
  for (let i = 0; i < 32; i++) {
    const angle = 2 * Math.PI * i / 32;
    const radial = 174 + (i % 4) * 10;
    const width = 10 + (i % 5) * 3;
    const height = 10 + (i * 7 % 29);
    const x = Math.sin(angle) * radial;
    const z = Math.cos(angle) * radial;
    block(backdrop, width, height, 12, x, height / 2, z, palette[i % palette.length]!);
  }
  details.add(backdrop);
}

export function createMarinaV02Scene(parent: Group, buildings: NeighborhoodBuilding[]): ShowcaseResult {
  const details = new Group();
  details.name = "Marina Junction V0.2 signature streetscape";
  parent.add(details);
  const textures: Texture[] = [];
  addSignatureFrontages(details, buildings, textures);
  addPlaza(details);
  addDistantContext(details);
  const walkerGroup = new Group();
  walkerGroup.name = "Visual-only animated pedestrians";
  details.add(walkerGroup);
  const walkers = addPedestrians(walkerGroup);
  return { details, walkers, textures };
}

export function animateMarinaResidents(walkers: Walker[], elapsed: number) {
  for (const person of walkers) {
    // Repeat within a constrained pedestrian demonstration strip.
    const length = 6.5;
    const displacement = ((elapsed * (0.45 + (person.phase % 3) * 0.08)) % (2 * length));
    const step = displacement > length ? 2 * length - displacement : displacement;
    person.root.position.x = person.x + step * person.direction;
    person.armLeft.rotation.x = Math.sin(elapsed * 3.2 + person.phase) * 0.38;
    person.armRight.rotation.x = -person.armLeft.rotation.x;
  }
}
