import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyVirtualGovernance } from "@/server/services/player-governance-service";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view SIMVERSE country governance.");
    return dataResponse(await getMyVirtualGovernance(user.id));
  } catch (error) { return errorResponse(error); }
}
