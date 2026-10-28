import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getVirtualTravelReviewQueue } from "@/server/services/player-travel-service";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to review SIMVERSE virtual visas.");
    return dataResponse(await getVirtualTravelReviewQueue(user.id));
  } catch (error) { return errorResponse(error); }
}
