import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyVascoinOverview } from "@/server/services/vascoin-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view your private Vascoin balance.");
    return dataResponse(await getMyVascoinOverview(user.id));
  } catch (error) { return errorResponse(error); }
}
