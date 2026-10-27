import type { NextRequest } from "next/server";
import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  createEarthDevelopmentZone,
  listEarthDevelopmentZones,
} from "@/server/services/earth-zone-service";

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(await listEarthDevelopmentZones(userId, workspaceId, {
      placeId: request.nextUrl.searchParams.get("placeId") ?? undefined,
      includeDemonstration: request.nextUrl.searchParams.get("includeDemonstration") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(
      await createEarthDevelopmentZone(
        userId,
        workspaceId,
        await request.json().catch(() => ({})),
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
