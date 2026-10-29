import type { User, Workspace, WorkspaceMember } from "@prisma/client";
import type { Permission, WorkspaceRole } from "@/lib/permissions";

/** A user object safe to send to the client — never includes passwordHash. */
export type SafeUser = Omit<User, "passwordHash" | "twoFactorSecret" | "twoFactorPendingSecret" | "twoFactorRecoveryHashes">;

/** A workspace member with its associated user (safe fields only). */
export interface MemberWithUser extends WorkspaceMember {
  user: SafeUser;
  role: WorkspaceRole;
}

/**
 * The resolved platform context for the current request: who the user is,
 * their active workspace, membership, role, and effective permissions.
 * Computed once per request in the server layer, never re-derived in the UI.
 */
export interface PlatformContext {
  user: SafeUser;
  workspace: Workspace;
  membership: WorkspaceMember;
  role: WorkspaceRole;
  permissions: Permission[];
  /** All workspaces the user belongs to (for future workspace switching). */
  workspaces: Workspace[];
}

export type { User, Workspace, WorkspaceMember };
