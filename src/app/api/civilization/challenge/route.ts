import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyDailyCivilizationChallenge, submitDailyCivilizationChallenge,
} from "@/server/services/civilization-challenge-service";

async function sessionUserId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to play the daily citizen challenge.");
  return user.id;
}

export async function GET() {
  try {
    return dataResponse(await getMyDailyCivilizationChallenge(await sessionUserId()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await sessionUserId();
    const payload: unknown = await request.json().catch(() => ({}));
    return dataResponse(await submitDailyCivilizationChallenge(userId, payload), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
