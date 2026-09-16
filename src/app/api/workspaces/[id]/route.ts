import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { updateWorkspace } from "@/server/services/workspace-service";
import { dataResponse, errorResponse } from "@/server/api/response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const current = await getSessionUser();
    if (!current) throw new AuthenticationError("You must be signed in.");

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    // updateWorkspace enforces membership + workspace.edit; a non-member gets a
    // NotFoundError, so changing the id in the URL can't reveal other tenants.
    const workspace = await updateWorkspace(current.id, id, body);

    return dataResponse({ workspace });
  } catch (error) {
    return errorResponse(error);
  }
}
