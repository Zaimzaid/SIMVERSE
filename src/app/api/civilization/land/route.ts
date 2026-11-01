import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyLandPlans, getDistrictLandPlan, createDistrictLandPlan, addDraftLandArea,
} from "@/server/services/land-planning-service";

const actionSchema = z.enum(["CREATE_DRAFT", "ADD_AREA"]);
async function myId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("Sign in to view planning status.");
  return user.id;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await myId();
    const districtId = new URL(request.url).searchParams.get("districtId");
    return dataResponse(districtId ? await getDistrictLandPlan(userId, districtId)
      : await listMyLandPlans(userId));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await myId();
    const raw: unknown = await request.json().catch(() => ({}));
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new ValidationError("Invalid land planning request.");
    const { action, ...payload } = raw as Record<string, unknown>;
    const kind = parseOrThrow(actionSchema, action);
    return dataResponse(kind === "CREATE_DRAFT"
      ? await createDistrictLandPlan(userId, payload)
      : await addDraftLandArea(userId, payload));
  } catch (error) { return errorResponse(error); }
}
