import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listEarthSubdivisions } from "@/server/services/earth-geography-service";

interface Context {
  params: Promise<{ countryId: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { countryId } = await context.params;
    const limit = request.nextUrl.searchParams.get("limit") ?? undefined;
    return dataResponse(await listEarthSubdivisions(userId, workspaceId, countryId, { limit }));
  } catch (error) {
    return errorResponse(error);
  }
}
