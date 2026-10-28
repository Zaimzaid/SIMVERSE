import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listEarthCountries } from "@/server/services/earth-geography-service";

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const limit = request.nextUrl.searchParams.get("limit") ?? undefined;
    return dataResponse(await listEarthCountries(userId, workspaceId, { limit }));
  } catch (error) {
    return errorResponse(error);
  }
}
