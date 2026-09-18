import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listSimulationRunActions } from "@/server/services/simulation-run-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { runId } = await params;
    const after = Number(req.nextUrl.searchParams.get("after") ?? "0");
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
    return dataResponse(await listSimulationRunActions(userId, workspaceId, runId, after, limit));
  } catch (error) {
    return errorResponse(error);
  }
}
