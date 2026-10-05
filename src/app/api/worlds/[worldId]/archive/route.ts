import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { archiveWorld } from "@/server/services/world-service";
interface Context { params: Promise<{ worldId: string }> }
export async function POST(_request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { worldId } = await context.params; return dataResponse({ world: await archiveWorld(userId, workspaceId, worldId) }); }
  catch (error) { return errorResponse(error); }
}
