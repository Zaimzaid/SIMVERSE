import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { pauseSimulationRun } from "@/server/services/simulation-run-service";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { runId } = await params;
    return dataResponse({ run: await pauseSimulationRun(userId, workspaceId, runId) });
  } catch (error) {
    return errorResponse(error);
  }
}
