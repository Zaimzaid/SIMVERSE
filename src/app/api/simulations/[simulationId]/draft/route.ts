import type { NextRequest } from "next/server";

import { markSimulationDraft } from "@/server/services/simulation-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** POST /api/simulations/:simulationId/draft — return a simulation to DRAFT. Requires simulation.edit. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const simulation = await markSimulationDraft(userId, workspaceId, simulationId);
    return dataResponse({ simulation });
  } catch (error) {
    return errorResponse(error);
  }
}
