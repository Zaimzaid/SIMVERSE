import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listEarthParcels } from "@/server/services/earth-zone-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ zoneId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { zoneId } = await context.params;
    return dataResponse(await listEarthParcels(userId, workspaceId, zoneId, {
      bbox: request.nextUrl.searchParams.get("bbox") ?? undefined,
      zoom: request.nextUrl.searchParams.get("zoom") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
