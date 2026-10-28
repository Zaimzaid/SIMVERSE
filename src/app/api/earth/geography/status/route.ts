import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getEarthGeographyCatalogStatus } from "@/server/services/earth-geography-service";

export async function GET() {
  try {
    const { userId, workspaceId } = await requireApiContext();
    return dataResponse(await getEarthGeographyCatalogStatus(userId, workspaceId));
  } catch (error) {
    return errorResponse(error);
  }
}
