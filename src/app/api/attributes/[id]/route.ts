import type { NextRequest } from "next/server";

import {
  getAttributeDefinition,
  updateAttributeDefinition,
} from "@/server/services/attribute-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** GET /api/attributes/:id — fetch one attribute definition in the active workspace. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { id } = await params;
    const attribute = await getAttributeDefinition(userId, workspaceId, id);
    return dataResponse({ attribute });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/attributes/:id — update an attribute definition (dataType and key are immutable). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const attribute = await updateAttributeDefinition(userId, workspaceId, id, body);
    return dataResponse({ attribute });
  } catch (error) {
    return errorResponse(error);
  }
}
