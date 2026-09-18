/**
 * Core enumerations for the Project system (Phase 2).
 *
 * Like the Entity system, lifecycle/sort/filter values live in one app-layer
 * place and are stored as plain strings in SQLite (portable to Postgres enums).
 */

/** Lifecycle states. Projects are archived (soft, reversible) rather than hard-deleted from the main UI. */
export const PROJECT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

/** Sort options for the Project Library. */
export const PROJECT_SORTS = [
  "updated_desc",
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
] as const;
export type ProjectSort = (typeof PROJECT_SORTS)[number];

export const PROJECT_SORT_LABELS: Record<ProjectSort, string> = {
  updated_desc: "Recently updated",
  created_desc: "Newest",
  created_asc: "Oldest",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
};

export const DEFAULT_PROJECT_SORT: ProjectSort = "updated_desc";

/** Status filter options exposed in the Library (adds "ALL" to the stored statuses). */
export const PROJECT_STATUS_FILTERS = ["ACTIVE", "ARCHIVED", "ALL"] as const;
export type ProjectStatusFilter = (typeof PROJECT_STATUS_FILTERS)[number];

/** Pagination: bounded so a large collection never loads unbounded rows. */
export const PROJECT_PAGE_SIZE = 24;
export const PROJECT_MAX_PAGE_SIZE = 100;
