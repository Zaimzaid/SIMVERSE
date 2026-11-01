import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyDistrictDevelopmentBoard } from "@/server/services/founding-development-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to see your district's development progress.");
    return dataResponse(await getMyDistrictDevelopmentBoard(user.id));
  } catch (error) { return errorResponse(error); }
}
