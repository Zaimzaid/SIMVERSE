import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyFoundingCitizenInterest, saveMyFoundingCitizenInterest,
} from "@/server/services/founding-citizen-interest-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view your SIMVERSE country preference.");
    return dataResponse(await getMyFoundingCitizenInterest(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to update your SIMVERSE country preference.");
    const input = await request.json().catch(() => ({}));
    // Deliberately use the authenticated session; client cannot choose userId.
    return dataResponse(await saveMyFoundingCitizenInterest(user.id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
