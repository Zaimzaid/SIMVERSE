import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyVirtualCitizenshipQualification } from "@/server/services/player-governance-service";
import { z } from "zod";
import { parseOrThrow } from "@/lib/validation";
const requestSchema = z.strictObject({ countryPlaceId: z.string().cuid() });
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to check virtual citizenship qualifications.");
    const data = parseOrThrow(requestSchema, await req.json().catch(() => ({})));
    return dataResponse(await getMyVirtualCitizenshipQualification(user.id, data.countryPlaceId));
  } catch (error) { return errorResponse(error); }
}
