import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { activateVirtualCitizenshipPolicy } from "@/server/services/player-governance-service";
export async function POST(_req: Request, { params }: { params: Promise<{ policyId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to activate virtual country rules.");
    const { policyId } = await params;
    return dataResponse(await activateVirtualCitizenshipPolicy(user.id, policyId));
  } catch (error) { return errorResponse(error); }
}
