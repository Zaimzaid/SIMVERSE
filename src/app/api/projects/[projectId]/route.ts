import type { NextRequest } from "next/server";

import {
  deleteProject,
  getProject,
  updateProject,
} from "@/server/services/project-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** GET /api/projects/:projectId — fetch one project that belongs to the active workspace. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { projectId } = await params;
    const project = await getProject(userId, workspaceId, projectId);
    return dataResponse({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/projects/:projectId — update a project in the active workspace. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const project = await updateProject(userId, workspaceId, projectId, body);
    return dataResponse({ project });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/projects/:projectId — permanently delete a project. Requires
 * project.delete AND that the project belongs to the active workspace. Removing
 * a project deletes its entity LINKS and its simulations by cascade, but never
 * the shared Entities themselves.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { projectId } = await params;
    const result = await deleteProject(userId, workspaceId, projectId);
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
