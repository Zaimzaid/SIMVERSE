import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createAnythingWarsEvent } from "@/server/services/anything-wars-service";

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const input = await request.json().catch(() => ({}));
    return dataResponse({ simulation: await createAnythingWarsEvent(userId, workspaceId, input) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
