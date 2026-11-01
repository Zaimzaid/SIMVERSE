import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  denyFoundingCitizenshipApplication,
  getMyFoundingReviewQueue,
} from "@/server/services/founding-citizenship-intake-service";

async function authenticatedId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to use the country-scoped review queue.");
  return user.id;
}

export async function GET() {
  try { return dataResponse(await getMyFoundingReviewQueue(await authenticatedId())); }
  catch (error) { return errorResponse(error); }
}

// A scoped reviewer may deny only. No approve/issue action exists yet.
export async function PATCH(request: NextRequest) {
  try {
    const reviewerId = await authenticatedId();
    const raw = await request.json().catch(() => ({}));
    return dataResponse(await denyFoundingCitizenshipApplication(reviewerId, raw));
  } catch (error) { return errorResponse(error); }
}
