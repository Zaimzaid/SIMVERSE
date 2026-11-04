import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyClubEventReviewQueue, reviewDistrictClubEvent,
} from "@/server/services/district-club-event-service";

async function currentUserId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to moderate District Club events.");
  return user.id;
}
export async function GET() {
  try { return dataResponse(await listMyClubEventReviewQueue(await currentUserId())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    const input: unknown = await request.json().catch(() => ({}));
    return dataResponse(await reviewDistrictClubEvent(userId, input));
  } catch (error) { return errorResponse(error); }
}
