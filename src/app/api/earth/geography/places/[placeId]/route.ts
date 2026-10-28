import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getEarthPlace } from "@/server/services/earth-geography-service";

interface Context {
  params: Promise<{ placeId: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { placeId } = await context.params;
    return dataResponse({ place: await getEarthPlace(userId, workspaceId, placeId) });
  } catch (error) {
    return errorResponse(error);
  }
}
