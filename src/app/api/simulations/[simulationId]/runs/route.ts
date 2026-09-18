import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createSimulationRun, listSimulationRuns } from "@/server/services/simulation-run-service";

export async function GET(
  req: NextRequest, { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    return dataResponse(await listSimulationRuns(userId, workspaceId, simulationId, page));
  } catch (error) {
    return errorResponse(error);
  }
}

/** No browser-supplied state, result, event, or workspace ID is accepted. */
export async function POST(
  _req: NextRequest, { params }: { params: Promise<{ simulationId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { simulationId } = await params;
    return dataResponse({ run: await createSimulationRun(userId, workspaceId, simulationId) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
