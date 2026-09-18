import { ValidationError } from "@/lib/errors";

/**
 * Shared (de)serialization for the flexible `metadata` JSON string columns used
 * across services. Kept tiny and dependency-free so any service can reuse it.
 */

const METADATA_MAX = 20_000;

/** Serialize a metadata object to a bounded JSON string (or null when empty). */
export function serializeMetadata(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const json = JSON.stringify(metadata);
  if (json.length > METADATA_MAX) {
    throw new ValidationError("Additional info is too large.", [
      { path: "metadata", message: "Additional info is too large." },
    ]);
  }
  return json;
}

/** Parse a stored JSON string back into a plain object (or null when absent/invalid). */
export function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
