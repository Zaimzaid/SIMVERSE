import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser, setActiveWorkspaceCookie } from "@/server/auth/session";
import { requireMembership } from "@/server/services/workspace-service";
import { dataResponse, errorResponse } from "@/server/api/response";

/** Switch the active workspace (future multi-workspace support). */
export async function POST(req: NextRequest) {
  try {
    const current = await getSessionUser();
    if (!current) throw new AuthenticationError("You must be signed in.");

    const body = await req.json().catch(() => ({}));
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";

    // Throws NotFoundError for non-members — never sets a workspace the user
    // isn't part of, and never reveals whether it exists.
    await requireMembership(current.id, workspaceId);
    await setActiveWorkspaceCookie(workspaceId);

    return dataResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
