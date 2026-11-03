import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyClubModerationQueue, reviewDistrictClubReport,
} from "@/server/services/district-club-service";

async function userId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to moderate your district club.");
  return user.id;
}
export async function GET() {
  try { return dataResponse(await listMyClubModerationQueue(await userId())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const requester = await userId();
    const payload: unknown = await request.json().catch(() => ({}));
    return dataResponse(await reviewDistrictClubReport(requester, payload));
  } catch (error) { return errorResponse(error); }
}
