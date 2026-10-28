import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { proposeVirtualTreaty } from "@/server/services/player-governance-service";
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to propose SIMVERSE virtual treaties.");
    return dataResponse(await proposeVirtualTreaty(user.id, await req.json().catch(() => ({}))), 201);
  } catch (error) { return errorResponse(error); }
}
