import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listJoinableFoundingDistricts } from "@/server/services/founding-residence-service";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to discover approved active districts.");
    return dataResponse(await listJoinableFoundingDistricts(user.id));
  } catch (error) { return errorResponse(error); }
}
