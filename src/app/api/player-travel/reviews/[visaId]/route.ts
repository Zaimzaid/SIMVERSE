import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { reviewVirtualTravelVisa } from "@/server/services/player-travel-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to review SIMVERSE virtual visas.");
    const { visaId } = await params;
    return dataResponse(await reviewVirtualTravelVisa(user.id, visaId, await req.json().catch(() => ({}))));
  } catch (error) { return errorResponse(error); }
}
