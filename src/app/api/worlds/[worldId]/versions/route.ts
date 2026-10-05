import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listWorldVersions } from "@/server/services/world-service";
interface Context { params: Promise<{ worldId: string }> }
export async function GET(_request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { worldId } = await context.params; return dataResponse({ versions: await listWorldVersions(userId, workspaceId, worldId) }); }
  catch (error) { return errorResponse(error); }
}
