import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { endorseFoundingCitizenship } from "@/server/services/founding-citizenship-issuance-service";

const inputSchema = z.strictObject({ applicationId: z.string().min(20).max(40) });
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in with a country-scoped reviewer grant.");
    const input = parseOrThrow(inputSchema, await request.json().catch(() => ({})));
    return dataResponse(await endorseFoundingCitizenship(user.id, input.applicationId));
  } catch (error) { return errorResponse(error); }
}
