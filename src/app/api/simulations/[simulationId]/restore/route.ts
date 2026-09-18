import type { NextRequest } from "next/server";

import { restoreSimulation } from "@/server/services/simulation-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/**
 * POST /api/simulations/:simulationId/restore — restore an archived simulation.
 * Requires simulation.archive. The restored status is re-derived from validation
 * (READY if the blueprint still passes, otherwise DRAFT).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const simulation = await restoreSimulation(userId, workspaceId, simulationId);
    return dataResponse({ simulation });
  } catch (error) {
    return errorResponse(error);
  }
}
