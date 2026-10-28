import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { getMyPlayerIdentity, listPlayerHomeCountries, updateMyPlayerIdentity } from "@/server/services/player-identity-service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to view your player identity.");
    const [identity, countries] = await Promise.all([
      getMyPlayerIdentity(user.id),
      listPlayerHomeCountries(),
    ]);
    return dataResponse({ identity, countries });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to edit your player identity.");
    const body = await req.json().catch(() => ({}));
    const identity = await updateMyPlayerIdentity(user.id, body);
    return dataResponse({ identity });
  } catch (error) { return errorResponse(error); }
}
