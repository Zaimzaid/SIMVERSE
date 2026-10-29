import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { acknowledgeDirectDelivery } from "@/server/services/social-service";

/** Explicit receiver acknowledgements, never senders claiming delivery. */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    const result = await acknowledgeDirectDelivery(user.id, await request.json().catch(() => ({})));
    return dataResponse(result);
  } catch (error) { return errorResponse(error); }
}
