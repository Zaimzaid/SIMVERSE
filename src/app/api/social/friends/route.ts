import { AuthenticationError, ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { requestFriend, respondFriend } from "@/server/services/social-service";
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    return dataResponse(await requestFriend(user.id, await request.json().catch(() => ({}))), 201);
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    const value = await request.json().catch(() => ({}));
    if (typeof value.id !== "string" || value.id.length > 80 ||
      (value.action !== "ACCEPT" && value.action !== "REMOVE")) throw new ValidationError("Invalid friendship action.");
    await respondFriend(user.id, value.id, value.action);
    return dataResponse({ success: true });
  } catch (error) { return errorResponse(error); }
}
