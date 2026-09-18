import type { NextRequest } from "next/server";

import { archiveSimulation } from "@/server/services/simulation-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** POST /api/simulations/:simulationId/archive — soft-archive a simulation (reversible). Requires simulation.archive. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const simulation = await archiveSimulation(userId, workspaceId, simulationId);
    return dataResponse({ simulation });
  } catch (error) {
    return errorResponse(error);
  }
}
