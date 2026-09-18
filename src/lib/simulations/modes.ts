/**
 * Extensible catalog of simulation modes.
 *
 * IMPORTANT: `mode` on a Simulation is a free-form string key in the database —
 * exactly like Entity.category. This catalog supplies presentation (label, icon,
 * blurb), the minimum participant count, an availability flag for the picker, and
 * a pointer to the FUTURE module that will execute the mode. It contains NO
 * mechanics: there is no battle/race/tournament logic here, and none in Phase 2.
 *
 * Adding a mode later means adding an entry here (and, in Phase 3+, the module it
 * references) — never a new database table or column. Nothing is battle-hardcoded.
 */

import type { LucideIcon } from "lucide-react";
import { Dices, Flame, Gauge, Swords, Trophy } from "lucide-react";

/** Whether a mode can be selected in the builder yet. Future modes ship as "coming_soon". */
export type ModeAvailability = "available" | "coming_soon";

export interface SimulationMode {
  /** normalized slug key stored in Simulation.mode */
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Minimum participants a simulation of this mode must reference to be READY. */
  minEntities: number;
  availability: ModeAvailability;
  /**
   * Reference to the Phase 3+ execution module that WILL run this mode. This is a
   * documentation pointer only — the module does not exist in Phase 2 and nothing
   * dereferences it. It marks the config→runtime boundary.
   */
  futureModuleRef: string;
  isBuiltIn: boolean;
}

/**
 * Built-in modes. The order here is the order shown in the builder's mode step.
 * All four are selectable in Phase 2 because a Simulation is only a configuration;
 * the `availability` field exists so future modes can appear disabled ("coming
 * soon") without any schema change.
 */
export const SIMULATION_MODES: readonly SimulationMode[] = [
  {
    key: "battle",
    label: "Battle",
    description: "Entities compete directly until a winner remains.",
    icon: Swords,
    minEntities: 2,
    availability: "available",
    futureModuleRef: "modules/battle",
    isBuiltIn: true,
  },
  {
    key: "race",
    label: "Race",
    description: "Entities progress toward a goal; fastest wins.",
    icon: Gauge,
    minEntities: 2,
    availability: "available",
    futureModuleRef: "modules/race",
    isBuiltIn: true,
  },
  {
    key: "tournament",
    label: "Tournament",
    description: "Bracketed rounds narrow many entrants to one champion.",
    icon: Trophy,
    minEntities: 4,
    availability: "available",
    futureModuleRef: "modules/tournament",
    isBuiltIn: true,
  },
  {
    key: "survival",
    label: "Survival",
    description: "Entities endure a scenario; last standing prevails.",
    icon: Flame,
    minEntities: 2,
    availability: "available",
    futureModuleRef: "modules/survival",
    isBuiltIn: true,
  },
] as const;

/** The mode preselected when a new simulation is started. */
export const DEFAULT_SIMULATION_MODE = "battle";

/** Icon used for custom / unrecognized modes. */
export const FALLBACK_MODE_ICON: LucideIcon = Dices;

/** Fallback minimum participants for a mode not in the catalog. */
export const FALLBACK_MODE_MIN_ENTITIES = 2;

const MODE_BY_KEY = new Map(SIMULATION_MODES.map((m) => [m.key, m]));

/** Modes offered in the builder's picker. Pass includeUnavailable to show "coming soon" cards. */
export function selectableModes(includeUnavailable = true): SimulationMode[] {
  return SIMULATION_MODES.filter((m) => includeUnavailable || m.availability === "available");
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resolve any stored mode key to a display record. Built-in keys return their
 * catalog entry; anything else is presented as a title-cased custom mode so the UI
 * never shows a raw slug and never breaks on an unknown mode.
 */
export function resolveMode(key: string): SimulationMode {
  const known = MODE_BY_KEY.get(key);
  if (known) return known;
  const label = titleCaseSlug(key) || "Custom";
  return {
    key,
    label,
    description: "Custom simulation mode.",
    icon: FALLBACK_MODE_ICON,
    minEntities: FALLBACK_MODE_MIN_ENTITIES,
    availability: "available",
    futureModuleRef: `modules/${key}`,
    isBuiltIn: false,
  };
}

/** True if the key is one of the built-in modes. */
export function isBuiltInMode(key: string): boolean {
  return MODE_BY_KEY.has(key);
}

/** True if the mode is selectable in the builder (built-in and marked available). */
export function isSelectableMode(key: string): boolean {
  const mode = MODE_BY_KEY.get(key);
  return mode?.availability === "available";
}

/** Minimum participants required for a mode (falls back for unknown modes). */
export function minEntitiesForMode(key: string): number {
  return MODE_BY_KEY.get(key)?.minEntities ?? FALLBACK_MODE_MIN_ENTITIES;
}
