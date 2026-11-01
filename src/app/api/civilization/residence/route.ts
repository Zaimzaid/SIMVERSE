import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { joinOrTransferFoundingDistrict } from "@/server/services/founding-residence-service";
const inputSchema = z.strictObject({ districtId: z.string().min(8).max(64) });
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to choose a home district.");
    const input = parseOrThrow(inputSchema, await request.json().catch(() => ({})));
    return dataResponse(await joinOrTransferFoundingDistrict(user.id, input.districtId));
  } catch (error) { return errorResponse(error); }
}
