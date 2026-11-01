import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  getDistrictModerationQueue, resolveDistrictReport, moderateDistrictProposal,
  moderateDistrictComment, createDistrictNotice,
} from "@/server/services/district-assembly-service";

const actionSchema = z.enum(["PROPOSAL", "COMMENT", "NOTICE", "REPORT"]);
async function loggedInModeratorId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in with an active district moderator grant.");
  return user.id;
}
export async function GET(request: NextRequest) {
  try {
    const userId = await loggedInModeratorId();
    const districtId = new URL(request.url).searchParams.get("districtId") ?? "";
    return dataResponse(await getDistrictModerationQueue(userId, districtId));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await loggedInModeratorId();
    const raw: unknown = await request.json().catch(() => ({}));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ValidationError("Invalid moderation request.");
    const { action, ...payload } = raw as Record<string, unknown>;
    const kind = parseOrThrow(actionSchema, action);
    const result = kind === "PROPOSAL" ? await moderateDistrictProposal(userId, payload)
      : kind === "COMMENT" ? await moderateDistrictComment(userId, payload)
      : kind === "NOTICE" ? await createDistrictNotice(userId, payload)
      : await resolveDistrictReport(userId, payload);
    return dataResponse(result);
  } catch (error) { return errorResponse(error); }
}
