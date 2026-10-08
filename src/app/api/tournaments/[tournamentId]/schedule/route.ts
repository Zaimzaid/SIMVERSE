import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { updateTournamentSchedule } from "@/server/services/tournament-service";
interface Context { params: Promise<{ tournamentId: string }> }
export async function PATCH(request: Request, context: Context) {
  try { const { userId, workspaceId } = await requireApiContext(); const { tournamentId } = await context.params; return dataResponse({ tournament: await updateTournamentSchedule(userId, workspaceId, tournamentId, await request.json().catch(() => ({}))) }); }
  catch (error) { return errorResponse(error); }
}
