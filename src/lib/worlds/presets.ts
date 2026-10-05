import type { WorldBiome } from "./constants";
import type { WorldBlueprintV1 } from "./schemas";

export interface WorldPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  biome: WorldBiome;
  tags: string[];
  blueprint: WorldBlueprintV1;
}

function baseBlueprint(overrides: Partial<WorldBlueprintV1> = {}): WorldBlueprintV1 {
  const base: WorldBlueprintV1 = {
    version: 1,
    terrain: {
      type: "ROLLING", elevation: { minimumMeters: 0, maximumMeters: 80, profile: undefined }, roughness: 0.3,
      slope: { minimumDegrees: 0, maximumDegrees: 18, profile: undefined }, traversability: "MIXED",
      surfaceTypes: [{ type: "soil", weight: 0.6 }, { type: "grass", weight: 0.4 }],
      boundary: { shape: "RECTANGLE", metadata: {} },
      dimensions: { width: 2000, length: 2000, height: 400, unit: "METER" },
      coordinates: { unit: "METER", upAxis: "Y", handedness: "RIGHT", origin: { x: 0, y: 0, z: 0 } },
    },
    climate: {
      type: "TEMPERATE", temperatureCelsius: { minimum: 8, maximum: 28 },
      humidityPercent: { minimum: 35, maximum: 75 }, annualRainfallMillimeters: 900,
      windMetersPerSecond: { minimum: 0, maximum: 18, prevailingDirectionDegrees: 240 },
      visibilityMeters: 20_000, seasons: [],
    },
    weather: [{ identifier: "clear", type: "CLEAR", weight: 0.7, metadata: {} }, { identifier: "rain", type: "RAIN", weight: 0.3, metadata: {} }],
    time: { mode: "DYNAMIC", initialTime: "09:00", timeScale: 60, sunrise: "06:15", sunset: "18:30", season: undefined },
    ecology: { vegetationLayers: [], habitatObjects: [], notes: undefined }, water: [], zones: [], spawnSets: [],
    compatibleEntityCategories: [],
    camera: { defaultMode: "OVERVIEW", zonePriority: [] },
    audio: { ambient: [], biome: [], weather: [], water: [], wildlife: [], structures: [], music: [] },
    presentation: {
      gravityProfileReference: undefined, lightingProfileReference: undefined, atmosphereProfile: undefined,
      fogProfile: undefined, skyProfile: undefined, navigationPreference: "GROUND", destructionPolicy: "NONE", boundaryPolicy: "BLOCK", metadata: {},
    },
  };
  return { ...base, ...overrides };
}

const savannah: WorldPreset = {
  id: "simverse-savannah", name: "SIMVERSE Savannah", category: "natural-environment", biome: "SAVANNAH",
  description: "An original open grassland blueprint with watering-hole zones and predator/prey start sets.",
  tags: ["savannah", "wildlife", "open-terrain"],
  blueprint: baseBlueprint({
    terrain: {
      type: "ROLLING", elevation: { minimumMeters: 880, maximumMeters: 1040, profile: "Broad plains with low rocky rises." },
      roughness: 0.24, slope: { minimumDegrees: 0, maximumDegrees: 16, profile: "Mostly gentle slopes." }, traversability: "OPEN",
      surfaceTypes: [{ type: "dry-grass", weight: 0.62 }, { type: "packed-soil", weight: 0.28 }, { type: "rock", weight: 0.1 }],
      boundary: { shape: "RECTANGLE", metadata: { edgeTreatment: "distant-horizon" } },
      dimensions: { width: 4000, length: 4000, height: 600, unit: "METER" },
      coordinates: { unit: "METER", upAxis: "Y", handedness: "RIGHT", origin: { x: 0, y: 0, z: 0 } },
    },
    climate: {
      type: "TROPICAL_WET_DRY", temperatureCelsius: { minimum: 16, maximum: 36 }, humidityPercent: { minimum: 25, maximum: 78 },
      annualRainfallMillimeters: 760, windMetersPerSecond: { minimum: 1, maximum: 24, prevailingDirectionDegrees: 100 },
      visibilityMeters: 30_000, seasons: [
        { identifier: "dry", label: "Dry season", metadata: { months: 7 } },
        { identifier: "wet", label: "Wet season", metadata: { months: 5 } },
      ],
    },
    weather: [
      { identifier: "clear", type: "CLEAR", weight: 0.62, metadata: {} },
      { identifier: "dust", type: "DUST", weight: 0.18, metadata: { intensity: "light" } },
      { identifier: "rain", type: "RAIN", weight: 0.2, metadata: {} },
    ],
    time: { mode: "DYNAMIC", initialTime: "07:30", timeScale: 90, sunrise: "06:10", sunset: "18:35", season: "dry" },
    ecology: {
      vegetationLayers: [
        { identifier: "dry_grass", label: "Dry grass layer", coverage: 0.68, assetIdentifiers: [], placeholderDescription: "Asset slot for original dry grass clusters." },
        { identifier: "acacia", label: "Acacia layer", coverage: 0.08, assetIdentifiers: [], placeholderDescription: "Asset slot for original SIMVERSE acacia trees." },
      ],
      habitatObjects: [{ identifier: "rock_outcrops", label: "Rock outcrops", assetIdentifiers: [], placeholderDescription: "Asset slot for weathered rock groups." }],
      notes: "Vegetation entries are content slots until workspace Assets are associated.",
    },
    water: [{ identifier: "watering_hole", type: "POND", zoneIdentifier: "watering_hole", metadata: { seasonal: true } }],
    zones: [
      { identifier: "watering_hole", name: "Watering hole", type: "INTERACTION", priority: 20, bounds: { shape: "CYLINDER", center: { x: 0, y: 0, z: 150 }, radius: 140, metadata: { heightMeters: 12 } }, allowedParticipants: [], tags: ["water", "wildlife"], configuration: {} },
      { identifier: "overview_camera", name: "Savannah overview", type: "CAMERA", priority: 10, bounds: { shape: "BOX", center: { x: 0, y: 120, z: 0 }, size: { x: 1200, y: 240, z: 1200 }, metadata: {} }, allowedParticipants: [], tags: ["overview"], configuration: {} },
    ],
    spawnSets: [
      { identifier: "PredatorStart", name: "Predator start", spawns: [{ identifier: "predator_1", position: { x: -650, y: 0, z: -400 }, rotationDegrees: { pitch: 0, yaw: 35, roll: 0 }, allowedArchetypes: ["QUADRUPED"], allowedCategories: ["animal", "creature"], tags: ["predator"] }] },
      { identifier: "PreyStart", name: "Prey start", spawns: [{ identifier: "prey_1", position: { x: 650, y: 0, z: 400 }, rotationDegrees: { pitch: 0, yaw: -145, roll: 0 }, allowedArchetypes: ["QUADRUPED"], allowedCategories: ["animal", "creature"], tags: ["prey"] }] },
    ],
    compatibleEntityCategories: ["animal", "creature", "vehicle", "person"],
    camera: {
      defaultMode: "OVERVIEW", intro: { mode: "OVERVIEW", zoneIdentifier: "overview_camera", configuration: {} },
      overview: { mode: "OVERVIEW", position: { x: 0, y: 160, z: 700 }, lookAt: { x: 0, y: 0, z: 0 }, zoneIdentifier: undefined, configuration: {} },
      result: { mode: "ORBIT", zoneIdentifier: undefined, configuration: {} }, spectator: { mode: "FOLLOW", zoneIdentifier: undefined, configuration: {} }, zonePriority: ["overview_camera"],
    },
    audio: { ambient: [], biome: [], weather: [], water: [], wildlife: [], structures: [], music: [] },
    presentation: {
      lightingProfileReference: "warm-savannah-day", atmosphereProfile: "dry-open-air", fogProfile: "distant-haze",
      skyProfile: "savannah-dynamic-sky", gravityProfileReference: "earth-standard", navigationPreference: "GROUND",
      destructionPolicy: "NONE", boundaryPolicy: "RETURN", metadata: { wildlifeAudioSlot: "ambient-wildlife" },
    },
  }),
};

export const WORLD_PRESETS: readonly WorldPreset[] = [
  savannah,
  { id: "temperate-forest", name: "Temperate Forest", category: "natural-environment", biome: "FOREST", description: "Layered woodland with mixed weather and constrained sight lines.", tags: ["forest", "woodland"], blueprint: baseBlueprint({ climate: { type: "TEMPERATE", temperatureCelsius: { minimum: 2, maximum: 26 }, humidityPercent: { minimum: 45, maximum: 92 }, annualRainfallMillimeters: 1250, windMetersPerSecond: { minimum: 0, maximum: 16, prevailingDirectionDegrees: 260 }, visibilityMeters: 8000, seasons: [] } }) },
  { id: "open-desert", name: "Open Desert", category: "natural-environment", biome: "DESERT", description: "A broad arid blueprint with dunes, dust and extreme temperature range.", tags: ["desert", "arid"], blueprint: baseBlueprint({ terrain: { ...baseBlueprint().terrain, type: "DUNES", roughness: 0.42, surfaceTypes: [{ type: "sand", weight: 0.92 }, { type: "rock", weight: 0.08 }] }, climate: { type: "ARID", temperatureCelsius: { minimum: -2, maximum: 48 }, humidityPercent: { minimum: 4, maximum: 25 }, annualRainfallMillimeters: 80, windMetersPerSecond: { minimum: 1, maximum: 32, prevailingDirectionDegrees: 70 }, visibilityMeters: 24_000, seasons: [] }, weather: [{ identifier: "clear", type: "CLEAR", weight: 0.8, metadata: {} }, { identifier: "dust", type: "DUST", weight: 0.2, metadata: {} }] }) },
  { id: "urban-arena", name: "Urban Arena", category: "arena", biome: "URBAN", description: "A bounded urban presentation space ready for workspace structure Assets.", tags: ["urban", "arena"], blueprint: baseBlueprint({ terrain: { ...baseBlueprint().terrain, type: "FLAT", roughness: 0.08, traversability: "OPEN", surfaceTypes: [{ type: "concrete", weight: 1 }] }, climate: { ...baseBlueprint().climate, type: "URBAN_TEMPERATE" } }) },
  { id: "working-farm", name: "Working Farm", category: "managed-land", biome: "FARM", description: "Fields, service lanes and weather definitions for agriculture simulations.", tags: ["farm", "agriculture"], blueprint: baseBlueprint({ terrain: { ...baseBlueprint().terrain, type: "FLAT", roughness: 0.12, traversability: "OPEN", surfaceTypes: [{ type: "cultivated-soil", weight: 0.7 }, { type: "grass", weight: 0.3 }] }, compatibleEntityCategories: ["farm", "vehicle", "animal", "person"] }) },
] as const;

export function findWorldPreset(id: string): WorldPreset | undefined {
  return WORLD_PRESETS.find((preset) => preset.id === id);
}

export function blankWorldBlueprint(): WorldBlueprintV1 {
  return baseBlueprint();
}
