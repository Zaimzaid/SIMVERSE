import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { decideMyWorkOffer } from "@/server/services/player-work-service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ applicationId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to use SIMVERSE work services.");
    const { applicationId } = await params;
    return dataResponse(await decideMyWorkOffer(user.id, applicationId, await req.json().catch(() => ({}))));
  } catch (error) { return errorResponse(error); }
}
