import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { archiveExperienceProfile } from "@/server/services/experience-profile-service";
interface Context { params: Promise<{ experienceId: string }> }
export async function POST(_request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { experienceId } = await context.params; return dataResponse({ experience: await archiveExperienceProfile(userId, workspaceId, experienceId) }); }
  catch (error) { return errorResponse(error); }
}
