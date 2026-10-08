import { requireApiContext } from "@/server/api/context"; import { dataResponse, errorResponse } from "@/server/api/response"; import { pauseTournament } from "@/server/services/tournament-service";
interface Context { params: Promise<{ tournamentId: string }> }
export async function POST(_request: Request, context: Context) { try { const { userId, workspaceId } = await requireApiContext(); const { tournamentId } = await context.params; return dataResponse({ tournament: await pauseTournament(userId, workspaceId, tournamentId) }); } catch (error) { return errorResponse(error); } }
