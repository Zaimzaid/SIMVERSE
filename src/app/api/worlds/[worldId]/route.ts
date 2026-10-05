import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { deleteWorld, getWorld, updateWorld } from "@/server/services/world-service";
interface Context { params: Promise<{ worldId: string }> }
export async function GET(_request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { worldId } = await context.params; return dataResponse({ world: await getWorld(userId, workspaceId, worldId) }); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { worldId } = await context.params; return dataResponse({ world: await updateWorld(userId, workspaceId, worldId, await request.json().catch(() => ({}))) }); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { worldId } = await context.params; return dataResponse(await deleteWorld(userId, workspaceId, worldId)); }
  catch (error) { return errorResponse(error); }
}
