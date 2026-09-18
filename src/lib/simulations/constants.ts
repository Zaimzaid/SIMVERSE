/**
 * Core enumerations for the Simulation Definition system (Phase 2).
 *
 * A Simulation is a saved CONFIGURATION, not an execution. Status therefore
 * describes the blueprint's readiness, never a run:
 *   DRAFT    — being configured; may be incomplete.
 *   READY    — passes validation. NOTE: "READY" does NOT mean runnable now.
 *              The execution engine arrives in Phase 3.
 *   ARCHIVED — soft-archived (reversible), hidden from the default library view.
 */

export const SIMULATION_STATUSES = ["DRAFT", "READY", "ARCHIVED"] as const;
export type SimulationStatus = (typeof SIMULATION_STATUSES)[number];

export function isSimulationStatus(value: string): value is SimulationStatus {
  return (SIMULATION_STATUSES as readonly string[]).includes(value);
}

/** UI presentation for each status. `badge` maps to the Badge component variants. */
export const SIMULATION_STATUS_META: Record<
  SimulationStatus,
  { label: string; description: string; badge: "neutral" | "success" | "warning" }
> = {
  DRAFT: {
    label: "Draft",
    description: "Still being configured. Save progress any time.",
    badge: "warning",
  },
  READY: {
    label: "Ready",
    description: "Configuration is complete and valid. Execution arrives in Phase 3.",
    badge: "success",
  },
  ARCHIVED: {
    label: "Archived",
    description: "Archived (reversible). Restore to edit again.",
    badge: "neutral",
  },
};

/** The configuration schema version persisted alongside every Simulation. */
export const SIMULATION_CONFIG_VERSION = 1 as const;

/** Sort options for the Simulation Library. */
export const SIMULATION_SORTS = [
  "updated_desc",
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
] as const;
export type SimulationSort = (typeof SIMULATION_SORTS)[number];

export const SIMULATION_SORT_LABELS: Record<SimulationSort, string> = {
  updated_desc: "Recently updated",
  created_desc: "Newest",
  created_asc: "Oldest",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
};

export const DEFAULT_SIMULATION_SORT: SimulationSort = "updated_desc";

/** Status filter options exposed in the Library (adds "ALL" to the stored statuses). */
export const SIMULATION_STATUS_FILTERS = ["DRAFT", "READY", "ARCHIVED", "ALL"] as const;
export type SimulationStatusFilter = (typeof SIMULATION_STATUS_FILTERS)[number];

/** Pagination: bounded so a large collection never loads unbounded rows. */
export const SIMULATION_PAGE_SIZE = 24;
export const SIMULATION_MAX_PAGE_SIZE = 100;
