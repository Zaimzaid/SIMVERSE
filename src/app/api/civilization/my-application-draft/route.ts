import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyFoundingCitizenshipDraft,
  saveMyFoundingCitizenshipDraft,
  deleteMyFoundingCitizenshipDraft,
} from "@/server/services/founding-citizenship-draft-service";

async function requireSignedInUserId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Please sign in to manage your private citizenship draft.");
  return user.id;
}

export async function GET() {
  try { return dataResponse(await getMyFoundingCitizenshipDraft(await requireSignedInUserId())); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireSignedInUserId();
    const raw = await request.json().catch(() => ({}));
    return dataResponse(await saveMyFoundingCitizenshipDraft(userId, raw));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE() {
  try { return dataResponse(await deleteMyFoundingCitizenshipDraft(await requireSignedInUserId())); }
  catch (error) { return errorResponse(error); }
}

// Deliberately no POST/submit or reviewer approval endpoint. A draft cannot
// create a pending citizenship application or issue national privileges.
