import { z } from "zod";
import { ANIMATION_STATES } from "@/lib/visuals/profile";
import { ASSET_STATUSES, ASSET_TYPES, PRODUCTION_CHECKLIST_KEYS } from "./constants";

const unsafeCredentialKey = /^(?:access[_-]?token|api[_-]?key|auth|credential|password|secret|signature|sig|token)$/i;

export const safeAssetReferenceSchema = z.string().trim().min(1).max(2048).refine((value) => {
  if (/^\/(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\s]*$/.test(value)) {
    const relative = new URL(value, "https://simverse.local");
    return ![...relative.searchParams.keys()].some((key) => unsafeCredentialKey.test(key));
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return ![...url.searchParams.keys()].some((key) => unsafeCredentialKey.test(key));
  } catch {
    return false;
  }
}, "Use a safe same-origin path or HTTPS URL without embedded credentials.");

const optionalReference = z.union([z.literal(""), safeAssetReferenceSchema]).optional()
  .transform((value) => value || undefined);
const optionalText = (max: number) => z.union([z.literal(""), z.string().trim().max(max)]).optional()
  .transform((value) => value || undefined);
const jsonRecord = z.record(z.string().trim().min(1).max(80), z.json())
  .refine((value) => JSON.stringify(value).length <= 20_000, "Metadata is too large.");

export const assetProvenanceSchema = z.object({
  kind: z.enum(["ORIGINAL", "IMPORTED", "GENERATED", "LICENSED", "DERIVED"]),
  sourceName: optionalText(200),
  sourceUrl: optionalReference,
  notes: optionalText(2000),
}).strict().superRefine((value, context) => {
  if (value.kind !== "ORIGINAL" && !value.sourceName && !value.sourceUrl) {
    context.addIssue({ code: "custom", path: ["sourceName"], message: "Identify the non-original source." });
  }
});

export const assetLicenseSchema = z.object({
  type: z.enum(["PROPRIETARY", "CC0", "CC_BY", "CC_BY_SA", "PURCHASED", "CUSTOM", "UNKNOWN"]),
  name: optionalText(200),
  url: optionalReference,
  attribution: optionalText(1000),
  usageRestrictions: optionalText(2000),
  expiresAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).optional()
    .transform((value) => value || undefined),
}).strict().superRefine((value, context) => {
  if (["PURCHASED", "CUSTOM"].includes(value.type) && !value.name) {
    context.addIssue({ code: "custom", path: ["name"], message: "Name this license." });
  }
  if (["CC_BY", "CC_BY_SA"].includes(value.type) && !value.attribution) {
    context.addIssue({ code: "custom", path: ["attribution"], message: "Attribution is required for this license." });
  }
});

export const assetAuthorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  organization: optionalText(200),
  contact: optionalText(320),
}).strict();

const dimensionsSchema = z.object({
  x: z.number().finite().positive(), y: z.number().finite().positive(), z: z.number().finite().positive(),
  unit: z.enum(["MILLIMETER", "CENTIMETER", "METER", "INCH", "FOOT"]),
}).strict();

export const modelSpecificationSchema = z.object({
  format: z.string().trim().min(1).max(32),
  triangleCount: z.number().int().nonnegative().optional(),
  polygonCount: z.number().int().nonnegative().optional(),
  lods: z.array(z.object({
    level: z.number().int().nonnegative(),
    triangleCount: z.number().int().nonnegative().optional(),
    reference: optionalReference,
  }).strict()).max(12).default([]),
  dimensions: dimensionsSchema.optional(),
  scale: z.number().finite().positive().max(10_000).default(1),
  skeletonReference: optionalText(200),
  materialSlots: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  textureReferences: z.array(safeAssetReferenceSchema).max(100).default([]),
}).strict();

export const rigSpecificationSchema = z.object({
  archetype: z.string().trim().min(1).max(80),
  skeletonName: z.string().trim().min(1).max(160),
  skeletonVersion: z.string().trim().min(1).max(80),
  boneCount: z.number().int().positive().max(100_000),
  compatibility: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  metadata: jsonRecord.default({}),
}).strict();

export const animationSpecificationSchema = z.object({
  semanticState: z.enum(ANIMATION_STATES),
  clipName: z.string().trim().min(1).max(160),
  durationSeconds: z.number().finite().positive().max(86_400),
  looping: z.boolean(),
  skeletonCompatibility: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
}).strict();

export const productionChecklistItemSchema = z.object({
  key: z.enum(PRODUCTION_CHECKLIST_KEYS),
  completed: z.boolean(),
  notes: optionalText(500),
}).strict();

export const assetEntityAssociationSchema = z.object({
  entityId: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(80).default("PRIMARY"),
}).strict();

const assetDataShape = {
  name: z.string().trim().min(1, "Name is required.").max(160),
  description: optionalText(4000),
  type: z.enum(ASSET_TYPES),
  status: z.enum(ASSET_STATUSES).refine((value) => value !== "ARCHIVED", "Use the archive action to archive an asset.")
    .default("DRAFT"),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  provenance: assetProvenanceSchema,
  licenseInfo: assetLicenseSchema.optional(),
  authorInfo: assetAuthorSchema.optional(),
  externalReference: optionalReference,
  thumbnailReference: optionalReference,
  technicalMetadata: jsonRecord.default({}),
  modelSpecification: modelSpecificationSchema.optional(),
  rigSpecification: rigSpecificationSchema.optional(),
  animationSpecification: animationSpecificationSchema.optional(),
  productionChecklist: z.array(productionChecklistItemSchema).max(PRODUCTION_CHECKLIST_KEYS.length).default([]),
  entityAssociations: z.array(assetEntityAssociationSchema).max(100).default([]),
  derivedFromAssetIds: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  changeNote: optionalText(500),
};

export const createAssetSchema = z.object(assetDataShape).strict().superRefine(validateSpecificationFit);
export const updateAssetSchema = z.object(assetDataShape).partial().strict();
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

type CompleteAssetData = z.infer<z.ZodObject<typeof assetDataShape>>;

function validateSpecificationFit(value: CompleteAssetData, context: z.RefinementCtx) {
  const modelTypes = new Set(["MODEL_3D", "ENVIRONMENT", "PROP", "CHARACTER", "CREATURE", "VEHICLE"]);
  if (value.modelSpecification && !modelTypes.has(value.type)) {
    context.addIssue({ code: "custom", path: ["modelSpecification"], message: "Model specifications require a 3D-capable asset type." });
  }
  if (value.rigSpecification && !["RIG", "MODEL_3D", "CHARACTER", "CREATURE", "VEHICLE"].includes(value.type)) {
    context.addIssue({ code: "custom", path: ["rigSpecification"], message: "Rig specifications do not apply to this asset type." });
  }
  if (value.animationSpecification && value.type !== "ANIMATION") {
    context.addIssue({ code: "custom", path: ["animationSpecification"], message: "Animation specifications require an Animation asset." });
  }
  const keys = value.productionChecklist.map((item) => item.key);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["productionChecklist"], message: "Checklist steps must be unique." });
  }
  const associations = value.entityAssociations.map((item) => `${item.entityId}:${item.purpose.toUpperCase()}`);
  if (new Set(associations).size !== associations.length) {
    context.addIssue({ code: "custom", path: ["entityAssociations"], message: "Entity associations must be unique." });
  }
  if (value.provenance.kind === "DERIVED" && value.derivedFromAssetIds.length === 0) {
    context.addIssue({ code: "custom", path: ["derivedFromAssetIds"], message: "A derived Asset must identify at least one parent Asset." });
  }
}

export function parseCompleteAssetInput(input: unknown) {
  return createAssetSchema.parse(input);
}
