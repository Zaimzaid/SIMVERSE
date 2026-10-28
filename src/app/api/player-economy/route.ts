import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyEconomicIdentity } from "@/server/services/player-economy-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view your SIMVERSE career and wallet.");
    return dataResponse(await getMyEconomicIdentity(user.id));
  } catch (error) { return errorResponse(error); }
}
