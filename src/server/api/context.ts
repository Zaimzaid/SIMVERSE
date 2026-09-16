import { AuthenticationError } from "@/lib/errors";
import { getPlatformContext } from "@/server/context";

export interface ApiContext {
  userId: string;
  workspaceId: string;
}

/**
 * Resolve the authenticated user and their active workspace for an API route.
 *
 * Throws AuthenticationError (→ 401) when there is no signed-in user with a
 * workspace. Unlike `requirePlatformContext` (used by pages) this never
 * redirects — route handlers must return JSON. This is a convenience only: the
 * services still re-verify membership and permission on every call, so it is
 * never the security boundary on its own.
 */
export async function requireApiContext(): Promise<ApiContext> {
  const context = await getPlatformContext();
  if (!context) throw new AuthenticationError("You must be signed in.");
  return { userId: context.user.id, workspaceId: context.workspace.id };
}
