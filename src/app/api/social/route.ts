import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listSocial, searchPublicPlayers } from "@/server/services/social-service";
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    const query = new URL(request.url).searchParams.get("username");
    if (query) return dataResponse({ players: await searchPublicPlayers(user.id, query) });
    return dataResponse(await listSocial(user.id));
  } catch (error) { return errorResponse(error); }
}
