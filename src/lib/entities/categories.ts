/**
 * Extensible catalog of entity categories.
 *
 * IMPORTANT: `category` on an Entity is a free-form string key in the database.
 * This catalog only supplies presentation (label, icon, blurb) for the common
 * built-in kinds and a UI picker. Any workspace can store a custom category key
 * that is not listed here — `resolveCategory` synthesizes a sensible display for
 * those. Nothing in the system is limited to this fixed list.
 */

import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Box,
  Briefcase,
  Building,
  Building2,
  Car,
  Cog,
  Flag,
  PawPrint,
  Shapes,
  Sprout,
  User,
  Users,
  Wand2,
} from "lucide-react";

export interface EntityCategory {
  /** normalized slug key stored in Entity.category */
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  isBuiltIn: boolean;
}

/**
 * Built-in categories. The order here is the order shown in the picker.
 * "custom" is a sentinel the UI uses to reveal a free-text field; a saved custom
 * entity stores the slug of whatever the user typed, never the literal "custom".
 */
export const ENTITY_CATEGORIES: readonly EntityCategory[] = [
  { key: "country", label: "Country", description: "Nations, states, or territories.", icon: Flag, isBuiltIn: true },
  { key: "robot", label: "Robot", description: "Robots, droids, and autonomous units.", icon: Bot, isBuiltIn: true },
  { key: "animal", label: "Animal", description: "Creatures, pets, and wildlife.", icon: PawPrint, isBuiltIn: true },
  { key: "vehicle", label: "Vehicle", description: "Cars, ships, aircraft, and craft.", icon: Car, isBuiltIn: true },
  { key: "city", label: "City", description: "Cities, towns, and settlements.", icon: Building2, isBuiltIn: true },
  { key: "business", label: "Business", description: "Companies, brands, and organizations.", icon: Briefcase, isBuiltIn: true },
  { key: "farm", label: "Farm", description: "Farms, ranches, and land holdings.", icon: Sprout, isBuiltIn: true },
  { key: "team", label: "Team", description: "Squads, crews, and groups.", icon: Users, isBuiltIn: true },
  { key: "person", label: "Person", description: "People and personas.", icon: User, isBuiltIn: true },
  { key: "fantasy", label: "Fantasy Character", description: "Heroes, monsters, and fantasy beings.", icon: Wand2, isBuiltIn: true },
  { key: "machine", label: "Machine", description: "Engines, devices, and machinery.", icon: Cog, isBuiltIn: true },
  { key: "building", label: "Building", description: "Structures and facilities.", icon: Building, isBuiltIn: true },
  { key: "object", label: "Object", description: "Items, resources, and things.", icon: Box, isBuiltIn: true },
  { key: "custom", label: "Custom", description: "Define your own kind of entity.", icon: Shapes, isBuiltIn: true },
] as const;

/** The sentinel key that tells the creation UI to collect a custom category name. */
export const CUSTOM_CATEGORY_KEY = "custom";

/** Icon used for custom / unrecognized categories. */
export const FALLBACK_CATEGORY_ICON: LucideIcon = Shapes;

const CATEGORY_BY_KEY = new Map(ENTITY_CATEGORIES.map((c) => [c.key, c]));

/** Categories shown in a picker (excludes the "custom" sentinel unless asked). */
export function selectableCategories(includeCustom = true): EntityCategory[] {
  return ENTITY_CATEGORIES.filter((c) => includeCustom || c.key !== CUSTOM_CATEGORY_KEY);
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resolve any stored category key to a display record. Built-in keys return their
 * catalog entry; anything else is presented as a title-cased custom category so
 * the library never shows a raw slug and never breaks on an unknown kind.
 */
export function resolveCategory(key: string): EntityCategory {
  const known = CATEGORY_BY_KEY.get(key);
  if (known) return known;
  const label = titleCaseSlug(key) || "Custom";
  return { key, label, description: "Custom category.", icon: FALLBACK_CATEGORY_ICON, isBuiltIn: false };
}

/** True if the key is one of the built-in categories (the "custom" sentinel included). */
export function isBuiltInCategory(key: string): boolean {
  return CATEGORY_BY_KEY.has(key);
}
