import { AuthenticationError, ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listClubModeratorGrantsForSteward } from "@/server/services/district-club-operations-service";
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError();
    const districtId = new URL(req.url).searchParams.get("districtId");
    if (!districtId || !/^[a-z0-9]{20,40}$/i.test(districtId)) throw new ValidationError("Select a district.");
    return dataResponse(await listClubModeratorGrantsForSteward(user.id, districtId));
  } catch (error) { return errorResponse(error); }
}
