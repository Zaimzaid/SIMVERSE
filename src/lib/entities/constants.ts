/**
 * Core enumerations for the generic Entity system.
 *
 * These values are stored as plain strings in SQLite (portable to Postgres
 * native enums later) and validated here in the app layer. Keeping them in one
 * place means the DB never hard-codes a closed set of kinds or states.
 */

/** Lifecycle states. Entities are archived (soft, reversible) rather than hard-deleted from the main UI. */
export const ENTITY_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export function isEntityStatus(value: string): value is EntityStatus {
  return (ENTITY_STATUSES as readonly string[]).includes(value);
}

/** Supported attribute value types. NUMBER is the primary (stat) type. */
export const ATTRIBUTE_DATA_TYPES = ["NUMBER", "TEXT", "BOOLEAN", "SELECT"] as const;
export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number];

export function isAttributeDataType(value: string): value is AttributeDataType {
  return (ATTRIBUTE_DATA_TYPES as readonly string[]).includes(value);
}

export const ATTRIBUTE_DATA_TYPE_META: Record<
  AttributeDataType,
  { label: string; description: string }
> = {
  NUMBER: { label: "Number", description: "A numeric stat, optionally bounded by a min and max." },
  TEXT: { label: "Text", description: "A short free-text value." },
  BOOLEAN: { label: "Yes / No", description: "A true or false flag." },
  SELECT: { label: "Choice", description: "One value chosen from a fixed list." },
};

/** Sort options for the Entity Library. */
export const ENTITY_SORTS = [
  "updated_desc",
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
] as const;
export type EntitySort = (typeof ENTITY_SORTS)[number];

export const ENTITY_SORT_LABELS: Record<EntitySort, string> = {
  updated_desc: "Recently updated",
  created_desc: "Newest",
  created_asc: "Oldest",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
};

export const DEFAULT_ENTITY_SORT: EntitySort = "updated_desc";

/** Status filter options exposed in the Library (adds "ALL" to the stored statuses). */
export const ENTITY_STATUS_FILTERS = ["ACTIVE", "ARCHIVED", "ALL"] as const;
export type EntityStatusFilter = (typeof ENTITY_STATUS_FILTERS)[number];

/** Pagination: bounded so a large collection never loads unbounded rows. */
export const ENTITY_PAGE_SIZE = 24;
export const ENTITY_MAX_PAGE_SIZE = 100;
