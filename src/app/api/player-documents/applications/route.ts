import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyVirtualDocuments, submitVirtualDocumentApplication,
} from "@/server/services/player-document-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view your virtual documents.");
    return dataResponse(await getMyVirtualDocuments(user.id));
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to apply for SIMVERSE documents.");
    return dataResponse(await submitVirtualDocumentApplication(
      user.id, await req.json().catch(() => ({})),
    ), 201);
  } catch (error) { return errorResponse(error); }
}
