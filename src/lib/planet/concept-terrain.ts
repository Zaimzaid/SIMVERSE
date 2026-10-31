import { conceptMapPoint } from "./concept-geography";
import type { PlanetGeometry, PlanetPoint } from "./geometry";

/**
 * Purely fictional, unapproved terrain / ecosystem design indicators.
 * These are scenic layers; they confer no natural-resource ownership,
 * economic yield, development permission, or published geology.
 */
export const CONCEPT_TERRAIN_STATUS = "UNAPPROVED_TERRAIN_STUDY" as const;

export interface ConceptIsland {
  readonly id: string;
  readonly continentId: string;
  readonly name: string;
  readonly geometry: PlanetGeometry;
}

function islandOutline(center: PlanetPoint, seed: number): PlanetGeometry {
  const points: PlanetPoint[] = Array.from({ length: 8 }, (_, i) => {
    const angle = i * Math.PI / 4;
    const scale = 0.75 + Math.abs(Math.sin(seed * 2.4 + i * 1.79)) * 0.3;
    return [
      Number((center[0] + 2.2 * scale * Math.cos(angle)).toFixed(6)),
      Number((center[1] + 1.55 * scale * Math.sin(angle)).toFixed(6)),
    ];
  });
  return { type: "Polygon", coordinates: [[...points, points[0]!] ] };
}

const ISLAND_ANCHORS = [
  ["continent-01", "Northwind Isle", [-172, 38]],
  ["continent-01", "Dawnreef Isle", [-76, 34]],
  ["continent-02", "Western Cay", [-146, -32]],
  ["continent-02", "Sundrift Isle", [-42, -39]],
  ["continent-03", "Silverbay Isle", [-52, 31]],
  ["continent-03", "Eastward Cay", [44, 49]],
  ["continent-04", "Oasis Isle", [32, -27]],
  ["continent-04", "Seafarer Isle", [138, -36]],
  ["continent-05", "Starlight Isle", [94, 40]],
  ["continent-05", "Farwind Cay", [176, 48]],
] as const;

export const CONCEPT_ISLANDS: readonly ConceptIsland[] = ISLAND_ANCHORS.map(([continentId, name, center], index) => ({
  id: `concept-island-${index + 1}`,
  continentId,
  name,
  geometry: islandOutline([center[0], center[1]], index + 1),
}));

export interface ConceptTerrainLine {
  readonly id: string;
  readonly continentId: string;
  readonly name: string;
  readonly points: readonly PlanetPoint[];
}

export const CONCEPT_MOUNTAINS: readonly ConceptTerrainLine[] = [
  { id: "mountain-01", continentId: "continent-01", name: "Western Highlands", points: [[-145,48],[-137,51],[-129,50],[-123,55]] },
  { id: "mountain-02", continentId: "continent-02", name: "Southern Range", points: [[-116,-30],[-112,-35],[-103,-39],[-97,-42]] },
  { id: "mountain-03", continentId: "continent-03", name: "Northern Crest", points: [[-31,48],[-23,51],[-15,47],[-7,50]] },
  { id: "mountain-04", continentId: "continent-04", name: "Central Escarpment", points: [[64,-25],[70,-31],[78,-35],[88,-39]] },
  { id: "mountain-05", continentId: "continent-05", name: "Cloudrise Mountains", points: [[124,48],[135,55],[147,60],[155,56]] },
];

export const CONCEPT_RIVERS: readonly ConceptTerrainLine[] = [
  { id: "river-01", continentId: "continent-01", name: "Longwater", points: [[-124,55],[-116,48],[-113,41],[-106,34]] },
  { id: "river-02", continentId: "continent-02", name: "Southern Flow", points: [[-110,-36],[-102,-39],[-95,-44],[-90,-50]] },
  { id: "river-03", continentId: "continent-03", name: "Silverflow", points: [[-18,51],[-13,44],[-4,36],[5,31],[15,25]] },
  { id: "river-04", continentId: "continent-04", name: "Eastwater", points: [[70,-31],[76,-25],[82,-20],[95,-20],[107,-21]] },
  { id: "river-05", continentId: "continent-05", name: "Moonriver", points: [[134,54],[143,47],[151,41],[157,34]] },
];

export interface ConceptLake {
  readonly id: string;
  readonly continentId: string;
  readonly name: string;
  readonly center: PlanetPoint;
  readonly longitudeRadius: number;
  readonly latitudeRadius: number;
}

export const CONCEPT_LAKES: readonly ConceptLake[] = [
  { id:"lake-01", continentId:"continent-01", name:"Mirror Lake", center:[-116,49],longitudeRadius:2.2,latitudeRadius:1.35 },
  { id:"lake-02", continentId:"continent-02", name:"Garnet Lake", center:[-104,-43],longitudeRadius:2.4,latitudeRadius:1.5 },
  { id:"lake-03", continentId:"continent-03", name:"Starwater Lake", center:[-4,47],longitudeRadius:2.6,latitudeRadius:1.7 },
  { id:"lake-04", continentId:"continent-04", name:"Deepwater Lake", center:[80,-25],longitudeRadius:2.7,latitudeRadius:1.5 },
  { id:"lake-05", continentId:"continent-05", name:"Frostglass Lake", center:[143,54],longitudeRadius:2.4,latitudeRadius:1.5 },
];

export type ConceptBiome = "FOREST" | "GRASSLAND" | "ARID" | "ALPINE" | "WETLAND";
export interface ConceptBiomePatch {
  readonly id: string;
  readonly continentId: string;
  readonly biome: ConceptBiome;
  readonly center: PlanetPoint;
  readonly longitudeRadius: number;
  readonly latitudeRadius: number;
}

export const CONCEPT_BIOMES: readonly ConceptBiomePatch[] = [
  { id:"biome-01", continentId:"continent-01",biome:"FOREST",center:[-138,53],longitudeRadius:5,latitudeRadius:3.7 },
  { id:"biome-02", continentId:"continent-01",biome:"GRASSLAND",center:[-105,45],longitudeRadius:5,latitudeRadius:3 },
  { id:"biome-03", continentId:"continent-02",biome:"ARID",center:[-113,-23],longitudeRadius:4,latitudeRadius:3 },
  { id:"biome-04", continentId:"continent-02",biome:"GRASSLAND",center:[-85,-44],longitudeRadius:5,latitudeRadius:3 },
  { id:"biome-05", continentId:"continent-03",biome:"ALPINE",center:[-20,51],longitudeRadius:4.5,latitudeRadius:3 },
  { id:"biome-06", continentId:"continent-03",biome:"FOREST",center:[12,44],longitudeRadius:5.5,latitudeRadius:3 },
  { id:"biome-07", continentId:"continent-04",biome:"GRASSLAND",center:[62,-20],longitudeRadius:5,latitudeRadius:3 },
  { id:"biome-08", continentId:"continent-04",biome:"WETLAND",center:[101,-40],longitudeRadius:5,latitudeRadius:3 },
  { id:"biome-09", continentId:"continent-05",biome:"FOREST",center:[120,36],longitudeRadius:5,latitudeRadius:3 },
  { id:"biome-10", continentId:"continent-05",biome:"ALPINE",center:[151,51],longitudeRadius:5,latitudeRadius:3 },
];

export type ConceptResource = "TIMBER" | "AGRICULTURE" | "MINERALS" | "ENERGY" | "FRESHWATER";
export interface ConceptResourceSite {
  readonly id: string;
  readonly continentId: string;
  readonly resource: ConceptResource;
  readonly label: string;
  readonly center: PlanetPoint;
}

export const CONCEPT_RESOURCE_SITES: readonly ConceptResourceSite[] = [
  { id:"resource-01",continentId:"continent-01",resource:"TIMBER",label:"Northern forest survey",center:[-138,53] },
  { id:"resource-02",continentId:"continent-01",resource:"MINERALS",label:"Eastern ridge survey",center:[-105,45] },
  { id:"resource-03",continentId:"continent-02",resource:"MINERALS",label:"Southern mineral survey",center:[-111,-42] },
  { id:"resource-04",continentId:"continent-02",resource:"AGRICULTURE",label:"Eastern valley survey",center:[-80,-30] },
  { id:"resource-05",continentId:"continent-03",resource:"FRESHWATER",label:"Northern freshwater survey",center:[-23,48] },
  { id:"resource-06",continentId:"continent-03",resource:"ENERGY",label:"Eastern energy survey",center:[15,35] },
  { id:"resource-07",continentId:"continent-04",resource:"AGRICULTURE",label:"Central plain survey",center:[66,-22] },
  { id:"resource-08",continentId:"continent-04",resource:"MINERALS",label:"Southern mineral survey",center:[101,-38] },
  { id:"resource-09",continentId:"continent-05",resource:"TIMBER",label:"Western forest survey",center:[124,46] },
  { id:"resource-10",continentId:"continent-05",resource:"ENERGY",label:"Eastern energy survey",center:[153,44] },
];

/** Shared projections for the map and optional CanvasTexture concept globe. */
export function conceptLinePath(points: readonly PlanetPoint[]): string {
  return points.map((point, index) => {
    const [x, y] = conceptMapPoint(point);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export function conceptIslandPath(island: ConceptIsland): string {
  if (island.geometry.type !== "Polygon") throw new Error("Island geometry must be Polygon");
  return conceptLinePath(island.geometry.coordinates[0]!) + " Z";
}

export const CONCEPT_BIOME_COLORS: Readonly<Record<ConceptBiome, string>> = {
  FOREST: "#1d804f",
  GRASSLAND: "#a5bb5e",
  ARID: "#d3a360",
  ALPINE: "#bfc5d2",
  WETLAND: "#4fba9f",
};
