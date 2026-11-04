import type { NextRequest } from "next/server";
import { AuthenticationError, ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyClubSafetyQueue, issueClubSanction, revokeClubSanction, decideClubAppeal,
} from "@/server/services/district-club-safety-service";

async function who() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to moderate Club safety.");
  return user.id;
}
export async function GET() {
  try { return dataResponse(await getMyClubSafetyQueue(await who())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await who();
    const input = await request.json().catch(() => ({}));
    if (input?.action === "SANCTION") {
      const { action, ...payload } = input;
      void action;
      return dataResponse(await issueClubSanction(userId, payload), 201);
    }
    if (input?.action === "REVOKE") {
      const { action, ...payload } = input;
      void action;
      return dataResponse(await revokeClubSanction(userId, payload));
    }
    if (input?.action === "DECIDE_APPEAL") {
      const { action, ...payload } = input;
      void action;
      return dataResponse(await decideClubAppeal(userId, payload));
    }
    throw new ValidationError("Unknown Club moderation action.");
  } catch (error) { return errorResponse(error); }
}
