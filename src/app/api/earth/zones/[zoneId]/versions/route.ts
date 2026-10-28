import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  createEarthDevelopmentZoneVersion,
  listEarthDevelopmentZoneVersions,
} from "@/server/services/earth-zone-service";

type Context = { params: Promise<{ zoneId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { zoneId } = await context.params;
    return dataResponse(await listEarthDevelopmentZoneVersions(userId, workspaceId, zoneId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { zoneId } = await context.params;
    return dataResponse(await createEarthDevelopmentZoneVersion(
      userId,
      workspaceId,
      zoneId,
      await request.json().catch(() => ({})),
    ), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
