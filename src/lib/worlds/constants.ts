export const WORLD_STATUSES = [
  "DRAFT", "IN_DESIGN", "REVIEW", "VALIDATED", "RUNTIME_READY", "ARCHIVED",
] as const;
export type WorldStatus = (typeof WORLD_STATUSES)[number];
export type WorldStatusFilter = WorldStatus | "CURRENT" | "ALL";
export const WORLD_STATUS_FILTERS = [...WORLD_STATUSES, "CURRENT", "ALL"] as const;

export const WORLD_STATUS_LABELS: Record<WorldStatusFilter, string> = {
  DRAFT: "Draft", IN_DESIGN: "In design", REVIEW: "Review", VALIDATED: "Validated",
  RUNTIME_READY: "Runtime ready", ARCHIVED: "Archived", CURRENT: "Current worlds", ALL: "All statuses",
};

const STATUS_TRANSITIONS: Record<Exclude<WorldStatus, "ARCHIVED">, readonly WorldStatus[]> = {
  DRAFT: ["IN_DESIGN"],
  IN_DESIGN: ["DRAFT", "REVIEW"],
  REVIEW: ["IN_DESIGN", "VALIDATED"],
  VALIDATED: ["REVIEW", "RUNTIME_READY"],
  RUNTIME_READY: ["VALIDATED"],
};

export function canTransitionWorldStatus(from: WorldStatus, to: WorldStatus): boolean {
  if (from === to) return true;
  if (from === "ARCHIVED" || to === "ARCHIVED") return false;
  return STATUS_TRANSITIONS[from].includes(to);
}

export function isWorldStatus(value: string): value is WorldStatus {
  return (WORLD_STATUSES as readonly string[]).includes(value);
}

export const WORLD_BIOMES = [
  "SAVANNAH", "FOREST", "RAINFOREST", "DESERT", "TUNDRA", "MOUNTAIN",
  "GRASSLAND", "WETLAND", "OCEAN", "COASTAL", "URBAN", "INDUSTRIAL",
  "FARM", "FANTASY", "SPACE", "CUSTOM",
] as const;
export type WorldBiome = (typeof WORLD_BIOMES)[number];

export const WORLD_BIOME_LABELS: Record<WorldBiome, string> = {
  SAVANNAH: "Savannah", FOREST: "Forest", RAINFOREST: "Rainforest", DESERT: "Desert",
  TUNDRA: "Tundra", MOUNTAIN: "Mountain", GRASSLAND: "Grassland", WETLAND: "Wetland",
  OCEAN: "Ocean", COASTAL: "Coastal", URBAN: "Urban", INDUSTRIAL: "Industrial",
  FARM: "Farm", FANTASY: "Fantasy", SPACE: "Space", CUSTOM: "Custom",
};

export const WORLD_VISIBILITIES = ["PRIVATE", "WORKSPACE"] as const;
export type WorldVisibility = (typeof WORLD_VISIBILITIES)[number];

export const WORLD_SORTS = ["updated_desc", "updated_asc", "name_asc", "name_desc"] as const;
export type WorldSort = (typeof WORLD_SORTS)[number];
export const WORLD_SORT_LABELS: Record<WorldSort, string> = {
  updated_desc: "Recently updated", updated_asc: "Oldest updated",
  name_asc: "Name A–Z", name_desc: "Name Z–A",
};

export const WORLD_PAGE_SIZE = 18;
export const WORLD_MAX_PAGE_SIZE = 100;
export const WORLD_BLUEPRINT_VERSION = 1 as const;

export const WEATHER_TYPES = [
  "CLEAR", "CLOUDY", "RAIN", "HEAVY_RAIN", "STORM", "FOG", "DUST", "SNOW", "WINDY", "CUSTOM",
] as const;

export const WATER_TYPES = ["NONE", "RIVER", "LAKE", "POND", "OCEAN", "WETLAND", "CUSTOM"] as const;

export const WORLD_ZONE_TYPES = [
  "SPAWN", "INTERACTION", "COMBAT", "SAFE", "CAMERA", "AUDIO", "WEATHER",
  "BOUNDARY", "RESOURCE", "CUSTOM",
] as const;

export const WORLD_ASSET_ROLES = [
  "ENVIRONMENT", "VEGETATION", "ROCK", "NATURAL_PROP", "BUILDING", "ROAD", "BRIDGE",
  "FENCE", "ARENA", "PROP", "LANDMARK", "TEXTURE", "MATERIAL", "VFX",
  "AUDIO_AMBIENT", "AUDIO_BIOME", "AUDIO_WEATHER", "AUDIO_WATER", "AUDIO_WILDLIFE",
  "AUDIO_STRUCTURE", "AUDIO_MUSIC", "OTHER",
] as const;

export const WORLD_ENTITY_RELATIONSHIPS = ["NATIVE_INHABITANT", "DEFAULT_OCCUPANT"] as const;
