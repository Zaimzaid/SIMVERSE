import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listEarthBoundaryIssues } from "@/server/services/earth-geography-service";

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const params = request.nextUrl.searchParams;
    return dataResponse(await listEarthBoundaryIssues(userId, workspaceId, {
      boundaryQuality: params.get("boundaryQuality") ?? undefined,
      verificationStatus: params.get("verificationStatus") ?? undefined,
      limit: params.get("limit") ?? undefined,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
