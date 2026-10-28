import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { checkMyVirtualTravel } from "@/server/services/player-travel-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to check SIMVERSE virtual travel eligibility.");
    return dataResponse(await checkMyVirtualTravel(user.id, await req.json().catch(() => ({}))));
  } catch (error) { return errorResponse(error); }
}
