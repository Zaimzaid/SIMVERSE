import type { NextRequest } from "next/server";

import { duplicateSimulation } from "@/server/services/simulation-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/**
 * POST /api/simulations/:simulationId/duplicate — copy a simulation's config,
 * presentation and participant references into a new DRAFT with a NEW seed.
 * Requires simulation.duplicate. Entities are referenced, never cloned.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const body = await req.json().catch(() => ({}));
    const simulation = await duplicateSimulation(userId, workspaceId, simulationId, body);
    return dataResponse({ simulation }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
