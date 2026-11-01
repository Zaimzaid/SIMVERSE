import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { claimDailyVascoin } from "@/server/services/vascoin-service";

// No amount, userId or claim date accepted from the request.
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to claim a daily Vascoin reward.");
    return dataResponse(await claimDailyVascoin(user.id));
  } catch (error) { return errorResponse(error); }
}
