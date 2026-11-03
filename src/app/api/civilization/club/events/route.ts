import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyDistrictClubEvents, submitDistrictClubEvent, setMyDistrictClubEventRsvp,
} from "@/server/services/district-club-event-service";
import { z } from "zod";
import { parseOrThrow } from "@/lib/validation";

async function currentUserId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to use District Club events.");
  return user.id;
}
const requestSchema = z.strictObject({
  action: z.enum(["PROPOSE", "RSVP"]),
}).passthrough();

export async function GET() {
  try { return dataResponse(await listMyDistrictClubEvents(await currentUserId())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    const input: unknown = await request.json().catch(() => ({}));
    const { action, ...payload } = parseOrThrow(requestSchema, input);
    return dataResponse(action === "PROPOSE"
      ? await submitDistrictClubEvent(userId, payload)
      : await setMyDistrictClubEventRsvp(userId, payload), 201);
  } catch (error) { return errorResponse(error); }
}
