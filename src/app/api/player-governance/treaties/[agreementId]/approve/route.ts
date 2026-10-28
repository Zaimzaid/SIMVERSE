import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { approveVirtualTreaty } from "@/server/services/player-governance-service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ agreementId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to review SIMVERSE virtual treaties.");
    const { agreementId } = await params;
    return dataResponse(await approveVirtualTreaty(
      user.id, agreementId, await req.json().catch(() => ({})),
    ));
  } catch (error) { return errorResponse(error); }
}
