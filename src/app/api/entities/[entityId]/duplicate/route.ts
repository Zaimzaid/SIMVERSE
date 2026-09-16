import type { NextRequest } from "next/server";

import { duplicateEntity } from "@/server/services/entity-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/**
 * POST /api/entities/:entityId/duplicate — copy an entity (category, description,
 * colors, image, attributes, tags and metadata) into a new ACTIVE entity with a
 * fresh id. An optional `{ name }` overrides the default "<name> Copy".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { entityId } = await params;
    const body = await req.json().catch(() => ({}));
    const entity = await duplicateEntity(userId, workspaceId, entityId, body);
    return dataResponse({ entity }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
