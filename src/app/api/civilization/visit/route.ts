import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { beginFoundingVisit, endFoundingVisit } from "@/server/services/founding-residence-service";
const inputSchema = z.strictObject({ countryId: z.string().min(8).max(64) });
async function authenticatedId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to manage in-world visits.");
  return user.id;
}
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticatedId();
    const input = parseOrThrow(inputSchema, await request.json().catch(() => ({})));
    return dataResponse(await beginFoundingVisit(userId, input.countryId));
  } catch (error) { return errorResponse(error); }
}
export async function DELETE() {
  try { return dataResponse(await endFoundingVisit(await authenticatedId())); }
  catch (error) { return errorResponse(error); }
}
