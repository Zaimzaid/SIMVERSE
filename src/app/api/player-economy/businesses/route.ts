import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { createMyVirtualBusinessDraft } from "@/server/services/player-economy-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to draft a SIMVERSE company.");
    return dataResponse(await createMyVirtualBusinessDraft(user.id, await req.json().catch(() => ({}))), 201);
  } catch (error) { return errorResponse(error); }
}
