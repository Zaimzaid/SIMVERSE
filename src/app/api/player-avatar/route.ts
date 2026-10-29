import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyPlayerAvatar, saveMyPlayerAvatar } from "@/server/services/player-avatar-service";
export async function GET() {
  try {
    const user = await getSessionUser(); if (!user) throw new AuthenticationError("Sign in to view your character.");
    return dataResponse({ appearance: await getMyPlayerAvatar(user.id) });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser(); if (!user) throw new AuthenticationError("Sign in to save your character.");
    return dataResponse({ appearance: await saveMyPlayerAvatar(user.id, await req.json().catch(() => ({}))) });
  } catch (error) { return errorResponse(error); }
}
