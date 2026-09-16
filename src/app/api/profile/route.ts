import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { updateProfile } from "@/server/services/user-service";
import { dataResponse, errorResponse } from "@/server/api/response";

export async function PATCH(req: NextRequest) {
  try {
    const current = await getSessionUser();
    if (!current) throw new AuthenticationError("You must be signed in.");

    const body = await req.json().catch(() => ({}));
    const user = await updateProfile(current.id, body);

    return dataResponse({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
