import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { contributeVascoinToMyDistrict } from "@/server/services/vascoin-service";

// The server resolves the user's *approved current home* district. Never
// accept a destination wallet, districtId, currency or userId from the client.
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to contribute virtual Vascoin.");
    const raw = await request.json().catch(() => ({}));
    return dataResponse(await contributeVascoinToMyDistrict(user.id, raw));
  } catch (error) { return errorResponse(error); }
}
