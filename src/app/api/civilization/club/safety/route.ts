import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyClubSafety, submitClubAppeal } from "@/server/services/district-club-safety-service";

async function who() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to manage Club safety.");
  return user.id;
}
export async function GET() {
  try { return dataResponse(await getMyClubSafety(await who())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { return dataResponse(await submitClubAppeal(await who(),
    await request.json().catch(() => ({}))), 201); }
  catch (error) { return errorResponse(error); }
}
