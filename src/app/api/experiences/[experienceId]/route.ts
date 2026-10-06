import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { deleteExperienceProfile, getExperienceProfile, updateExperienceProfile } from "@/server/services/experience-profile-service";
interface Context { params: Promise<{ experienceId: string }> }
export async function GET(_request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { experienceId } = await context.params; return dataResponse({ experience: await getExperienceProfile(userId, workspaceId, experienceId) }); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { experienceId } = await context.params; return dataResponse({ experience: await updateExperienceProfile(userId, workspaceId, experienceId, await request.json().catch(() => ({}))) }); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { experienceId } = await context.params; return dataResponse(await deleteExperienceProfile(userId, workspaceId, experienceId)); }
  catch (error) { return errorResponse(error); }
}
