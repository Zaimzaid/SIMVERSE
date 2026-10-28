import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getBusinessReviewQueue } from "@/server/services/player-training-business-service";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to use SIMVERSE work services.");
    return dataResponse(await getBusinessReviewQueue(user.id));
  } catch (error) { return errorResponse(error); }
}
