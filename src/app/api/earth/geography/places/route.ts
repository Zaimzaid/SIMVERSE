import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listEarthPlaces } from "@/server/services/earth-geography-service";

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const params = request.nextUrl.searchParams;
    return dataResponse(await listEarthPlaces(userId, workspaceId, {
      parentId: params.get("parentId") ?? undefined,
      kind: params.get("kind") ?? undefined,
      q: params.get("q") ?? undefined,
      limit: params.get("limit") ?? undefined,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
