/**
 * A small optional library of built-in attribute presets.
 *
 * These are NOT hardcoded columns and are NOT auto-applied. When a user chooses
 * a preset while building an entity, the app materializes a normal
 * AttributeDefinition in that workspace (marked isBuiltIn) — identical in every
 * respect to a custom attribute the user could have created by hand. The set of
 * traits an entity can have is always open-ended and stored as data.
 */

import type { AttributeDataType } from "./constants";

export interface AttributePreset {
  key: string;
  name: string;
  description: string;
  dataType: AttributeDataType;
  unit?: string;
  minimum?: number;
  maximum?: number;
  defaultValue?: string;
}

/** Common stat presets. All are 0–100 numbers — a familiar starting point, nothing more. */
export const ATTRIBUTE_PRESETS: readonly AttributePreset[] = [
  { key: "speed", name: "Speed", description: "How fast the entity is.", dataType: "NUMBER", minimum: 0, maximum: 100, defaultValue: "50" },
  { key: "strength", name: "Strength", description: "Raw physical power.", dataType: "NUMBER", minimum: 0, maximum: 100, defaultValue: "50" },
  { key: "defense", name: "Defense", description: "Resistance to damage or pressure.", dataType: "NUMBER", minimum: 0, maximum: 100, defaultValue: "50" },
  { key: "intelligence", name: "Intelligence", description: "Problem-solving and strategy.", dataType: "NUMBER", minimum: 0, maximum: 100, defaultValue: "50" },
  { key: "luck", name: "Luck", description: "Favorable chance.", dataType: "NUMBER", minimum: 0, maximum: 100, defaultValue: "50" },
] as const;

const PRESET_BY_KEY = new Map(ATTRIBUTE_PRESETS.map((p) => [p.key, p]));

export function getAttributePreset(key: string): AttributePreset | undefined {
  return PRESET_BY_KEY.get(key);
}
