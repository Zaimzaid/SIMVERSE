import type { NextRequest } from "next/server";

import { archiveProject } from "@/server/services/project-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/**
 * POST /api/projects/:projectId/archive — soft-archive a project (reversible).
 * Requires project.archive. Does NOT archive or delete the project's entities or
 * simulations; only the project's own status changes.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { projectId } = await params;
    const project = await archiveProject(userId, workspaceId, projectId);
    return dataResponse({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
