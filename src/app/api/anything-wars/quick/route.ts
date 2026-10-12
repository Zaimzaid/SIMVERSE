import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createQuickAnythingWarsRun } from "@/server/services/anything-wars-service";

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const input = await request.json().catch(() => ({}));
    return dataResponse(await createQuickAnythingWarsRun(userId, workspaceId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
