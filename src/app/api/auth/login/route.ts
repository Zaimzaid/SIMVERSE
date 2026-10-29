import type { NextRequest } from "next/server";
import { createSession, setActiveWorkspaceCookie } from "@/server/auth/session";
import { authenticateUser } from "@/server/services/auth-service";
import {beginTwoFactorChallenge} from "@/server/services/two-factor-service";
import { listWorkspacesForUser } from "@/server/services/workspace-service";
import { dataResponse, errorResponse } from "@/server/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = await authenticateUser(body);

    if(user.twoFactorEnabledAt){
      const challenge=await beginTwoFactorChallenge(user.id);
      return dataResponse({twoFactorRequired:true,challenge});
    }
    await createSession(user.id, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    // Default the active workspace to the user's first membership.
    const workspaces = await listWorkspacesForUser(user.id);
    if (workspaces[0]) await setActiveWorkspaceCookie(workspaces[0].id);

    return dataResponse({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
