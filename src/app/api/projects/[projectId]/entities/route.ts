import type { NextRequest } from "next/server";

import { addProjectEntities } from "@/server/services/project-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/**
 * POST /api/projects/:projectId/entities — add existing entities to a project by
 * reference. Requires project.entity.manage. Entities are referenced, never
 * cloned; every entity id must belong to the same workspace as the project.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const project = await addProjectEntities(userId, workspaceId, projectId, body);
    return dataResponse({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
