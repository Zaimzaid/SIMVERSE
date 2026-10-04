import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { restoreAsset } from "@/server/services/asset-service";
interface Context { params: Promise<{ assetId: string }> }
export async function POST(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { assetId } = await context.params;
    return dataResponse({ asset: await restoreAsset(userId, workspaceId, assetId) });
  } catch (error) { return errorResponse(error); }
}
