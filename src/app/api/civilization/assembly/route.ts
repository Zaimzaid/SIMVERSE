import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyAssemblyDistricts, getDistrictAssembly, submitDistrictProposal,
  postDistrictComment, castDistrictVote, reportDistrictContent,
} from "@/server/services/district-assembly-service";

const actionSchema = z.enum(["PROPOSE", "COMMENT", "VOTE", "REPORT"]);
async function loggedInUserId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to access your district assembly.");
  return user.id;
}
export async function GET(request: NextRequest) {
  try {
    const userId = await loggedInUserId();
    const districtId = new URL(request.url).searchParams.get("districtId");
    return dataResponse(districtId
      ? await getDistrictAssembly(userId, districtId)
      : await listMyAssemblyDistricts(userId));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await loggedInUserId();
    const raw: unknown = await request.json().catch(() => ({}));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ValidationError("Invalid assembly request.");
    const { action, ...payload } = raw as Record<string, unknown>;
    const kind = parseOrThrow(actionSchema, action);
    const result = kind === "PROPOSE" ? await submitDistrictProposal(userId, payload)
      : kind === "COMMENT" ? await postDistrictComment(userId, payload)
      : kind === "VOTE" ? await castDistrictVote(userId, payload)
      : await reportDistrictContent(userId, payload);
    return dataResponse(result, 201);
  } catch (error) { return errorResponse(error); }
}
