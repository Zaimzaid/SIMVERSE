export const ASSET_TYPES = [
  "CONCEPT_ART", "MODEL_3D", "TEXTURE", "MATERIAL", "RIG", "ANIMATION",
  "AUDIO", "VFX", "ENVIRONMENT", "PROP", "CHARACTER", "CREATURE",
  "VEHICLE", "OTHER",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  CONCEPT_ART: "Concept art", MODEL_3D: "3D model", TEXTURE: "Texture",
  MATERIAL: "Material", RIG: "Rig", ANIMATION: "Animation", AUDIO: "Audio",
  VFX: "VFX", ENVIRONMENT: "Environment", PROP: "Prop", CHARACTER: "Character",
  CREATURE: "Creature", VEHICLE: "Vehicle", OTHER: "Other",
};

export const ASSET_STATUSES = [
  "DRAFT", "CONCEPT_APPROVED", "IN_PRODUCTION", "REVIEW", "VALIDATED",
  "RUNTIME_READY", "ARCHIVED",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetStatusFilter = AssetStatus | "CURRENT" | "ALL";
export const ASSET_STATUS_FILTERS = [...ASSET_STATUSES, "CURRENT", "ALL"] as const;

export const ASSET_STATUS_LABELS: Record<AssetStatusFilter, string> = {
  DRAFT: "Draft", CONCEPT_APPROVED: "Concept approved", IN_PRODUCTION: "In production",
  REVIEW: "Review", VALIDATED: "Validated", RUNTIME_READY: "Runtime ready",
  ARCHIVED: "Archived", ALL: "All statuses",
  CURRENT: "Current assets",
};

export const ASSET_SORTS = ["updated_desc", "updated_asc", "name_asc", "name_desc"] as const;
export type AssetSort = (typeof ASSET_SORTS)[number];
export const ASSET_SORT_LABELS: Record<AssetSort, string> = {
  updated_desc: "Recently updated", updated_asc: "Oldest updated",
  name_asc: "Name A–Z", name_desc: "Name Z–A",
};

export const ASSET_PAGE_SIZE = 18;
export const ASSET_MAX_PAGE_SIZE = 100;

export const PRODUCTION_CHECKLIST_KEYS = [
  "concept", "modeling", "retopology", "uv", "materials", "groom_fur",
  "rig", "animations", "technical_validation", "runtime_validation",
] as const;

const STATUS_TRANSITIONS: Record<Exclude<AssetStatus, "ARCHIVED">, readonly AssetStatus[]> = {
  DRAFT: ["CONCEPT_APPROVED", "IN_PRODUCTION"],
  CONCEPT_APPROVED: ["DRAFT", "IN_PRODUCTION"],
  IN_PRODUCTION: ["CONCEPT_APPROVED", "REVIEW"],
  REVIEW: ["IN_PRODUCTION", "VALIDATED"],
  VALIDATED: ["REVIEW", "RUNTIME_READY"],
  RUNTIME_READY: ["VALIDATED"],
};

export function canTransitionAssetStatus(from: AssetStatus, to: AssetStatus): boolean {
  if (from === to) return true;
  if (from === "ARCHIVED" || to === "ARCHIVED") return false;
  return STATUS_TRANSITIONS[from].includes(to);
}

export function isAssetType(value: string): value is AssetType {
  return (ASSET_TYPES as readonly string[]).includes(value);
}

export function isAssetStatus(value: string): value is AssetStatus {
  return (ASSET_STATUSES as readonly string[]).includes(value);
}
