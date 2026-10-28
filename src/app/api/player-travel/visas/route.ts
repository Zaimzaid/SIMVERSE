import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyVirtualTravelCenter, submitVirtualTravelVisa } from "@/server/services/player-travel-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view your SIMVERSE virtual travel records.");
    return dataResponse(await getMyVirtualTravelCenter(user.id));
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to apply for a SIMVERSE entry visa.");
    return dataResponse(await submitVirtualTravelVisa(user.id, await req.json().catch(() => ({}))), 201);
  } catch (error) { return errorResponse(error); }
}
