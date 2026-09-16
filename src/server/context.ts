import { cache } from "react";
import { redirect } from "next/navigation";
import {
  isWorkspaceRole,
  permissionsForRole,
  type WorkspaceRole,
} from "@/lib/permissions";
import type { PlatformContext, SafeUser } from "@/lib/types";
import { getActiveWorkspaceIdCookie, getSessionUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

/** The current authenticated user, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  return getSessionUser();
});

/** Require an authenticated user; redirect to /login if absent. */
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolve the full platform context for the current request: user, active
 * workspace, membership, role and effective permissions. This is the single
 * place this logic lives — pages and components consume it, never rebuild it.
 */
export const getPlatformContext = cache(
  async (): Promise<PlatformContext | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });
    if (memberships.length === 0) return null;

    const activeId = await getActiveWorkspaceIdCookie();
    const active =
      (activeId
        ? memberships.find((m) => m.workspaceId === activeId)
        : undefined) ?? memberships[0];
    if (!active) return null;

    const role: WorkspaceRole = isWorkspaceRole(active.role) ? active.role : "VIEWER";

    return {
      user,
      workspace: active.workspace,
      membership: active,
      role,
      permissions: permissionsForRole(role),
      workspaces: memberships.map((m) => m.workspace),
    };
  },
);

/** Require a resolved platform context; redirect to /login if unauthenticated. */
export async function requirePlatformContext(): Promise<PlatformContext> {
  const context = await getPlatformContext();
  if (!context) redirect("/login");
  return context;
}
