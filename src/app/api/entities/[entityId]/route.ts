import type { NextRequest } from "next/server";

import { deleteEntity, getEntity, updateEntity } from "@/server/services/entity-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** GET /api/entities/:entityId — fetch one entity that belongs to the active workspace. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await params;
    const entity = await getEntity(userId, workspaceId, entityId);
    return dataResponse({ entity });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/entities/:entityId — update an entity in the active workspace. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await params;
    const body = await req.json().catch(() => ({}));
    const entity = await updateEntity(userId, workspaceId, entityId, body);
    return dataResponse({ entity });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/entities/:entityId — permanently delete an entity. Requires
 * entity.delete AND that the entity belongs to the active workspace, so another
 * workspace can never delete it (the service returns NotFound otherwise).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await params;
    const result = await deleteEntity(userId, workspaceId, entityId);
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
