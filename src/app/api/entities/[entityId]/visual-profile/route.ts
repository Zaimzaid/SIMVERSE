import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  deleteEntityVisualProfile,
  getEntityVisualProfile,
  upsertEntityVisualProfile,
} from "@/server/services/entity-service";

interface RouteContext { params: Promise<{ entityId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await context.params;
    return dataResponse({ visualProfile: await getEntityVisualProfile(userId, workspaceId, entityId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await context.params;
    const input: unknown = await request.json();
    return dataResponse({ visualProfile: await upsertEntityVisualProfile(userId, workspaceId, entityId, input) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await context.params;
    return dataResponse(await deleteEntityVisualProfile(userId, workspaceId, entityId));
  } catch (error) {
    return errorResponse(error);
  }
}
