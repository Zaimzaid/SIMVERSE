import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getMyDistrictClubHome, listMyDistrictClubMessages,
  postMyDistrictClubMessage, reportDistrictClubMessage,
} from "@/server/services/district-club-service";

const actionSchema = z.enum(["MESSAGE", "REPORT"]);
async function currentUserId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to access your district club.");
  return user.id;
}
export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId();
    const room = new URL(request.url).searchParams.get("room");
    return dataResponse(room === null
      ? await getMyDistrictClubHome(userId)
      : await listMyDistrictClubMessages(userId, room));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    const raw: unknown = await request.json().catch(() => ({}));
    const { action, ...payload } = parseOrThrow(
      z.strictObject({
        action: actionSchema,
      }).passthrough(),
      raw,
    );
    return dataResponse(action === "MESSAGE"
      ? await postMyDistrictClubMessage(userId, payload)
      : await reportDistrictClubMessage(userId, payload), 201);
  } catch (error) { return errorResponse(error); }
}
