import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { reportClubInterestMessage } from "@/server/services/district-club-interest-service";
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError();
    return dataResponse(await reportClubInterestMessage(user.id,
      await req.json().catch(() => ({}))), 201);
  } catch (e) { return errorResponse(e); }
}
