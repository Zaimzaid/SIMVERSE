import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyDistrictClubDirectory, saveMyDistrictClubDirectoryPreference,
} from "@/server/services/district-club-service";

async function currentUserId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to manage your district club directory profile.");
  return user.id;
}

export async function GET() {
  try {
    return dataResponse(await getMyDistrictClubDirectory(await currentUserId()));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await currentUserId();
    const input: unknown = await request.json().catch(() => ({}));
    return dataResponse(await saveMyDistrictClubDirectoryPreference(userId, input));
  } catch (error) { return errorResponse(error); }
}
