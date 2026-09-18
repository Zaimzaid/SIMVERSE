import type { NextRequest } from "next/server";

import { markSimulationReady } from "@/server/services/simulation-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/**
 * POST /api/simulations/:simulationId/ready — mark a simulation READY. Requires
 * simulation.edit. Runs READY validation and returns structured field issues on
 * failure. READY means the CONFIGURATION is complete and valid — it does NOT mean
 * the simulation can run now (the execution engine arrives in Phase 3).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const simulation = await markSimulationReady(userId, workspaceId, simulationId);
    return dataResponse({ simulation });
  } catch (error) {
    return errorResponse(error);
  }
}
