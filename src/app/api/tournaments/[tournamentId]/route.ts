import { requireApiContext } from "@/server/api/context";
import { dataResponse, errorResponse } from "@/server/api/response";
import { deleteTournament, getTournament, updateTournament } from "@/server/services/tournament-service";
interface Context { params: Promise<{ tournamentId: string }> }
export async function GET(_request: Request, context: Context) { try { const { userId, workspaceId } = await requireApiContext(); const { tournamentId } = await context.params; return dataResponse({ tournament: await getTournament(userId, workspaceId, tournamentId) }); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, context: Context) { try { const { userId, workspaceId } = await requireApiContext(); const { tournamentId } = await context.params; return dataResponse({ tournament: await updateTournament(userId, workspaceId, tournamentId, await request.json().catch(() => ({}))) }); } catch (error) { return errorResponse(error); } }
export async function DELETE(_request: Request, context: Context) { try { const { userId, workspaceId } = await requireApiContext(); const { tournamentId } = await context.params; return dataResponse(await deleteTournament(userId, workspaceId, tournamentId)); } catch (error) { return errorResponse(error); } }
