import type { NextRequest } from "next/server";

import {
  deleteSimulation,
  getSimulation,
  updateSimulation,
} from "@/server/services/simulation-service";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";

/** GET /api/simulations/:simulationId — fetch one simulation that belongs to the active workspace. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const simulation = await getSimulation(userId, workspaceId, simulationId);
    return dataResponse({ simulation });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/simulations/:simulationId — update a simulation configuration. A
 * validity-affecting change to a READY blueprint returns it to DRAFT. Status
 * transitions themselves use the dedicated ready/draft actions.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const body = await req.json().catch(() => ({}));
    const simulation = await updateSimulation(userId, workspaceId, simulationId, body);
    return dataResponse({ simulation });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/simulations/:simulationId — permanently delete a simulation.
 * Requires simulation.delete AND that it belongs to the active workspace.
 * Participant LINK rows cascade away; referenced Entities are never deleted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const result = await deleteSimulation(userId, workspaceId, simulationId);
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
