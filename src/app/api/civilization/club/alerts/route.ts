import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyClubAlertSettings, saveMyClubAlertSettings,
} from "@/server/services/district-club-alert-service";

async function who() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in for Club preferences.");
  return user.id;
}
export async function GET() {
  try { return dataResponse(await getMyClubAlertSettings(await who())); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(req: NextRequest) {
  try { return dataResponse(await saveMyClubAlertSettings(await who(),
    await req.json().catch(() => ({})))); }
  catch (error) { return errorResponse(error); }
}
