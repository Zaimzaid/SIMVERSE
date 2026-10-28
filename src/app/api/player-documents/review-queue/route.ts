import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getVirtualDocumentReviewQueue } from "@/server/services/player-document-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to review SIMVERSE documents.");
    return dataResponse(await getVirtualDocumentReviewQueue(user.id));
  } catch (error) { return errorResponse(error); }
}
