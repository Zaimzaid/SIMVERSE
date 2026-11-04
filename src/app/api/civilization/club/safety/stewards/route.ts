import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { updateClubModeratorGrant } from "@/server/services/district-club-safety-service";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to manage Club moderator grants.");
    return dataResponse(await updateClubModeratorGrant(user.id,
      await request.json().catch(() => ({}))));
  } catch (error) { return errorResponse(error); }
}
