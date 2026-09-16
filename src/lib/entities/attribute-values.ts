/**
 * Type-aware coercion and parsing for entity attribute values.
 *
 * The database stores every attribute value as a single canonical String
 * (EntityAttributeValue.value). These helpers convert between that stored form
 * and typed values, and enforce the rules declared on an AttributeDefinition —
 * most importantly numeric min/max bounds (e.g. Speed 0–100 rejects 900).
 *
 * Pure and dependency-free so it can be reused by the service layer, the API,
 * and unit tests without touching the database.
 */

import type { AttributeDataType } from "./constants";

/** The subset of an AttributeDefinition needed to validate a value. */
export interface AttributeSpec {
  dataType: AttributeDataType;
  minimum?: number | null;
  maximum?: number | null;
  /** allowed choices for SELECT (already parsed from JSON) */
  options?: string[] | null;
}

export type RawAttributeValue = string | number | boolean | null | undefined;

export type CoerceResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

/** True when a raw value carries no content and should clear the attribute. */
export function isEmptyValue(raw: RawAttributeValue): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") return raw.trim() === "";
  return false;
}

const TEXT_MAX = 1000;

/**
 * Validate and normalize a raw value against its attribute spec, returning the
 * canonical string to persist, or a human-readable message on failure. Callers
 * should treat empty values (see {@link isEmptyValue}) as "clear" before calling.
 */
export function coerceAttributeValue(spec: AttributeSpec, raw: RawAttributeValue): CoerceResult {
  switch (spec.dataType) {
    case "NUMBER": {
      const n =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw.trim())
            : NaN;
      if (!Number.isFinite(n)) return { ok: false, message: "Must be a number." };
      if (spec.minimum != null && n < spec.minimum) {
        return { ok: false, message: `Must be at least ${spec.minimum}.` };
      }
      if (spec.maximum != null && n > spec.maximum) {
        return { ok: false, message: `Must be at most ${spec.maximum}.` };
      }
      // Normalize to a canonical decimal string (drops trailing zeros, unifies -0).
      return { ok: true, value: String(n) };
    }

    case "BOOLEAN": {
      if (typeof raw === "boolean") return { ok: true, value: raw ? "true" : "false" };
      const s = String(raw).trim().toLowerCase();
      if (s === "true" || s === "1" || s === "yes") return { ok: true, value: "true" };
      if (s === "false" || s === "0" || s === "no") return { ok: true, value: "false" };
      return { ok: false, message: "Must be true or false." };
    }

    case "SELECT": {
      const s = typeof raw === "string" ? raw.trim() : String(raw);
      const options = spec.options ?? [];
      if (!options.includes(s)) return { ok: false, message: "Must be one of the allowed choices." };
      return { ok: true, value: s };
    }

    case "TEXT":
    default: {
      const s = (typeof raw === "string" ? raw : String(raw)).trim();
      if (s.length > TEXT_MAX) return { ok: false, message: `Must be ${TEXT_MAX} characters or fewer.` };
      return { ok: true, value: s };
    }
  }
}

/** Convert a stored canonical string back into a typed value for reads. */
export function parseStoredAttributeValue(
  dataType: AttributeDataType,
  stored: string,
): string | number | boolean {
  switch (dataType) {
    case "NUMBER": {
      const n = Number(stored);
      return Number.isFinite(n) ? n : 0;
    }
    case "BOOLEAN":
      return stored === "true";
    case "SELECT":
    case "TEXT":
    default:
      return stored;
  }
}

/** Safely parse a definition's serialized SELECT options JSON into a string[]. */
export function parseAttributeOptions(options: string | null | undefined): string[] | null {
  if (!options) return null;
  try {
    const parsed = JSON.parse(options);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
    return null;
  } catch {
    return null;
  }
}
