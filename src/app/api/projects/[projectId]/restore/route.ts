import type { NextRequest } from "next/server";

import { restoreProject } from "@/server/services/project-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** POST /api/projects/:projectId/restore — restore an archived project to ACTIVE. Requires project.archive. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { projectId } = await params;
    const project = await restoreProject(userId, workspaceId, projectId);
    return dataResponse({ project });
  } catch (error) {
    return errorResponse(error);
  }
}
