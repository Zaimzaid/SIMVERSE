import type { NextRequest } from "next/server";

import { removeProjectEntity } from "@/server/services/project-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/**
 * DELETE /api/projects/:projectId/entities/:entityId — remove an entity from a
 * project. Requires project.entity.manage. This deletes only the LINK row; the
 * Entity itself is never deleted or archived.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; entityId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { projectId, entityId } = await params;
    const project = await removeProjectEntity(userId, workspaceId, projectId, entityId);
    return dataResponse({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
