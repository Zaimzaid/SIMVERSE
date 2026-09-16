import type { AttributeDefinition } from "@prisma/client";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  coerceAttributeValue,
  isEmptyValue,
  parseAttributeOptions,
} from "@/lib/entities/attribute-values";
import type { AttributeDataType } from "@/lib/entities/constants";
import { getAttributePreset } from "@/lib/entities/attribute-presets";
import { slugify } from "@/lib/utils";
import {
  createAttributeDefinitionSchema,
  parseOrThrow,
  updateAttributeDefinitionSchema,
} from "@/lib/validation";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { requireMembership } from "./workspace-service";

/** A workspace attribute definition shaped for the client (options parsed from JSON). */
export interface AttributeDefinitionView {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  dataType: AttributeDataType;
  unit: string | null;
  minimum: number | null;
  maximum: number | null;
  defaultValue: string | null;
  options: string[] | null;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toAttributeDefinitionView(def: AttributeDefinition): AttributeDefinitionView {
  return {
    id: def.id,
    workspaceId: def.workspaceId,
    name: def.name,
    key: def.key,
    description: def.description,
    dataType: def.dataType as AttributeDataType,
    unit: def.unit,
    minimum: def.minimum,
    maximum: def.maximum,
    defaultValue: def.defaultValue,
    options: parseAttributeOptions(def.options),
    isBuiltIn: def.isBuiltIn,
    createdAt: def.createdAt,
    updatedAt: def.updatedAt,
  };
}

/**
 * List a workspace's attribute definitions. Requires attribute.view.
 * Definitions are strictly workspace-scoped — one workspace never sees another's
 * custom attributes.
 */
export async function listAttributeDefinitions(
  userId: string,
  workspaceId: string,
): Promise<AttributeDefinitionView[]> {
  await requireMembership(userId, workspaceId, "attribute.view");
  const defs = await prisma.attributeDefinition.findMany({
    where: { workspaceId },
    orderBy: [{ name: "asc" }],
  });
  return defs.map(toAttributeDefinitionView);
}

/** Get one attribute definition that belongs to the active workspace. Requires attribute.view. */
export async function getAttributeDefinition(
  userId: string,
  workspaceId: string,
  attributeDefinitionId: string,
): Promise<AttributeDefinitionView> {
  await requireMembership(userId, workspaceId, "attribute.view");
  const def = await prisma.attributeDefinition.findFirst({
    where: { id: attributeDefinitionId, workspaceId },
  });
  if (!def) throw new NotFoundError("Attribute not found.");
  return toAttributeDefinitionView(def);
}

/**
 * Create a custom attribute definition in the workspace. Requires attribute.create.
 * The machine `key` is derived from the name and must be unique within the
 * workspace (so "Speed" and "speed" collapse to one definition per workspace).
 */
export async function createAttributeDefinition(
  userId: string,
  workspaceId: string,
  input: unknown,
): Promise<AttributeDefinitionView> {
  await requireMembership(userId, workspaceId, "attribute.create");
  const data = parseOrThrow(createAttributeDefinitionSchema, input);

  const key = slugify(data.name);
  if (!key) {
    throw new ValidationError("Enter a valid attribute name.", [
      { path: "name", message: "Enter a valid attribute name." },
    ]);
  }

  const existing = await prisma.attributeDefinition.findUnique({
    where: { workspaceId_key: { workspaceId, key } },
  });
  if (existing) throw new ConflictError("An attribute with a similar name already exists.");

  const options = data.dataType === "SELECT" ? JSON.stringify(data.options ?? []) : null;
  const defaultValue = serializeDefaultValue(data.dataType, data.minimum, data.maximum, options, data.defaultValue);

  const created = await prisma.attributeDefinition.create({
    data: {
      workspaceId,
      name: data.name,
      key,
      description: data.description ?? null,
      dataType: data.dataType,
      unit: data.unit ?? null,
      minimum: data.dataType === "NUMBER" ? (data.minimum ?? null) : null,
      maximum: data.dataType === "NUMBER" ? (data.maximum ?? null) : null,
      defaultValue,
      options,
      isBuiltIn: false,
    },
  });

  await recordAudit({
    action: "attribute.created",
    actorUserId: userId,
    workspaceId,
    entityType: "AttributeDefinition",
    entityId: created.id,
    metadata: { name: created.name, dataType: created.dataType },
  });

  return toAttributeDefinitionView(created);
}

/**
 * Materialize a built-in preset (Speed, Strength, …) as a real workspace
 * attribute definition. Idempotent: if a definition with the preset's key
 * already exists in the workspace it is returned unchanged. Requires attribute.create.
 */
export async function materializeAttributePreset(
  userId: string,
  workspaceId: string,
  presetKey: string,
): Promise<AttributeDefinitionView> {
  await requireMembership(userId, workspaceId, "attribute.create");
  const preset = getAttributePreset(presetKey);
  if (!preset) {
    throw new ValidationError("Unknown attribute preset.", [
      { path: "preset", message: "Unknown attribute preset." },
    ]);
  }

  const existing = await prisma.attributeDefinition.findUnique({
    where: { workspaceId_key: { workspaceId, key: preset.key } },
  });
  if (existing) return toAttributeDefinitionView(existing);

  const created = await prisma.attributeDefinition.create({
    data: {
      workspaceId,
      name: preset.name,
      key: preset.key,
      description: preset.description,
      dataType: preset.dataType,
      unit: preset.unit ?? null,
      minimum: preset.minimum ?? null,
      maximum: preset.maximum ?? null,
      defaultValue: preset.defaultValue ?? null,
      options: null,
      isBuiltIn: true,
    },
  });

  await recordAudit({
    action: "attribute.created",
    actorUserId: userId,
    workspaceId,
    entityType: "AttributeDefinition",
    entityId: created.id,
    metadata: { name: created.name, preset: preset.key },
  });

  return toAttributeDefinitionView(created);
}

/**
 * Update an attribute definition's editable fields. Requires attribute.edit.
 * dataType and key are immutable to protect already-stored values.
 */
export async function updateAttributeDefinition(
  userId: string,
  workspaceId: string,
  attributeDefinitionId: string,
  input: unknown,
): Promise<AttributeDefinitionView> {
  await requireMembership(userId, workspaceId, "attribute.edit");

  const existing = await prisma.attributeDefinition.findFirst({
    where: { id: attributeDefinitionId, workspaceId },
  });
  if (!existing) throw new NotFoundError("Attribute not found.");

  const data = parseOrThrow(updateAttributeDefinitionSchema, input);
  const raw = asRecord(input);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key);
  const dataType = existing.dataType as AttributeDataType;

  const patch: Record<string, unknown> = {};

  if (has("name") && data.name !== undefined) {
    const key = slugify(data.name);
    if (!key) {
      throw new ValidationError("Enter a valid attribute name.", [
        { path: "name", message: "Enter a valid attribute name." },
      ]);
    }
    if (key !== existing.key) {
      const clash = await prisma.attributeDefinition.findUnique({
        where: { workspaceId_key: { workspaceId, key } },
      });
      if (clash) throw new ConflictError("An attribute with a similar name already exists.");
      patch.key = key;
    }
    patch.name = data.name;
  }

  if (has("description")) patch.description = data.description ?? null;
  if (has("unit")) patch.unit = data.unit ?? null;

  if (dataType === "NUMBER") {
    if (has("minimum")) patch.minimum = data.minimum ?? null;
    if (has("maximum")) patch.maximum = data.maximum ?? null;
  }

  let options = existing.options;
  if (dataType === "SELECT" && has("options")) {
    options = JSON.stringify(data.options ?? []);
    patch.options = options;
  }

  if (has("defaultValue")) {
    patch.defaultValue = serializeDefaultValue(
      dataType,
      (patch.minimum as number | null | undefined) ?? existing.minimum,
      (patch.maximum as number | null | undefined) ?? existing.maximum,
      options,
      data.defaultValue,
    );
  }

  const updated = await prisma.attributeDefinition.update({
    where: { id: attributeDefinitionId },
    data: patch,
  });

  await recordAudit({
    action: "attribute.updated",
    actorUserId: userId,
    workspaceId,
    entityType: "AttributeDefinition",
    entityId: updated.id,
    metadata: { name: updated.name },
  });

  return toAttributeDefinitionView(updated);
}

/** Validate and serialize a default value against its type, or null when empty/invalid-empty. */
function serializeDefaultValue(
  dataType: AttributeDataType,
  minimum: number | null | undefined,
  maximum: number | null | undefined,
  options: string | null,
  raw: string | number | boolean | undefined,
): string | null {
  if (isEmptyValue(raw)) return null;
  const result = coerceAttributeValue(
    { dataType, minimum: minimum ?? null, maximum: maximum ?? null, options: parseAttributeOptions(options) },
    raw,
  );
  if (!result.ok) {
    throw new ValidationError("The default value is invalid.", [
      { path: "defaultValue", message: result.message },
    ]);
  }
  return result.value;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}
