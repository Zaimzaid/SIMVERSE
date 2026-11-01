import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import {
  listMyDevelopmentStaffDistricts, getStaffDevelopmentQueue,
  startDevelopmentFeasibility, reviewDevelopmentFeasibility,
  setSchematicProjectCandidate, publishDevelopmentPlanningUpdate,
} from "@/server/services/founding-development-service";

const actionSchema = z.enum(["START", "REVIEW", "SCHEMATIC_CANDIDATE", "UPDATE"]);
async function userId() {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError("An authorized development staff account is required.");
  return user.id;
}

export async function GET(request: NextRequest) {
  try {
    const id = await userId();
    const districtId = new URL(request.url).searchParams.get("districtId");
    return dataResponse(districtId
      ? await getStaffDevelopmentQueue(id, districtId)
      : await listMyDevelopmentStaffDistricts(id));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const id = await userId();
    const raw: unknown = await request.json().catch(() => ({}));
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new ValidationError("Invalid staff development request.");
    const { action, ...payload } = raw as Record<string, unknown>;
    const kind = parseOrThrow(actionSchema, action);
    const response = kind === "START" ? await startDevelopmentFeasibility(id, payload)
      : kind === "REVIEW" ? await reviewDevelopmentFeasibility(id, payload)
      : kind === "SCHEMATIC_CANDIDATE" ? await setSchematicProjectCandidate(id, payload)
      : await publishDevelopmentPlanningUpdate(id, payload);
    return dataResponse(response);
  } catch (error) { return errorResponse(error); }
}
