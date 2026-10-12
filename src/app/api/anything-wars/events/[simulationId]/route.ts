import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { updateAnythingWarsEvent } from "@/server/services/anything-wars-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const input = await request.json().catch(() => ({}));
    return dataResponse({ simulation: await updateAnythingWarsEvent(userId, workspaceId, simulationId, input) });
  } catch (error) {
    return errorResponse(error);
  }
}
