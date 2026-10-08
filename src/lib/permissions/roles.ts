/**
 * Centralized permission architecture.
 *
 * Role checks must NOT be scattered through the app. Instead, code asks
 * `can(role, permission)` (or uses permission lists from `permissionsForRole`).
 * Authorization is always enforced server-side (see src/server/services) —
 * hiding a UI control is never sufficient.
 */

export const WORKSPACE_ROLES = [
  "OWNER",
  "ADMIN",
  "CREATOR",
  "OPERATOR",
  "EDITOR",
  "ANALYST",
  "VIEWER",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  "workspace.view",
  "workspace.edit",
  "workspace.delete",
  "workspace.members.view",
  "workspace.members.manage",
  "project.view",
  "project.create",
  "project.edit",
  "project.archive",
  "project.delete",
  "project.entity.manage",
  "simulation.view",
  "simulation.create",
  "simulation.run",
  "simulation.edit",
  "simulation.duplicate",
  "simulation.archive",
  "simulation.delete",
  "entity.manage",
  "entity.view",
  "entity.create",
  "entity.edit",
  "entity.archive",
  "entity.delete",
  "entity.duplicate",
  "attribute.view",
  "attribute.create",
  "attribute.edit",
  "world.view",
  "world.manage",
  "experience.view",
  "experience.manage",
  "tournament.view",
  "tournament.manage",
  "tournament.run",
  "asset.view",
  "asset.manage",
  "content.edit",
  "analytics.view",
  "team.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permission matrix. "*" means all permissions (owner).
 * This is the single source of truth for what each role may do.
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[] | "*"> = {
  OWNER: "*",
  ADMIN: PERMISSIONS.filter((p) => p !== "workspace.delete"),
  CREATOR: [
    "workspace.view",
    "workspace.members.view",
    "project.view",
    "project.create",
    "project.edit",
    "project.archive",
    "project.entity.manage",
    "simulation.view",
    "simulation.create",
    "simulation.run",
    "simulation.edit",
    "simulation.duplicate",
    "simulation.archive",
    "entity.manage",
    "entity.view",
    "entity.create",
    "entity.edit",
    "entity.archive",
    "entity.duplicate",
    "attribute.view",
    "attribute.create",
    "attribute.edit",
    "world.view",
    "world.manage",
    "experience.view",
    "experience.manage",
    "tournament.view",
    "tournament.manage",
    "tournament.run",
    "asset.view",
    "asset.manage",
    "content.edit",
    "analytics.view",
  ],
  OPERATOR: [
    "workspace.view",
    "workspace.members.view",
    "project.view",
    "simulation.view",
    "simulation.run",
    "entity.view",
    "attribute.view",
    "world.view",
    "experience.view",
    "tournament.view",
    "tournament.run",
    "asset.view",
    "analytics.view",
  ],
  EDITOR: [
    "workspace.view",
    "workspace.members.view",
    "project.view",
    "simulation.view",
    "entity.manage",
    "entity.view",
    "entity.create",
    "entity.edit",
    "entity.archive",
    "entity.duplicate",
    "attribute.view",
    "attribute.create",
    "attribute.edit",
    "world.view",
    "world.manage",
    "experience.view",
    "experience.manage",
    "tournament.view",
    "tournament.manage",
    "asset.view",
    "asset.manage",
    "content.edit",
  ],
  ANALYST: [
    "workspace.view",
    "workspace.members.view",
    "project.view",
    "simulation.view",
    "entity.view",
    "attribute.view",
    "world.view",
    "experience.view",
    "tournament.view",
    "asset.view",
    "analytics.view",
  ],
  VIEWER: [
    "workspace.view",
    "workspace.members.view",
    "project.view",
    "simulation.view",
    "entity.view",
    "attribute.view",
    "world.view",
    "experience.view",
    "tournament.view",
    "asset.view",
  ],
};

/** Returns true if the given role is granted the given permission. */
export function can(role: WorkspaceRole, permission: Permission): boolean {
  const grants = ROLE_PERMISSIONS[role];
  return grants === "*" || grants.includes(permission);
}

/** Returns the full list of permissions granted to a role. */
export function permissionsForRole(role: WorkspaceRole): Permission[] {
  const grants = ROLE_PERMISSIONS[role];
  return grants === "*" ? [...PERMISSIONS] : [...grants];
}

/** Type guard: is this string a valid workspace role? */
export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

/** Human-readable label + description for each role (UI + docs). */
export const ROLE_META: Record<WorkspaceRole, { label: string; description: string }> = {
  OWNER: { label: "Owner", description: "Full control of the workspace, including deletion and ownership." },
  ADMIN: { label: "Admin", description: "Manage members, settings, and all content." },
  CREATOR: { label: "Creator", description: "Create and run simulations, entities, worlds, and content." },
  OPERATOR: { label: "Operator", description: "Run simulations and review outcomes." },
  EDITOR: { label: "Editor", description: "Edit entities, worlds, assets, and content." },
  ANALYST: { label: "Analyst", description: "View analytics and simulation results." },
  VIEWER: { label: "Viewer", description: "Read-only access to the workspace." },
};
