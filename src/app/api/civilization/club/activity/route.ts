import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyDistrictClubActivity, acknowledgeMyDistrictClubActivity,
} from "@/server/services/district-club-activity-service";

async function userId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to access District Club notifications.");
  return user.id;
}
export async function GET() {
  try { return dataResponse(await getMyDistrictClubActivity(await userId())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const id = await userId();
    const payload: unknown = await request.json().catch(() => ({}));
    return dataResponse(await acknowledgeMyDistrictClubActivity(id, payload));
  } catch (error) { return errorResponse(error); }
}
