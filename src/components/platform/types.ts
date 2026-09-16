import type { Permission, WorkspaceRole } from "@/lib/permissions";

/** Minimal, serializable user shape passed from the server layout to the shell. */
export interface ShellUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface ShellWorkspace {
  id: string;
  name: string;
  slug: string;
}

/** Everything the client shell needs — plain data, safe to cross the RSC boundary. */
export interface ShellData {
  user: ShellUser;
  workspace: ShellWorkspace;
  workspaces: ShellWorkspace[];
  role: WorkspaceRole;
  permissions: Permission[];
}
