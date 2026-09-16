import type { NextRequest } from "next/server";

import { archiveEntity } from "@/server/services/entity-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** POST /api/entities/:entityId/archive — soft-archive an entity (reversible). Requires entity.archive. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await params;
    const entity = await archiveEntity(userId, workspaceId, entityId);
    return dataResponse({ entity });
  } catch (error) {
    return errorResponse(error);
  }
}
