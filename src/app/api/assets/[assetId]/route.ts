import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { deleteAsset, getAsset, updateAsset } from "@/server/services/asset-service";

interface Context { params: Promise<{ assetId: string }> }
export async function GET(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { assetId } = await context.params;
    return dataResponse({ asset: await getAsset(userId, workspaceId, assetId) });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { assetId } = await context.params;
    return dataResponse({ asset: await updateAsset(userId, workspaceId, assetId, await request.json().catch(() => ({}))) });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const { userId, workspaceId } = await requireApiContext();
    const { assetId } = await context.params;
    return dataResponse(await deleteAsset(userId, workspaceId, assetId));
  } catch (error) { return errorResponse(error); }
}
