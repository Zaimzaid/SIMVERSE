import { z } from "zod";

import { slugify } from "@/lib/utils";
import { ATTRIBUTE_DATA_TYPES } from "@/lib/entities/constants";
import { ENTITY_STATUSES } from "@/lib/entities/constants";
import { SEED_REGEX } from "@/lib/simulations/seed";

/**
 * Shared validation schemas. The server layer treats these as authoritative;
 * clients may reuse them for UX but server validation always runs.
 */

const displayName = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(60, "Display name must be at most 60 characters.");

const email = z
  .email("Enter a valid email address.")
  .trim()
  .toLowerCase()
  .max(254, "Email address is too long.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password must be at most 200 characters.")
  .regex(/[A-Za-z]/, "Password must contain at least one letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

const optionalUrl = z
  .union([z.url("Enter a valid URL."), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

export const registerSchema = z
  .object({
    displayName,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export const updateProfileSchema = z.object({
  displayName,
  avatarUrl: optionalUrl,
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(60, "Workspace name must be at most 60 characters."),
  logoUrl: optionalUrl,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// ============================================================================
// ENTITY SYSTEM (Phase 1)
// ============================================================================

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HTTP_URL = /^https?:\/\/.+/i;
// A modestly-sized inline image is allowed (no paid cloud storage in Phase 1);
// larger media should be referenced by URL. See docs note in entity-service.
const DATA_IMAGE_URL = /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);base64,[A-Za-z0-9+/=\s]+$/i;
const IMAGE_URL_MAX = 1_400_000; // ~1MB base64 ceiling for inline images

/** Required 6-digit hex color, normalized to uppercase (#22D3EE). */
const hexColor = z
  .string()
  .trim()
  .regex(HEX_COLOR, "Enter a color as a 6-digit hex value, e.g. #22D3EE.")
  .transform((value) => value.toUpperCase());

/** Optional hex color: empty string becomes undefined. */
const optionalHexColor = z
  .union([hexColor, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

/** Optional image reference: an http(s) URL or a small inline data:image URL. */
const optionalImageUrl = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(IMAGE_URL_MAX, "Image is too large; reference it by URL instead.")
      .refine((v) => HTTP_URL.test(v) || DATA_IMAGE_URL.test(v), "Enter a valid image URL."),
  ])
  .optional()
  .transform((value) => (value ? value : undefined));

const entityName = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(80, "Name must be at most 80 characters.");

const optionalShortName = z
  .union([z.string().trim().max(40, "Short name must be at most 40 characters."), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalDescription = z
  .union([z.string().trim().max(2000, "Description must be at most 2000 characters."), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

/** A category key. Accepts a built-in key or free custom text; always normalized to a slug. */
const categoryKey = z
  .string()
  .trim()
  .min(1, "Choose a category.")
  .max(60, "Category is too long.")
  .transform((value) => slugify(value))
  .refine((value) => value.length > 0, "Choose a valid category.");

/** A raw tag label as typed; normalized to a slug in the service. */
const tagLabel = z.string().trim().min(1).max(40, "Tags must be at most 40 characters.");

/** A single attribute assignment coming from the client (validated by type in the service). */
const entityAttributeInputSchema = z.object({
  attributeDefinitionId: z.string().min(1, "Missing attribute."),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const createEntitySchema = z.object({
  name: entityName,
  shortName: optionalShortName,
  description: optionalDescription,
  category: categoryKey,
  imageUrl: optionalImageUrl,
  primaryColor: optionalHexColor,
  secondaryColor: optionalHexColor,
  status: z.enum(ENTITY_STATUSES).optional(),
  attributes: z.array(entityAttributeInputSchema).max(100, "Too many attributes.").optional(),
  tags: z.array(tagLabel).max(30, "Too many tags.").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Update accepts any subset of the create fields. */
export const updateEntitySchema = createEntitySchema.partial();

/** Optional new name when duplicating; defaults to "<name> Copy" in the service. */
export const duplicateEntitySchema = z.object({
  name: entityName.optional(),
});

const attributeName = z
  .string()
  .trim()
  .min(1, "Enter an attribute name.")
  .max(60, "Attribute name must be at most 60 characters.");

const optionalUnit = z
  .union([z.string().trim().max(24, "Unit must be at most 24 characters."), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalAttributeDescription = z
  .union([z.string().trim().max(300, "Description must be at most 300 characters."), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

const finiteNumber = z.number().refine((n) => Number.isFinite(n), "Must be a finite number.");

const attributeDefinitionBase = z.object({
  name: attributeName,
  description: optionalAttributeDescription,
  dataType: z.enum(ATTRIBUTE_DATA_TYPES),
  unit: optionalUnit,
  minimum: finiteNumber.optional(),
  maximum: finiteNumber.optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string().trim().min(1).max(60)).max(50, "Too many options.").optional(),
});

/** Cross-field rules shared by create of an attribute definition. */
export const createAttributeDefinitionSchema = attributeDefinitionBase
  .refine((data) => data.minimum == null || data.maximum == null || data.minimum <= data.maximum, {
    message: "Minimum must be less than or equal to maximum.",
    path: ["maximum"],
  })
  .refine((data) => data.dataType !== "SELECT" || (data.options?.length ?? 0) >= 1, {
    message: "Add at least one choice for a Choice attribute.",
    path: ["options"],
  });

/** Update of an attribute definition — dataType and key are immutable to protect stored values. */
export const updateAttributeDefinitionSchema = attributeDefinitionBase
  .omit({ dataType: true })
  .partial()
  .extend({
    minimum: finiteNumber.nullable().optional(),
    maximum: finiteNumber.nullable().optional(),
  });

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type DuplicateEntityInput = z.infer<typeof duplicateEntitySchema>;
export type EntityAttributeInput = z.infer<typeof entityAttributeInputSchema>;
export type CreateAttributeDefinitionInput = z.infer<typeof createAttributeDefinitionSchema>;
export type UpdateAttributeDefinitionInput = z.infer<typeof updateAttributeDefinitionSchema>;

// ============================================================================
// PROJECT SYSTEM (Phase 2)
// ============================================================================

const projectName = z
  .string()
  .trim()
  .min(1, "Enter a project name.")
  .max(80, "Name must be at most 80 characters.");

export const createProjectSchema = z.object({
  name: projectName,
  description: optionalDescription,
  imageUrl: optionalImageUrl,
  coverUrl: optionalImageUrl,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Update accepts any subset of the create fields. */
export const updateProjectSchema = createProjectSchema.partial();

/** Add one or more existing entities to a project (entity ids validated in the service). */
export const addProjectEntitiesSchema = z.object({
  entityIds: z
    .array(z.string().trim().min(1, "Missing entity."))
    .min(1, "Choose at least one entity.")
    .max(200, "Too many entities at once."),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectEntitiesInput = z.infer<typeof addProjectEntitiesSchema>;

// ============================================================================
// SIMULATION DEFINITION SYSTEM (Phase 2) — configuration only, never execution.
// ============================================================================

const simulationName = z
  .string()
  .trim()
  .min(1, "Enter a simulation name.")
  .max(80, "Name must be at most 80 characters.");

/** A mode key. Accepts a built-in or custom slug; always normalized. The service checks the catalog. */
const modeKey = z
  .string()
  .trim()
  .min(1, "Choose a mode.")
  .max(60, "Mode is too long.")
  .transform((value) => slugify(value))
  .refine((value) => value.length > 0, "Choose a valid mode.");

/** Optional seed: empty becomes undefined (the service generates one). Must match SV-XXXXXXXX. */
const optionalSeed = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(SEED_REGEX, "Seed must look like SV-XXXXXXXX (8 letters or digits)."),
  ])
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalRole = z
  .union([z.string().trim().max(40, "Role must be at most 40 characters."), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

/** A single participant selection. Ordering/role/overrides are configuration only (no mechanics). */
const simulationParticipantSchema = z.object({
  entityId: z.string().trim().min(1, "Missing entity."),
  position: z.number().int().min(0).max(10_000).optional(),
  role: optionalRole,
  overrides: z.record(z.string(), z.unknown()).optional(),
});

export const createSimulationSchema = z.object({
  projectId: z.string().trim().min(1, "Choose a project."),
  name: simulationName,
  description: optionalDescription,
  mode: modeKey,
  seed: optionalSeed,
  participants: z.array(simulationParticipantSchema).max(500, "Too many participants.").optional(),
  // Raw config/presentation objects are validated by the simulation config module
  // (server-side) — never trusted or persisted as-is from here.
  configuration: z.record(z.string(), z.unknown()).optional(),
  presentation: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Update accepts any subset of the create fields. Status transitions use dedicated actions. */
export const updateSimulationSchema = createSimulationSchema.partial();

/** Optional new name when duplicating; defaults to "<name> Copy" in the service. */
export const duplicateSimulationSchema = z.object({
  name: simulationName.optional(),
});

export type SimulationParticipantInput = z.infer<typeof simulationParticipantSchema>;
export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;
export type UpdateSimulationInput = z.infer<typeof updateSimulationSchema>;
export type DuplicateSimulationInput = z.infer<typeof duplicateSimulationSchema>;
