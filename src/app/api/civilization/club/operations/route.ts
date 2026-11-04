import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyDistrictClubOperations } from "@/server/services/district-club-operations-service";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError();
    return dataResponse(await getMyDistrictClubOperations(user.id));
  } catch (error) { return errorResponse(error); }
}
