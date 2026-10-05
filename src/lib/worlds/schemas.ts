import { z } from "zod";
import { safeAssetReferenceSchema } from "@/lib/assets/schemas";
import { slugify } from "@/lib/utils";
import {
  WATER_TYPES, WEATHER_TYPES, WORLD_ASSET_ROLES, WORLD_BIOMES,
  WORLD_BLUEPRINT_VERSION, WORLD_ENTITY_RELATIONSHIPS, WORLD_STATUSES,
  WORLD_VISIBILITIES, WORLD_ZONE_TYPES,
} from "./constants";

const optionalText = (max: number) => z.union([z.literal(""), z.string().trim().max(max)]).optional()
  .transform((value) => value || undefined);
const optionalReference = z.union([z.literal(""), safeAssetReferenceSchema]).optional()
  .transform((value) => value || undefined);
const identifier = z.string().trim().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/,
  "Use letters, numbers, underscores, or hyphens and start with a letter.");
const tag = z.string().trim().min(1).max(60);
const boundedJson = z.record(z.string().trim().min(1).max(80), z.json()).default({})
  .refine((value) => JSON.stringify(value).length <= 30_000, "Configuration is too large.");

export const worldVectorSchema = z.object({
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
  z: z.number().finite().min(-1_000_000).max(1_000_000),
}).strict();

const positiveVectorSchema = z.object({
  x: z.number().finite().positive().max(2_000_000),
  y: z.number().finite().positive().max(2_000_000),
  z: z.number().finite().positive().max(2_000_000),
}).strict();

const rotationSchema = z.object({
  pitch: z.number().finite().min(-360).max(360).default(0),
  yaw: z.number().finite().min(-360).max(360).default(0),
  roll: z.number().finite().min(-360).max(360).default(0),
}).strict();

const placementSchema = z.object({
  position: worldVectorSchema,
  rotationDegrees: rotationSchema.default({ pitch: 0, yaw: 0, roll: 0 }),
  scale: worldVectorSchema.refine((value) => value.x > 0 && value.y > 0 && value.z > 0,
    "Scale components must be positive.").default({ x: 1, y: 1, z: 1 }),
}).strict();

export const worldAssetAssociationSchema = z.object({
  identifier,
  assetId: z.string().trim().min(1).max(200),
  assetVersion: z.number().int().positive(),
  role: z.enum(WORLD_ASSET_ROLES),
  placement: placementSchema.optional(),
  placementGroup: optionalText(80),
  category: optionalText(80),
  configuration: boundedJson,
}).strict();

export const worldEntityAssociationSchema = z.object({
  entityId: z.string().trim().min(1).max(200),
  relationship: z.enum(WORLD_ENTITY_RELATIONSHIPS),
  configuration: boundedJson,
}).strict();

const zoneBoundsSchema = z.object({
  shape: z.enum(["BOX", "SPHERE", "CYLINDER", "POLYGON", "CUSTOM"]),
  center: worldVectorSchema,
  size: positiveVectorSchema.optional(),
  radius: z.number().finite().positive().max(1_000_000).optional(),
  points: z.array(worldVectorSchema).min(3).max(200).optional(),
  metadata: boundedJson,
}).strict().superRefine((value, context) => {
  if (value.shape === "BOX" && !value.size) context.addIssue({ code: "custom", path: ["size"], message: "Box zones require a size." });
  if (["SPHERE", "CYLINDER"].includes(value.shape) && !value.radius) context.addIssue({ code: "custom", path: ["radius"], message: "This zone shape requires a radius." });
  if (value.shape === "POLYGON" && !value.points) context.addIssue({ code: "custom", path: ["points"], message: "Polygon zones require at least three points." });
});

const zoneSchema = z.object({
  identifier, name: z.string().trim().min(1).max(120), type: z.enum(WORLD_ZONE_TYPES),
  priority: z.number().int().min(-1000).max(1000).default(0),
  bounds: zoneBoundsSchema,
  allowedParticipants: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  tags: z.array(tag).max(30).default([]), configuration: boundedJson,
}).strict();

const spawnSchema = z.object({
  identifier, position: worldVectorSchema,
  rotationDegrees: rotationSchema.default({ pitch: 0, yaw: 0, roll: 0 }),
  allowedArchetypes: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  allowedCategories: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  tags: z.array(tag).max(30).default([]),
}).strict();

const spawnSetSchema = z.object({
  identifier, name: z.string().trim().min(1).max(120),
  spawns: z.array(spawnSchema).min(1).max(500),
}).strict().superRefine((value, context) => uniqueIssues(value.spawns, "identifier", context, ["spawns"]));

const cameraDefinitionSchema = z.object({
  mode: z.enum(["ORBIT", "FOLLOW", "OVERVIEW", "STATIC", "SPECTATOR", "CUSTOM"]),
  position: worldVectorSchema.optional(), lookAt: worldVectorSchema.optional(),
  zoneIdentifier: optionalText(80), configuration: boundedJson,
}).strict();

const audioChannels = z.object({
  ambient: z.array(identifier).max(50).default([]), biome: z.array(identifier).max(50).default([]),
  weather: z.array(identifier).max(50).default([]), water: z.array(identifier).max(50).default([]),
  wildlife: z.array(identifier).max(50).default([]), structures: z.array(identifier).max(50).default([]),
  music: z.array(identifier).max(50).default([]),
}).strict();

export const worldBlueprintSchema = z.object({
  version: z.literal(WORLD_BLUEPRINT_VERSION).default(WORLD_BLUEPRINT_VERSION),
  terrain: z.object({
    type: z.enum(["FLAT", "ROLLING", "HILLY", "MOUNTAINOUS", "VALLEY", "PLATEAU", "DUNES", "COASTAL", "CUSTOM"]),
    elevation: z.object({ minimumMeters: z.number().finite().min(-12_000).max(100_000), maximumMeters: z.number().finite().min(-12_000).max(100_000), profile: optionalText(500) }).strict(),
    roughness: z.number().finite().min(0).max(1),
    slope: z.object({ minimumDegrees: z.number().finite().min(0).max(90), maximumDegrees: z.number().finite().min(0).max(90), profile: optionalText(500) }).strict(),
    traversability: z.enum(["OPEN", "MIXED", "DIFFICULT", "RESTRICTED", "CUSTOM"]),
    surfaceTypes: z.array(z.object({ type: z.string().trim().min(1).max(80), weight: z.number().finite().min(0).max(1) }).strict()).max(30),
    boundary: z.object({ shape: z.enum(["RECTANGLE", "CIRCLE", "POLYGON", "CUSTOM"]), metadata: boundedJson }).strict(),
    dimensions: z.object({ width: z.number().finite().positive().max(2_000_000), length: z.number().finite().positive().max(2_000_000), height: z.number().finite().positive().max(200_000), unit: z.enum(["METER", "KILOMETER"]) }).strict(),
    coordinates: z.object({ unit: z.enum(["METER", "KILOMETER"]), upAxis: z.enum(["Y", "Z"]), handedness: z.enum(["LEFT", "RIGHT"]), origin: worldVectorSchema }).strict(),
  }).strict(),
  climate: z.object({
    type: z.string().trim().min(1).max(80),
    temperatureCelsius: z.object({ minimum: z.number().finite().min(-150).max(100), maximum: z.number().finite().min(-150).max(100) }).strict(),
    humidityPercent: z.object({ minimum: z.number().finite().min(0).max(100), maximum: z.number().finite().min(0).max(100) }).strict(),
    annualRainfallMillimeters: z.number().finite().nonnegative().max(100_000),
    windMetersPerSecond: z.object({ minimum: z.number().finite().nonnegative().max(500), maximum: z.number().finite().nonnegative().max(500), prevailingDirectionDegrees: z.number().finite().min(0).max(360) }).strict(),
    visibilityMeters: z.number().finite().positive().max(1_000_000),
    seasons: z.array(z.object({ identifier, label: z.string().trim().min(1).max(80), metadata: boundedJson }).strict()).max(20),
  }).strict(),
  weather: z.array(z.object({ identifier, type: z.enum(WEATHER_TYPES), weight: z.number().finite().positive().max(10_000), metadata: boundedJson }).strict()).min(1).max(30),
  time: z.object({
    mode: z.enum(["STATIC", "DYNAMIC"]), initialTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM time."),
    timeScale: z.number().finite().positive().max(100_000), sunrise: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    sunset: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), season: optionalText(80),
  }).strict(),
  ecology: z.object({
    vegetationLayers: z.array(z.object({ identifier, label: z.string().trim().min(1).max(120), coverage: z.number().finite().min(0).max(1), assetIdentifiers: z.array(identifier).max(100), placeholderDescription: optionalText(500) }).strict()).max(50),
    habitatObjects: z.array(z.object({ identifier, label: z.string().trim().min(1).max(120), assetIdentifiers: z.array(identifier).max(100), placeholderDescription: optionalText(500) }).strict()).max(50),
    notes: optionalText(2000),
  }).strict(),
  water: z.array(z.object({ identifier, type: z.enum(WATER_TYPES), zoneIdentifier: optionalText(80), metadata: boundedJson }).strict()).max(50),
  zones: z.array(zoneSchema).max(250),
  spawnSets: z.array(spawnSetSchema).max(100),
  compatibleEntityCategories: z.array(z.string().trim().min(1).max(80)).max(100),
  camera: z.object({
    defaultMode: z.enum(["ORBIT", "FOLLOW", "OVERVIEW", "STATIC", "SPECTATOR", "CUSTOM"]),
    intro: cameraDefinitionSchema.optional(), overview: cameraDefinitionSchema.optional(),
    result: cameraDefinitionSchema.optional(), spectator: cameraDefinitionSchema.optional(),
    zonePriority: z.array(identifier).max(100),
  }).strict(),
  audio: audioChannels,
  presentation: z.object({
    gravityProfileReference: optionalText(160), lightingProfileReference: optionalText(160),
    atmosphereProfile: optionalText(160), fogProfile: optionalText(160), skyProfile: optionalText(160),
    navigationPreference: z.enum(["GROUND", "AIR", "WATER", "MIXED", "NONE", "CUSTOM"]),
    destructionPolicy: z.enum(["NONE", "PRESENTATION_ONLY", "RUNTIME_DEFINED"]),
    boundaryPolicy: z.enum(["BLOCK", "WRAP", "RETURN", "PRESENTATION_ONLY", "RUNTIME_DEFINED"]),
    metadata: boundedJson,
  }).strict(),
}).strict().superRefine(validateBlueprint);

const worldDataShape = {
  name: z.string().trim().min(1, "Name is required.").max(160),
  description: optionalText(4000),
  category: z.string().trim().min(1).max(80).transform((value) => slugify(value)).refine(Boolean, "Choose a valid category."),
  status: z.enum(WORLD_STATUSES).refine((value) => value !== "ARCHIVED", "Use the archive action to archive a World.").default("DRAFT"),
  tags: z.array(tag).max(30).default([]),
  biome: z.enum(WORLD_BIOMES), customBiome: optionalText(120),
  thumbnailReference: optionalReference,
  visibility: z.enum(WORLD_VISIBILITIES).default("WORKSPACE"),
  blueprint: worldBlueprintSchema,
  assetAssociations: z.array(worldAssetAssociationSchema).max(500).default([]),
  entityAssociations: z.array(worldEntityAssociationSchema).max(200).default([]),
  changeNote: optionalText(500),
};

export const createWorldSchema = z.object(worldDataShape).strict().superRefine(validateWorldInput);
export const updateWorldSchema = z.object(worldDataShape).partial().strict();
export type CreateWorldInput = z.infer<typeof createWorldSchema>;
export type UpdateWorldInput = z.infer<typeof updateWorldSchema>;
export type WorldBlueprintV1 = z.infer<typeof worldBlueprintSchema>;
export type WorldAssetAssociation = z.infer<typeof worldAssetAssociationSchema>;
export type WorldEntityAssociation = z.infer<typeof worldEntityAssociationSchema>;

export const worldRunSnapshotSchema = z.object({
  snapshotVersion: z.literal(1), worldId: z.string().min(1), version: z.number().int().positive(),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/), name: z.string().min(1),
  category: z.string().min(1), biome: z.enum(WORLD_BIOMES), thumbnailReference: z.string().nullable(),
  blueprint: worldBlueprintSchema, assetAssociations: z.array(worldAssetAssociationSchema),
  entityAssociations: z.array(worldEntityAssociationSchema),
}).strict();

function uniqueIssues<T extends Record<string, unknown>>(items: T[], key: keyof T, context: z.RefinementCtx, path: (string | number)[]) {
  const seen = new Set<unknown>();
  items.forEach((item, index) => {
    if (seen.has(item[key])) context.addIssue({ code: "custom", path: [...path, index, String(key)], message: "Identifiers must be unique." });
    seen.add(item[key]);
  });
}

function coordinateBounds(blueprint: WorldBlueprintV1) {
  const dimensions = blueprint.terrain.dimensions;
  const dimensionScale = dimensions.unit === "KILOMETER" ? 1000 : 1;
  const coordinateScale = blueprint.terrain.coordinates.unit === "KILOMETER" ? 1000 : 1;
  const origin = Object.fromEntries(
    Object.entries(blueprint.terrain.coordinates.origin).map(([axis, value]) => [axis, value * coordinateScale]),
  ) as z.infer<typeof worldVectorSchema>;
  const half = blueprint.terrain.coordinates.upAxis === "Y"
    ? { x: dimensions.width * dimensionScale / 2, y: dimensions.height * dimensionScale / 2, z: dimensions.length * dimensionScale / 2 }
    : { x: dimensions.width * dimensionScale / 2, y: dimensions.length * dimensionScale / 2, z: dimensions.height * dimensionScale / 2 };
  const meters = (point: z.infer<typeof worldVectorSchema>) => ({
    x: point.x * coordinateScale,
    y: point.y * coordinateScale,
    z: point.z * coordinateScale,
  });
  const inside = (point: z.infer<typeof worldVectorSchema>, extent = { x: 0, y: 0, z: 0 }) => {
    const converted = meters(point);
    return Math.abs(converted.x - origin.x) + extent.x <= half.x
      && Math.abs(converted.y - origin.y) + extent.y <= half.y
      && Math.abs(converted.z - origin.z) + extent.z <= half.z;
  };
  return { coordinateScale, inside };
}

function validateBlueprint(value: z.infer<z.ZodObject<Record<string, z.ZodTypeAny>>>, context: z.RefinementCtx) {
  const blueprint = value as WorldBlueprintV1;
  if (blueprint.terrain.elevation.minimumMeters > blueprint.terrain.elevation.maximumMeters) context.addIssue({ code: "custom", path: ["terrain", "elevation", "maximumMeters"], message: "Maximum elevation must be at least the minimum." });
  if (blueprint.terrain.slope.minimumDegrees > blueprint.terrain.slope.maximumDegrees) context.addIssue({ code: "custom", path: ["terrain", "slope", "maximumDegrees"], message: "Maximum slope must be at least the minimum." });
  if (blueprint.climate.temperatureCelsius.minimum > blueprint.climate.temperatureCelsius.maximum) context.addIssue({ code: "custom", path: ["climate", "temperatureCelsius", "maximum"], message: "Maximum temperature must be at least the minimum." });
  if (blueprint.climate.humidityPercent.minimum > blueprint.climate.humidityPercent.maximum) context.addIssue({ code: "custom", path: ["climate", "humidityPercent", "maximum"], message: "Maximum humidity must be at least the minimum." });
  if (blueprint.climate.windMetersPerSecond.minimum > blueprint.climate.windMetersPerSecond.maximum) context.addIssue({ code: "custom", path: ["climate", "windMetersPerSecond", "maximum"], message: "Maximum wind speed must be at least the minimum." });
  uniqueIssues(blueprint.weather, "identifier", context, ["weather"]); uniqueIssues(blueprint.zones, "identifier", context, ["zones"]); uniqueIssues(blueprint.spawnSets, "identifier", context, ["spawnSets"]); uniqueIssues(blueprint.water, "identifier", context, ["water"]);
  const spawnIdentifiers = new Set<string>();
  blueprint.spawnSets.forEach((set, setIndex) => set.spawns.forEach((spawn, spawnIndex) => {
    if (spawnIdentifiers.has(spawn.identifier)) context.addIssue({ code: "custom", path: ["spawnSets", setIndex, "spawns", spawnIndex, "identifier"], message: "Spawn identifiers must be unique across the World." });
    spawnIdentifiers.add(spawn.identifier);
  }));
  const zones = new Set(blueprint.zones.map((zone) => zone.identifier));
  const assetRefs = new Set<string>();
  for (const layer of blueprint.ecology.vegetationLayers) for (const asset of layer.assetIdentifiers) assetRefs.add(asset);
  for (const habitat of blueprint.ecology.habitatObjects) for (const asset of habitat.assetIdentifiers) assetRefs.add(asset);
  for (const channel of Object.values(blueprint.audio)) for (const asset of channel) assetRefs.add(asset);
  for (const water of blueprint.water) if (water.zoneIdentifier && !zones.has(water.zoneIdentifier)) context.addIssue({ code: "custom", path: ["water"], message: `Water definition references unknown zone “${water.zoneIdentifier}”.` });
  for (const camera of [blueprint.camera.intro, blueprint.camera.overview, blueprint.camera.result, blueprint.camera.spectator]) if (camera?.zoneIdentifier && !zones.has(camera.zoneIdentifier)) context.addIssue({ code: "custom", path: ["camera"], message: `Camera references unknown zone “${camera.zoneIdentifier}”.` });
  for (const zone of blueprint.camera.zonePriority) if (!zones.has(zone)) context.addIssue({ code: "custom", path: ["camera", "zonePriority"], message: `Camera priority references unknown zone “${zone}”.` });
  const { coordinateScale, inside } = coordinateBounds(blueprint);
  blueprint.zones.forEach((zone, index) => {
    const bounds = zone.bounds;
    let centerInside = inside(bounds.center);
    if (bounds.shape === "BOX" && bounds.size) centerInside = inside(bounds.center, {
      x: bounds.size.x * coordinateScale / 2,
      y: bounds.size.y * coordinateScale / 2,
      z: bounds.size.z * coordinateScale / 2,
    });
    if (bounds.shape === "SPHERE" && bounds.radius) {
      const radius = bounds.radius * coordinateScale;
      centerInside = inside(bounds.center, { x: radius, y: radius, z: radius });
    }
    if (bounds.shape === "CYLINDER" && bounds.radius) {
      const radius = bounds.radius * coordinateScale;
      centerInside = blueprint.terrain.coordinates.upAxis === "Y"
        ? inside(bounds.center, { x: radius, y: 0, z: radius })
        : inside(bounds.center, { x: radius, y: radius, z: 0 });
    }
    if (!centerInside || bounds.points?.some((point) => !inside(point))) context.addIssue({ code: "custom", path: ["zones", index, "bounds"], message: "Zone bounds must remain inside the World dimensions." });
  });
  blueprint.spawnSets.forEach((set, setIndex) => set.spawns.forEach((spawn, spawnIndex) => { if (!inside(spawn.position)) context.addIssue({ code: "custom", path: ["spawnSets", setIndex, "spawns", spawnIndex, "position"], message: "Spawn coordinates must remain inside the World dimensions." }); }));
  const cameras = [blueprint.camera.intro, blueprint.camera.overview, blueprint.camera.result, blueprint.camera.spectator];
  cameras.forEach((camera, index) => {
    if ((camera?.position && !inside(camera.position)) || (camera?.lookAt && !inside(camera.lookAt))) context.addIssue({ code: "custom", path: ["camera", index], message: "Camera coordinates must remain inside the World dimensions." });
  });
  Object.assign(context, { __assetRefs: assetRefs });
}

function validateWorldInput(value: z.infer<z.ZodObject<typeof worldDataShape>>, context: z.RefinementCtx) {
  if (value.biome === "CUSTOM" && !value.customBiome) context.addIssue({ code: "custom", path: ["customBiome"], message: "Name the custom biome." });
  uniqueIssues(value.assetAssociations, "identifier", context, ["assetAssociations"]);
  const pairs = value.entityAssociations.map((item) => ({ key: `${item.entityId}:${item.relationship}` }));
  uniqueIssues(pairs, "key", context, ["entityAssociations"]);
  const assets = new Set(value.assetAssociations.map((item) => item.identifier));
  const { inside } = coordinateBounds(value.blueprint);
  value.assetAssociations.forEach((association, index) => {
    if (association.placement && !inside(association.placement.position)) context.addIssue({ code: "custom", path: ["assetAssociations", index, "placement", "position"], message: "Asset placement coordinates must remain inside the World dimensions." });
  });
  const referenced = [
    ...value.blueprint.ecology.vegetationLayers.flatMap((item) => item.assetIdentifiers),
    ...value.blueprint.ecology.habitatObjects.flatMap((item) => item.assetIdentifiers),
    ...Object.values(value.blueprint.audio).flatMap((items) => items),
  ];
  referenced.forEach((identifierValue) => { if (!assets.has(identifierValue)) context.addIssue({ code: "custom", path: ["assetAssociations"], message: `Blueprint references unknown Asset placement “${identifierValue}”.` }); });
}
