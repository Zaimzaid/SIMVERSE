import { AuthenticationError, ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { blockPlayer, unblockPlayer } from "@/server/services/social-service";
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    await blockPlayer(user.id, await request.json().catch(() => ({})));
    return dataResponse({ success: true });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId || userId.length > 80) throw new ValidationError("Choose a player.");
    await unblockPlayer(user.id, userId);
    return dataResponse({ success: true });
  } catch (error) { return errorResponse(error); }
}
