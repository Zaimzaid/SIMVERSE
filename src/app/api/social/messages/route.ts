import { AuthenticationError, ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { listConversation, sendMessage } from "@/server/services/social-service";
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    const peer = new URL(request.url).searchParams.get("peer");
    if (!peer || peer.length > 80) throw new ValidationError("Choose a conversation.");
    return dataResponse({ messages: await listConversation(user.id, peer) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in first.");
    return dataResponse({ message: await sendMessage(user.id, await request.json().catch(() => ({}))) }, 201);
  } catch (error) { return errorResponse(error); }
}
