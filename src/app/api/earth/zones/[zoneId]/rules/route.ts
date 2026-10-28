import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getEarthZoneRules } from "@/server/services/earth-zone-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ zoneId: string }> },
) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { zoneId } = await context.params;
    return dataResponse(await getEarthZoneRules(userId, workspaceId, zoneId));
  } catch (error) {
    return errorResponse(error);
  }
}
