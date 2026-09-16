import type { NextRequest } from "next/server";

import {
  createAttributeDefinition,
  listAttributeDefinitions,
  materializeAttributePreset,
} from "@/server/services/attribute-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** GET /api/attributes — list the active workspace's attribute definitions. */
export async function GET() {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const attributes = await listAttributeDefinitions(userId, workspaceId);
    return dataResponse({ attributes });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/attributes — create a custom attribute definition, OR materialize a
 * built-in preset (Speed, Strength, …) when the body carries `{ preset: "<key>" }`.
 * Materializing a preset is idempotent within the workspace.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const body = await req.json().catch(() => ({}));

    const presetKey =
      body && typeof body === "object" && typeof body.preset === "string" ? body.preset : null;

    const attribute = presetKey
      ? await materializeAttributePreset(userId, workspaceId, presetKey)
      : await createAttributeDefinition(userId, workspaceId, body);

    return dataResponse({ attribute }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
