import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getEarthParcel } from "@/server/services/earth-zone-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ zoneId: string; parcelId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { zoneId, parcelId } = await context.params;
    return dataResponse({ parcel: await getEarthParcel(userId, workspaceId, zoneId, parcelId, {
      row: request.nextUrl.searchParams.get("row") ?? undefined,
      column: request.nextUrl.searchParams.get("column") ?? undefined,
    }) });
  } catch (error) {
    return errorResponse(error);
  }
}
