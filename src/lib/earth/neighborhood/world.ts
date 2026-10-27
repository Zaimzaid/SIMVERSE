/**
 * SIMVERSE Earth: Marina Junction — small deterministic, fictional Lagos-inspired
 * street-block proof. Local scene units are metres, not georeferenced property.
 * The real Phase 4 catalog/ownership systems are intentionally NOT mutated.
 */
export type NeighborhoodBuildingKind = "residential" | "retail" | "office" | "civic";
export interface NeighborhoodBuilding {
  id: string;
  name: string;
  kind: NeighborhoodBuildingKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  accent: number;
}
export interface NeighborhoodTree { x: number; z: number; height: number; }
export interface NeighborhoodPlot {
  id: string; x: number; z: number; width: number; depth: number;
  label: string; status: "visualization-only";
}
export interface NeighborhoodWorld {
  name: string; extent: number;
  roadAxes: number[];
  buildings: NeighborhoodBuilding[];
  trees: NeighborhoodTree[];
  plots: NeighborhoodPlot[];
  spawn: { x: number; z: number };
}

const BLOCK_CENTERS = [-56, 0, 56];
const PALETTE = [0xe5d6c5, 0xcad9d9, 0xf1d7b8, 0xb9d1ce, 0xd8d7cb, 0xf0e7d5];
const ACCENTS = [0x137c9c, 0x0e5b71, 0xc47942, 0x5d8474, 0x755f50];
const SHOPS = ["Marina Café", "Blue Market", "Junction Pharmacy", "Corner Bakery", "Arcade Studio", "Coastal Mart"];
const RESIDENCES = ["Palm Court", "Lagoon Residences", "Westview Homes", "Ocean View Flats", "New Marina House"];
const OFFICES = ["Marina Offices", "Harbour Tech", "Civic House", "Coastal Works"];
const CIVIC = ["Community Centre", "Neighborhood Library"];

function seed(index: number) {
  let x = (index * 1664525 + 1013904223) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

export function createNeighborhoodWorld(): NeighborhoodWorld {
  const buildings: NeighborhoodBuilding[] = [];
  const trees: NeighborhoodTree[] = [];
  const plots: NeighborhoodPlot[] = [];
  let index = 0;
  for (const blockX of BLOCK_CENTERS) {
    for (const blockZ of BLOCK_CENTERS) {
      // Central plaza stays open for the player spawn and civic greenspace.
      const isPark = blockX === 0 && blockZ === 0;
      if (isPark) continue;
      for (const [offsetX, offsetZ] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
        index += 1;
        const x = blockX + offsetX;
        const z = blockZ + offsetZ;
        const isRetail = index % 3 === 0;
        const isOffice = index % 9 === 2;
        const isCivic = index % 13 === 1;
        const kind: NeighborhoodBuildingKind = isCivic ? "civic" : isOffice ? "office"
          : isRetail ? "retail" : "residential";
        const names = kind === "civic" ? CIVIC : kind === "office" ? OFFICES
          : kind === "retail" ? SHOPS : RESIDENCES;
        const width = 12 + Math.round(seed(index + 17) * 3);
        const depth = 12 + Math.round(seed(index + 61) * 3);
        const height = kind === "retail" ? 5.2 : kind === "civic" ? 7.4
          : kind === "office" ? 14 + Math.round(seed(index + 4) * 10)
          : 8 + Math.round(seed(index + 7) * 9);
        const name = names[index % names.length]!;
        buildings.push({
          id: `marina-b-${String(index).padStart(3, "0")}`,
          name, kind, x, z, width, depth, height,
          color: PALETTE[index % PALETTE.length]!,
          accent: ACCENTS[index % ACCENTS.length]!,
        });
        plots.push({
          id: `visual-block-${String(index).padStart(3, "0")}`, x, z,
          width: 19, depth: 19, label: `Block ${String(index).padStart(2, "0")}`,
          status: "visualization-only",
        });
      }
    }
  }
  // Rows of trees remain outside building footprint and walking lanes.
  for (const axis of [-56, 0, 56]) {
    for (const along of [-90, -76, -44, -12, 12, 44, 76, 90]) {
      if (Math.abs(axis) < 1 && Math.abs(along) < 30) continue;
      trees.push({ x: along, z: axis + 21, height: 5 + seed(along + axis + 200) * 2.2 });
      trees.push({ x: axis + 21, z: along, height: 4.6 + seed(along + axis + 300) * 2.5 });
    }
  }
  // A contained park with palms close to the pedestrian promenade.
  for (const x of [-17, -8, 8, 17]) {
    for (const z of [-17, 17]) trees.push({ x, z, height: 5.4 });
  }
  return {
    name: "Marina Junction",
    extent: 116,
    roadAxes: [-84, -28, 28, 84],
    buildings, trees, plots,
    spawn: { x: 0, z: 7 },
  };
}

export function isWalkable(
  world: Pick<NeighborhoodWorld, "buildings" | "extent">,
  x: number,
  z: number,
  radius = 0.85,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > world.extent || Math.abs(z) > world.extent) return false;
  return !world.buildings.some((b) =>
    Math.abs(x - b.x) < b.width / 2 + radius
    && Math.abs(z - b.z) < b.depth / 2 + radius);
}

export function moveWalker(
  world: Pick<NeighborhoodWorld, "buildings" | "extent">,
  position: { x: number; z: number },
  dx: number,
  dz: number,
) {
  const targetX = position.x + dx;
  const targetZ = position.z + dz;
  // Slide along the blocked axis instead of getting stuck on corners.
  const x = isWalkable(world, targetX, position.z) ? targetX : position.x;
  const z = isWalkable(world, x, targetZ) ? targetZ : position.z;
  return { x, z };
}
