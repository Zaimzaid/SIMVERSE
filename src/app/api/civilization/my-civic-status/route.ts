import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyFoundingCivicStatus } from "@/server/services/founding-residence-service";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view your citizenship and district residence.");
    return dataResponse(await getMyFoundingCivicStatus(user.id));
  } catch (error) { return errorResponse(error); }
}
