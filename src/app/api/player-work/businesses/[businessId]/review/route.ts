import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { reviewBusiness } from "@/server/services/player-training-business-service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to use SIMVERSE work services.");
    const { businessId } = await params;
    return dataResponse(await reviewBusiness(user.id, businessId, await req.json().catch(() => ({}))));
  } catch (error) { return errorResponse(error); }
}
