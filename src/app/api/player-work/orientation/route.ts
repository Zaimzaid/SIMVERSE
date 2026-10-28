import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getOrientationInfo, submitOrientation } from "@/server/services/player-training-business-service";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to use SIMVERSE work services.");
    return dataResponse(await getOrientationInfo(user.id));
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to use SIMVERSE work services.");
    return dataResponse(await submitOrientation(user.id, await req.json().catch(() => ({}))), 201);
  } catch (error) { return errorResponse(error); }
}
