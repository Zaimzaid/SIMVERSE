import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { markAnythingWarsEventReady } from "@/server/services/anything-wars-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    return dataResponse({ simulation: await markAnythingWarsEventReady(userId, workspaceId, simulationId) });
  } catch (error) {
    return errorResponse(error);
  }
}
